<?php

namespace Tests\Feature\Auth;

use App\Models\Company;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * `POST /api/auth/password` — the account holder changing their own.
 *
 * The reason this endpoint exists is that the person with the most urgent
 * reason to change a password was previously the one who could not: an
 * employee had to ask their owner, and an owner had to ask a super admin.
 *
 * It is also the only place in the system where someone changes a credential
 * without a policy standing over them, so the proof that it is safe is
 * entirely in these tests.
 */
class ChangeOwnPasswordTest extends TestCase
{
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
    }

    private function staff(string $password = 'the-old-password-7'): User
    {
        return $this->employee($this->company, [Permissions::PACKAGES_VIEW], [
            'email' => 'staff@example.test',
            'password' => $password,
        ]);
    }

    // -- What it is for ------------------------------------------------------

    #[Test]
    public function an_employee_can_change_their_own_password(): void
    {
        $staff = $this->staff();

        $response = $this->actingAsUser($staff)->postJson('/api/auth/password', [
            'current_password' => 'the-old-password-7',
            'password' => 'a-brand-new-one-9',
            'password_confirmation' => 'a-brand-new-one-9',
        ]);

        $this->assertApiSuccess($response);
        $this->assertTrue(Hash::check('a-brand-new-one-9', $staff->fresh()->password));
    }

    #[Test]
    public function an_owner_can_too_without_asking_anybody(): void
    {
        $owner = $this->owner($this->company, ['password' => 'the-old-password-7']);

        $this->assertApiSuccess(
            $this->actingAsUser($owner)->postJson('/api/auth/password', [
                'current_password' => 'the-old-password-7',
                'password' => 'a-brand-new-one-9',
                'password_confirmation' => 'a-brand-new-one-9',
            ])
        );

        $this->assertTrue(Hash::check('a-brand-new-one-9', $owner->fresh()->password));
    }

    #[Test]
    public function the_new_password_actually_signs_you_in(): void
    {
        $staff = $this->staff();

        $this->actingAsUser($staff)->postJson('/api/auth/password', [
            'current_password' => 'the-old-password-7',
            'password' => 'a-brand-new-one-9',
            'password_confirmation' => 'a-brand-new-one-9',
        ])->assertOk();

        $this->assertApiSuccess(
            $this->nextRequest()->postJson('/api/auth/login', [
                'email' => 'staff@example.test',
                'password' => 'a-brand-new-one-9',
            ])
        );
    }

    // -- The current password is the only proof of who is asking ------------

    #[Test]
    public function the_current_password_is_required(): void
    {
        $staff = $this->staff();

        /*
         * A valid token is not proof that the person holding it owns the
         * account — a borrowed laptop, a session left open and a stolen
         * cookie all present one. Without this check, anyone who got hold of
         * a session could lock the real owner out of it permanently.
         */
        $this->assertApiError(
            $this->actingAsUser($staff)->postJson('/api/auth/password', [
                'password' => 'a-brand-new-one-9',
                'password_confirmation' => 'a-brand-new-one-9',
            ]),
            422,
        );

        $this->assertTrue(Hash::check('the-old-password-7', $staff->fresh()->password));
    }

    #[Test]
    public function a_wrong_current_password_changes_nothing(): void
    {
        $staff = $this->staff();

        $this->assertApiError(
            $this->actingAsUser($staff)->postJson('/api/auth/password', [
                'current_password' => 'not-the-right-one-1',
                'password' => 'a-brand-new-one-9',
                'password_confirmation' => 'a-brand-new-one-9',
            ]),
            422,
        );

        $this->assertTrue(Hash::check('the-old-password-7', $staff->fresh()->password));
    }

    #[Test]
    public function a_mistyped_confirmation_changes_nothing(): void
    {
        $staff = $this->staff();

        $this->assertApiError(
            $this->actingAsUser($staff)->postJson('/api/auth/password', [
                'current_password' => 'the-old-password-7',
                'password' => 'a-brand-new-one-9',
                'password_confirmation' => 'a-brand-new-one-8',
            ]),
            422,
        );

        $this->assertTrue(Hash::check('the-old-password-7', $staff->fresh()->password));
    }

    #[Test]
    public function the_password_policy_still_applies(): void
    {
        $staff = $this->staff();

        $this->assertApiError(
            $this->actingAsUser($staff)->postJson('/api/auth/password', [
                'current_password' => 'the-old-password-7',
                'password' => 'short',
                'password_confirmation' => 'short',
            ]),
            422,
        );
    }

    #[Test]
    public function setting_it_back_to_the_same_password_is_refused(): void
    {
        $staff = $this->staff();

        $this->assertApiError(
            $this->actingAsUser($staff)->postJson('/api/auth/password', [
                'current_password' => 'the-old-password-7',
                'password' => 'the-old-password-7',
                'password_confirmation' => 'the-old-password-7',
            ]),
            422,
        );
    }

    // -- It has to end the access it was meant to end -----------------------

    #[Test]
    public function every_other_session_is_revoked(): void
    {
        $staff = $this->staff();

        // The session somebody else is holding.
        $stolen = $this->tokenFor($staff);
        $mcp = $staff->createToken('mcp', ['mcp'])->plainTextToken;

        $this->actingAsUser($staff)->postJson('/api/auth/password', [
            'current_password' => 'the-old-password-7',
            'password' => 'a-brand-new-one-9',
            'password_confirmation' => 'a-brand-new-one-9',
        ])->assertOk();

        /*
         * The usual reason somebody changes their own password is that they
         * think someone else has it. A change that leaves the other sessions
         * alive does not end the access it was meant to end.
         */
        $this->assertApiError(
            $this->nextRequest()->withToken($stolen)->getJson('/api/auth/me'),
            401,
        );

        $this->assertApiError(
            $this->nextRequest()->withToken($mcp)->getJson('/api/auth/me'),
            401,
        );
    }

    #[Test]
    public function the_caller_gets_a_working_replacement_token(): void
    {
        $staff = $this->staff();

        $token = $this->actingAsUser($staff)->postJson('/api/auth/password', [
            'current_password' => 'the-old-password-7',
            'password' => 'a-brand-new-one-9',
            'password_confirmation' => 'a-brand-new-one-9',
        ])->json('data.token');

        $this->assertIsString($token);

        // Exactly one survives: the one just issued.
        $this->assertSame(1, PersonalAccessToken::query()->where('tokenable_id', $staff->id)->count());

        $this->assertApiSuccess(
            $this->nextRequest()->withToken($token)->getJson('/api/auth/me')
        );
    }

    // -- Boundaries ----------------------------------------------------------

    #[Test]
    public function it_changes_your_own_password_and_nobody_elses(): void
    {
        $staff = $this->staff();
        $colleague = $this->employee($this->company, [], ['password' => 'their-password-7']);

        $this->actingAsUser($staff)->postJson('/api/auth/password', [
            'current_password' => 'the-old-password-7',
            'password' => 'a-brand-new-one-9',
            'password_confirmation' => 'a-brand-new-one-9',
            // There is no field for this, but somebody will try.
            'user_id' => $colleague->id,
            'email' => 'attacker@example.test',
        ])->assertOk();

        $colleague->refresh();

        $this->assertTrue(Hash::check('their-password-7', $colleague->password));
        $this->assertSame('staff@example.test', $staff->fresh()->email);
    }

    #[Test]
    public function a_signed_out_caller_cannot_reach_it(): void
    {
        $this->staff();

        $this->postJson('/api/auth/password', [
            'current_password' => 'the-old-password-7',
            'password' => 'a-brand-new-one-9',
            'password_confirmation' => 'a-brand-new-one-9',
        ])->assertStatus(401);
    }

    #[Test]
    public function a_suspended_account_cannot_reach_it(): void
    {
        $staff = $this->staff();
        $token = $this->tokenFor($staff);

        $staff->forceFill(['is_active' => false])->save();

        $this->assertApiError(
            $this->nextRequest()->withToken($token)->postJson('/api/auth/password', [
                'current_password' => 'the-old-password-7',
                'password' => 'a-brand-new-one-9',
                'password_confirmation' => 'a-brand-new-one-9',
            ]),
            403,
        );
    }

    #[Test]
    public function the_password_never_reaches_the_audit_trail(): void
    {
        $staff = $this->staff();

        $this->actingAsUser($staff)->postJson('/api/auth/password', [
            'current_password' => 'the-old-password-7',
            'password' => 'a-brand-new-one-9',
            'password_confirmation' => 'a-brand-new-one-9',
        ])->assertOk();

        $trail = \App\Models\AuditLog::query()->get()->toJson();

        $this->assertStringNotContainsString('a-brand-new-one-9', $trail);
        $this->assertStringNotContainsString('the-old-password-7', $trail);
    }
}
