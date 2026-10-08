<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\PersonalAccessToken;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    #[Test]
    public function a_valid_login_returns_a_token_and_the_user(): void
    {
        $company = $this->company();
        $owner = $this->owner($company, ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
        ]);

        $this->assertApiSuccess($response)
            ->assertJsonPath('data.user.id', $owner->id)
            ->assertJsonPath('data.user.role', 'owner')
            ->assertJsonPath('data.user.company_id', $company->id);

        $this->assertIsString($response->json('data.token'));
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    #[Test]
    public function a_sign_in_token_always_carries_an_expiry(): void
    {
        $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        // The global setting is what an operator is most likely to leave
        // blank, and for a long time blank meant a session token that never
        // expired — so a copy taken from a log or a backup kept working for
        // ever. The browser lifetime has to stand on its own without it.
        config(['sanctum.expiration' => null, 'sanctum.session_expiration' => 480]);

        $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
        ])->assertOk();

        $token = PersonalAccessToken::query()->sole();

        $this->assertNotNull($token->expires_at, 'A sign-in token was issued with no expiry.');
        $this->assertTrue($token->expires_at->between(now()->addMinutes(479), now()->addMinutes(481)));
    }

    #[Test]
    public function a_shorter_global_expiry_wins_over_the_session_lifetime(): void
    {
        $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        config(['sanctum.expiration' => 30, 'sanctum.session_expiration' => 480]);

        $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
        ])->assertOk();

        $token = PersonalAccessToken::query()->sole();

        $this->assertTrue($token->expires_at->between(now()->addMinutes(29), now()->addMinutes(31)));
    }

    #[Test]
    public function the_login_response_never_contains_the_password_hash(): void
    {
        $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
        ]);

        $body = $response->getContent();

        $this->assertStringNotContainsString('password', $body);
        $this->assertStringNotContainsString('$2y$', $body);
        $this->assertArrayNotHasKey('password', $response->json('data.user'));
    }

    #[Test]
    public function a_wrong_password_is_rejected(): void
    {
        $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'wrong-password-1',
        ]);

        $this->assertApiError($response, 422);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    #[Test]
    public function an_unknown_address_fails_exactly_like_a_wrong_password(): void
    {
        $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $unknown = $this->postJson('/api/auth/login', [
            'email' => 'nobody@example.test',
            'password' => 'correct-horse-7',
        ]);

        $wrongPassword = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'wrong-password-1',
        ]);

        // Identical shape and message, so the endpoint cannot be used to
        // enumerate which addresses have accounts.
        $this->assertSame($unknown->status(), $wrongPassword->status());
        $this->assertSame($unknown->json('message'), $wrongPassword->json('message'));
        $this->assertSame($unknown->json('errors'), $wrongPassword->json('errors'));
    }

    #[Test]
    public function a_disabled_account_cannot_log_in(): void
    {
        $this->owner($this->company(), [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
        ]);

        $this->assertApiError($response, 422);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    #[Test]
    public function a_user_of_a_disabled_company_cannot_log_in(): void
    {
        $company = $this->company(['is_active' => false]);
        $this->owner($company, ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
        ]);

        $this->assertApiError($response, 422);
    }

    #[Test]
    public function login_requires_an_email_and_a_password(): void
    {
        $this->assertApiError($this->postJson('/api/auth/login', []), 422)
            ->assertJsonStructure(['errors' => ['email', 'password']]);
    }

    #[Test]
    public function protected_endpoints_reject_an_unauthenticated_caller(): void
    {
        foreach ([
            ['get', '/api/auth/me'],
            ['get', '/api/packages'],
            ['post', '/api/packages'],
            ['get', '/api/hotels'],
            ['get', '/api/buses'],
            ['get', '/api/employees'],
            ['get', '/api/companies'],
            ['get', '/api/permissions'],
            ['get', '/api/audit-logs'],
        ] as [$method, $url]) {
            $response = $this->{$method.'Json'}($url);

            $this->assertApiError($response, 401);
        }
    }

    #[Test]
    public function an_api_request_without_an_accept_header_still_gets_a_401(): void
    {
        // A browser opening an API URL directly, or a client that forgot the
        // header, must not be answered with a 500 from a redirect to a login
        // page this application does not have.
        $response = $this->get('/api/packages');

        $response->assertStatus(401);
        $this->assertSame('application/json', explode(';', (string) $response->headers->get('Content-Type'))[0]);
        $response->assertJson(['success' => false]);
    }

    #[Test]
    public function a_garbage_token_is_rejected(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer not-a-real-token')
            ->getJson('/api/auth/me');

        $this->assertApiError($response, 401);
    }

    #[Test]
    public function me_returns_the_account_and_its_effective_permissions(): void
    {
        $company = $this->company();
        $employee = $this->employee($company, [Permissions::PACKAGES_VIEW, Permissions::HOTELS_VIEW]);

        $response = $this->actingAsUser($employee)->getJson('/api/auth/me');

        $this->assertApiSuccess($response)
            ->assertJsonPath('data.user.id', $employee->id)
            ->assertJsonPath('data.user.role', 'employee');

        $this->assertEqualsCanonicalizing(
            [Permissions::HOTELS_VIEW, Permissions::PACKAGES_VIEW],
            $response->json('data.permissions'),
        );
    }

    #[Test]
    public function an_owner_has_every_company_permission(): void
    {
        $owner = $this->owner($this->company());

        $response = $this->actingAsUser($owner)->getJson('/api/auth/me');

        $this->assertEqualsCanonicalizing(
            Permissions::all(),
            $response->json('data.permissions'),
        );
    }

    #[Test]
    public function logout_revokes_only_the_current_token(): void
    {
        $owner = $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $first = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test', 'password' => 'correct-horse-7', 'device_name' => 'dashboard',
        ])->json('data.token');

        $second = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test', 'password' => 'correct-horse-7', 'device_name' => 'mcp',
        ])->json('data.token');

        $this->assertApiSuccess(
            $this->withToken($first)->postJson('/api/auth/logout')
        );

        $this->assertApiError(
            $this->nextRequest()->withToken($first)->getJson('/api/auth/me'),
            401
        );

        // The second session is untouched.
        $this->assertApiSuccess(
            $this->nextRequest()->withToken($second)->getJson('/api/auth/me')
        );

        $this->assertSame(1, PersonalAccessToken::query()->count());
    }

    #[Test]
    public function logout_all_revokes_every_token(): void
    {
        $owner = $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $first = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test', 'password' => 'correct-horse-7',
        ])->json('data.token');

        $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test', 'password' => 'correct-horse-7',
        ]);

        $this->withToken($first)->postJson('/api/auth/logout-all');

        $this->assertSame(0, PersonalAccessToken::query()->count());
    }

    #[Test]
    public function an_accented_spelling_of_an_address_shares_the_throttle_with_the_real_one(): void
    {
        $owner = $this->owner($this->company(), [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
        ]);

        /*
         * The users table collates utf8mb4_unicode_ci, which ignores accents,
         * so `öwner@example.test` finds this very row. mb_strtolower does not
         * ignore accents, so keying the throttle on the typed string gave that
         * spelling a bucket of its own: five guesses, change an accent, five
         * more, for as many accents as the alphabet has. Keying on the account
         * the address resolves to closes it by construction.
         */
        $this->assertTrue(
            User::query()->where('email', 'öwner@example.test')->whereKey($owner->id)->exists(),
            'The database no longer folds accents, so this test is checking nothing. '
            .'Re-derive the throttle key before deleting it.',
        );

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/auth/login', [
                'email' => 'owner@example.test',
                'password' => 'wrong-password-1',
            ])->assertStatus(422);
        }

        $this->assertApiError(
            $this->postJson('/api/auth/login', [
                'email' => 'öwner@example.test',
                'password' => 'wrong-password-1',
            ]),
            429,
        );
    }

    #[Test]
    public function repeated_failed_logins_are_rate_limited(): void
    {

        $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/auth/login', [
                'email' => 'owner@example.test',
                'password' => 'wrong-password-1',
            ])->assertStatus(422);
        }

        $this->assertApiError(
            $this->postJson('/api/auth/login', [
                'email' => 'owner@example.test',
                'password' => 'correct-horse-7',
            ]),
            429
        );
    }

    #[Test]
    public function logins_are_recorded_in_the_audit_trail_without_the_password(): void
    {
        $owner = $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-horse-7',
        ]);

        $log = AuditLog::query()->where('action', 'login')->sole();

        $this->assertSame($owner->id, $log->user_id);
        $this->assertSame('owner', $log->actor_role);
        $this->assertStringNotContainsString('correct-horse-7', json_encode($log->metadata));
    }

    #[Test]
    public function a_failed_login_is_recorded_without_the_attempted_password(): void
    {
        $this->owner($this->company(), ['email' => 'owner@example.test', 'password' => 'correct-horse-7']);

        $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'hunter2-the-secret',
        ]);

        $log = AuditLog::query()->where('action', 'login_failed')->sole();

        $this->assertNull($log->user_id);
        $this->assertSame('owner@example.test', $log->metadata['email']);
        $this->assertStringNotContainsString('hunter2-the-secret', json_encode($log->metadata));
    }

    #[Test]
    public function a_disabled_account_with_a_live_token_is_locked_out(): void
    {
        $owner = $this->owner($this->company());
        $token = $this->tokenFor($owner);

        $this->assertApiSuccess($this->withToken($token)->getJson('/api/packages'));

        // Disabling the account takes effect on the next request, without
        // waiting for the token to expire or be revoked.
        $owner->forceFill(['is_active' => false])->save();

        $this->assertApiError($this->nextRequest()->withToken($token)->getJson('/api/packages'), 403);
    }

    #[Test]
    public function disabling_a_company_locks_out_its_users(): void
    {
        $company = $this->company();
        $owner = $this->owner($company);
        $token = $this->tokenFor($owner);

        $this->assertApiSuccess($this->withToken($token)->getJson('/api/packages'));

        $company->forceFill(['is_active' => false])->save();

        $this->assertApiError($this->nextRequest()->withToken($token)->getJson('/api/packages'), 403);
    }

    #[Test]
    public function deleting_a_company_locks_out_its_users(): void
    {
        $company = $this->company();
        $owner = $this->owner($company);
        $token = $this->tokenFor($owner);

        $this->assertApiSuccess($this->withToken($token)->getJson('/api/packages'));

        $company->delete();   // soft delete

        $this->assertApiError($this->nextRequest()->withToken($token)->getJson('/api/packages'), 403);
    }

    #[Test]
    public function a_super_admin_is_not_attached_to_a_company(): void
    {
        $admin = $this->superAdmin();

        $this->assertNull($admin->company_id);
        $this->assertTrue($admin->isSuperAdmin());

        $response = $this->actingAsUser($admin)->getJson('/api/auth/me');

        $this->assertApiSuccess($response)->assertJsonPath('data.user.company_id', null);
    }
}
