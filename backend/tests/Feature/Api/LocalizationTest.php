<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Validation messages follow the caller's Accept-Language header.
 *
 * The backend serves an Arabic admin panel, a company dashboard and an MCP
 * agent, so the language belongs to the client rather than the server. These
 * tests exist because an Arabic screen showing "The name field is required."
 * is a half-finished one — and because a header that reaches setLocale() must
 * never be trusted as given.
 */
class LocalizationTest extends TestCase
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
    public function validation_errors_come_back_in_arabic_when_asked(): void
    {
        $response = $this->actingAsUser($this->owner)
            ->withHeader('Accept-Language', 'ar')
            ->postJson('/api/packages', []);

        $this->assertApiError($response, 422);

        $message = $response->json('errors.name.0');

        $this->assertStringContainsString('مطلوب', $message);
        // The field name is translated too, not left as the column name.
        $this->assertStringContainsString('الاسم', $message);
        $this->assertDoesNotMatchRegularExpression('/[a-z]{4,}/i', $message);
    }

    #[Test]
    public function validation_errors_stay_english_by_default(): void
    {
        $response = $this->actingAsUser($this->owner)->postJson('/api/packages', []);

        $this->assertApiError($response, 422);
        $this->assertStringContainsString('required', $response->json('errors.name.0'));
    }

    #[Test]
    public function a_regional_arabic_locale_resolves_to_arabic(): void
    {
        $response = $this->actingAsUser($this->owner)
            ->withHeader('Accept-Language', 'ar-SA,ar;q=0.9,en;q=0.8')
            ->postJson('/api/packages', []);

        $this->assertStringContainsString('مطلوب', $response->json('errors.name.0'));
    }

    #[Test]
    public function an_unsupported_language_falls_back_to_english(): void
    {
        $response = $this->actingAsUser($this->owner)
            ->withHeader('Accept-Language', 'fr-FR,fr;q=0.9')
            ->postJson('/api/packages', []);

        $this->assertStringContainsString('required', $response->json('errors.name.0'));
    }

    #[Test]
    public function a_hostile_accept_language_header_cannot_reach_the_filesystem(): void
    {
        // setLocale() resolves to a path under lang/, so the header is matched
        // against an allowlist rather than used as sent.
        foreach ([
            '../../../etc/passwd',
            'ar/../../config',
            '%2e%2e%2fetc',
            str_repeat('a', 500),
        ] as $hostile) {
            $response = $this->actingAsUser($this->owner)
                ->withHeader('Accept-Language', $hostile)
                ->postJson('/api/packages', []);

            // Still a clean 422 in the default language — never a 500, and
            // never a file read.
            $this->assertApiError($response, 422);
            $this->assertStringContainsString('required', $response->json('errors.name.0'));
        }
    }

    #[Test]
    public function a_super_admin_omitting_the_company_is_told_so_in_arabic(): void
    {
        // The Form Request catches this before the service does, and names the
        // field — which is the more useful of the two messages.
        $response = $this->actingAsUser($this->superAdmin())
            ->withHeader('Accept-Language', 'ar')
            ->postJson('/api/packages', ['name' => 'باقة']);

        $this->assertApiError($response, 422);
        $this->assertSame('حقل الشركة مطلوب.', $response->json('errors.company_id.0'));
    }

    #[Test]
    public function the_services_own_messages_are_translated_too(): void
    {
        /*
         * TenantContext is the backstop for callers that do not go through a
         * Form Request — the MCP tools, when they arrive. Reached directly
         * here, since no HTTP route can get past the validator to it.
         */
        // Authenticates the guard directly: actingAsUser issues a bearer token
        // for HTTP calls, and there is no HTTP call here.
        $this->actingAs($this->superAdmin(), 'sanctum');
        app()->setLocale('ar');

        try {
            app(\App\Support\TenantContext::class)->resolveCompanyIdForWrite(null);
            $this->fail('Expected a validation failure.');
        } catch (\Illuminate\Validation\ValidationException $exception) {
            $this->assertStringContainsString(
                'المشرف العام',
                $exception->errors()['company_id'][0],
            );
        }
    }

    #[Test]
    public function a_failed_login_is_explained_in_arabic(): void
    {
        $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $response = $this->withHeader('Accept-Language', 'ar')->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'wrong-password-1',
        ]);

        $this->assertApiError($response, 422);
        $this->assertStringContainsString('غير مطابقة', $response->json('errors.email.0'));
    }

    #[Test]
    public function the_locale_does_not_leak_between_requests(): void
    {
        $this->actingAsUser($this->owner);

        $arabic = $this->withHeader('Accept-Language', 'ar')->postJson('/api/packages', []);
        $this->assertStringContainsString('مطلوب', $arabic->json('errors.name.0'));

        // A later request without the header must not inherit the previous
        // one's locale from the container.
        $this->flushHeaders();
        $english = $this->postJson('/api/packages', []);

        $this->assertStringContainsString('required', $english->json('errors.name.0'));
    }
}
