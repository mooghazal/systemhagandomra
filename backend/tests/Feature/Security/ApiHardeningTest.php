<?php

namespace Tests\Feature\Security;

use App\Models\Company;
use App\Models\Package;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Transport- and envelope-level checks: response shape, information leakage,
 * injection, and the headers a browser relies on.
 */
class ApiHardeningTest extends TestCase
{
    private Company $company;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->owner = $this->owner($this->company);
    }

    #[Test]
    public function every_response_uses_the_same_envelope(): void
    {
        $this->actingAsUser($this->owner);

        $ok = $this->getJson('/api/packages');
        $this->assertTrue($ok->json('success'));
        $this->assertArrayHasKey('data', $ok->json());

        $invalid = $this->postJson('/api/packages', []);
        $this->assertFalse($invalid->json('success'));
        $this->assertArrayHasKey('message', $invalid->json());
        $this->assertArrayHasKey('errors', $invalid->json());

        $missing = $this->getJson('/api/packages/999999');
        $this->assertFalse($missing->json('success'));
        $this->assertArrayHasKey('message', $missing->json());

        // flushHeaders drops the bearer token set earlier in this test, so the
        // request really does arrive without credentials.
        $unauthenticated = $this->nextRequest()->flushHeaders()->getJson('/api/auth/me');
        $this->assertFalse($unauthenticated->json('success'));
        $this->assertArrayHasKey('message', $unauthenticated->json());
    }

    #[Test]
    public function the_expected_status_codes_are_used(): void
    {
        $this->actingAsUser($this->owner);

        $this->postJson('/api/packages', ['name' => 'Created'])->assertStatus(201);
        $this->getJson('/api/packages')->assertStatus(200);
        $this->postJson('/api/packages', [])->assertStatus(422);
        $this->getJson('/api/packages/999999')->assertStatus(404);

        $this->actingAsUser($this->employee($this->company));
        $this->getJson('/api/packages')->assertStatus(403);

        $this->nextRequest()->withToken('not-a-real-token')->getJson('/api/auth/me')->assertStatus(401);
    }

    #[Test]
    public function security_headers_are_present(): void
    {
        $response = $this->actingAsUser($this->owner)->getJson('/api/packages');

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('Referrer-Policy', 'no-referrer');

        $this->assertStringContainsString(
            "frame-ancestors 'none'",
            $response->headers->get('Content-Security-Policy'),
        );
    }

    /*
     * The two CORS cases are separate tests on purpose: the middleware keeps
     * state for the life of the application, so two cross-origin requests in
     * one test would have the first one's answer leak into the second.
     *
     * Both configure *two* origins, as a real deployment does (admin panel and
     * company dashboard). This matters: php-cors short-circuits when exactly
     * one origin is allowed and echoes it to every caller regardless of their
     * Origin. That stays safe — the browser compares the header against its
     * own origin and blocks a mismatch — but it would make a single-origin
     * test look like a failure while proving nothing.
     */
    private const ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

    #[Test]
    public function a_configured_frontend_origin_is_granted_access(): void
    {
        config(['cors.allowed_origins' => self::ORIGINS]);

        $response = $this->actingAsUser($this->owner)
            ->withHeader('Origin', 'http://localhost:3001')
            ->getJson('/api/packages');

        $this->assertSame(
            'http://localhost:3001',
            $response->headers->get('Access-Control-Allow-Origin'),
        );
    }

    #[Test]
    public function an_unknown_origin_is_not_granted_access(): void
    {
        config(['cors.allowed_origins' => self::ORIGINS]);

        $response = $this->actingAsUser($this->owner)
            ->withHeader('Origin', 'https://evil.test')
            ->getJson('/api/packages');

        $this->assertNull($response->headers->get('Access-Control-Allow-Origin'));
    }

    #[Test]
    public function the_api_does_not_accept_cross_origin_credentials(): void
    {
        $response = $this->actingAsUser($this->owner)
            ->withHeader('Origin', 'http://localhost:3000')
            ->getJson('/api/packages');

        // Auth is a bearer token held server-side by each frontend, so the
        // browser never sends cookies cross-origin and the API has no CSRF
        // surface. Turning this on would create one.
        $this->assertNull($response->headers->get('Access-Control-Allow-Credentials'));
        $this->assertFalse(config('cors.supports_credentials'));
    }

    #[Test]
    public function an_internal_error_does_not_leak_implementation_details(): void
    {
        config(['app.debug' => false]);

        // A route that blows up inside the framework rather than in validation.
        $this->app['router']->get('/api/_boom', fn () => throw new \RuntimeException(
            'SQLSTATE[42S02]: Base table or view not found: secrets at /var/www/app/Secret.php:42'
        ))->middleware('auth:sanctum');

        $response = $this->actingAsUser($this->owner)->getJson('/api/_boom');

        $response->assertStatus(500)->assertJson(['success' => false, 'message' => 'Server error.']);

        $body = $response->getContent();

        $this->assertStringNotContainsString('SQLSTATE', $body);
        $this->assertStringNotContainsString('/var/www', $body);
        $this->assertStringNotContainsString('Secret.php', $body);
        $this->assertStringNotContainsString('trace', strtolower($body));
    }

    #[Test]
    public function a_quoted_search_term_cannot_break_out_of_the_query(): void
    {
        Package::factory()->forCompany($this->company)->create(['name' => 'Ramadan Umrah']);

        $injections = [
            "' OR '1'='1",
            '"; DROP TABLE packages; --',
            "1' UNION SELECT password FROM users --",
        ];

        $this->actingAsUser($this->owner);

        foreach ($injections as $payload) {
            $response = $this->getJson('/api/packages?search='.urlencode($payload));

            $this->assertApiSuccess($response);
            $this->assertCount(0, $response->json('data'), "Payload leaked rows: {$payload}");
        }

        // The table is still there.
        $this->assertSame(1, DB::table('packages')->count());
    }

    #[Test]
    public function a_list_response_never_carries_a_password_hash(): void
    {
        $this->employee($this->company);

        $response = $this->actingAsUser($this->owner)->getJson('/api/employees');

        $this->assertStringNotContainsString('$2y$', $response->getContent());
        $this->assertStringNotContainsString('remember_token', $response->getContent());
        $this->assertArrayNotHasKey('password', $response->json('data.0'));
    }

    #[Test]
    public function access_tokens_are_never_exposed_through_a_resource(): void
    {
        $this->actingAsUser($this->owner);
        $this->postJson('/api/auth/logout');

        $response = $this->actingAsUser($this->owner)->getJson('/api/auth/me');

        $this->assertArrayNotHasKey('tokens', $response->json('data.user'));
        $this->assertStringNotContainsString('personal_access_token', $response->getContent());
    }

    #[Test]
    public function sequential_ids_do_not_expose_other_tenants(): void
    {
        $other = $this->company();

        // Interleave so the ids of both companies are adjacent.
        foreach (range(1, 5) as $ignored) {
            Package::factory()->forCompany($this->company)->create();
            Package::factory()->forCompany($other)->create();
        }

        $this->actingAsUser($this->owner);

        $theirs = Package::query()->withoutGlobalScopes()->where('company_id', $other->id)->pluck('id');

        foreach ($theirs as $id) {
            $this->assertApiError($this->getJson("/api/packages/{$id}"), 404);
        }

        $mine = Package::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->pluck('id');

        foreach ($mine as $id) {
            $this->assertApiSuccess($this->getJson("/api/packages/{$id}"));
        }
    }

    #[Test]
    public function a_non_numeric_id_is_a_clean_404_rather_than_a_crash(): void
    {
        $this->actingAsUser($this->owner);

        foreach (['abc', '../../etc/passwd', '1%20OR%201=1', '0'] as $id) {
            $this->assertApiError($this->getJson("/api/packages/{$id}"), 404);
        }
    }

    #[Test]
    public function oversized_text_is_rejected_rather_than_truncated(): void
    {
        $response = $this->actingAsUser($this->owner)->postJson('/api/packages', [
            'name' => 'Fine',
            'description' => str_repeat('a', 10_001),
        ]);

        $this->assertApiError($response, 422)->assertJsonStructure(['errors' => ['description']]);
    }

    #[Test]
    public function a_feature_list_cannot_be_used_to_smuggle_structured_data(): void
    {
        $response = $this->actingAsUser($this->owner)->postJson('/api/packages', [
            'name' => 'Nested',
            'features' => [['nested' => 'object'], 123],
        ]);

        $this->assertApiError($response, 422);
    }

    #[Test]
    public function an_absurd_number_of_features_is_refused(): void
    {
        $response = $this->actingAsUser($this->owner)->postJson('/api/packages', [
            'name' => 'Too many',
            'features' => array_fill(0, 200, 'Feature'),
        ]);

        $this->assertApiError($response, 422)->assertJsonStructure(['errors' => ['features']]);
    }

    #[Test]
    public function text_is_stored_verbatim_and_escaped_on_output_rather_than_stripped(): void
    {
        $payload = '<script>alert("xss")</script> & "quotes"';

        $response = $this->actingAsUser($this->owner)->postJson('/api/packages', [
            'name' => $payload,
        ]);

        $this->assertApiSuccess($response, 201);

        // A JSON API must not mangle user content: it hands back exactly what
        // was stored. The markup is inert here because the response is typed
        // as JSON and marked nosniff, so no browser will parse it as HTML —
        // escaping is the job of whichever client renders it.
        $this->assertSame($payload, $response->json('data.name'));
        $this->assertSame($payload, Package::query()->sole()->name);

        $this->assertStringStartsWith('application/json', $response->headers->get('Content-Type'));
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
    }
}
