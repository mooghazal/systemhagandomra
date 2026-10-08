<?php

namespace Tests\Feature\Security;

use App\Models\Company;
use App\Models\Package;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Two attacks a security review raised, checked properly.
 *
 * Both start from inside a company — an employee who already has a legitimate
 * account and one permission — which is the realistic case. An outsider is
 * stopped by authentication; a colleague is not.
 */
class EscalationTest extends TestCase
{
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
    }

    // -- Account takeover via a colleague's credentials -----------------------

    #[Test]
    public function an_employee_cannot_take_over_a_colleagues_account_by_resetting_their_password(): void
    {
        /*
         * The attack: `employees.update` is meant for maintaining colleagues'
         * details. If it also permits changing their password, then an
         * employee holding only that one permission can set a colleague's
         * password, sign in as them, and inherit every permission the
         * colleague has — turning one permission into all sixteen without ever
         * touching the permission system.
         */
        $attacker = $this->employee($this->company, [Permissions::EMPLOYEES_UPDATE]);

        $victim = $this->employee($this->company, Permissions::all(), [
            'email' => 'victim@example.test',
            'password' => 'victims-own-password',
        ]);

        $response = $this->actingAsUser($attacker)->putJson("/api/employees/{$victim->id}", [
            'password' => 'attacker-chosen-pw-9',
        ]);

        $victim->refresh();

        $this->assertTrue(
            Hash::check('victims-own-password', $victim->password),
            'An employee changed a colleague\'s password and can now sign in as them.',
        );

        $this->assertApiError($response, 403);
    }

    #[Test]
    public function an_employee_cannot_redirect_a_colleagues_account_to_their_own_address(): void
    {
        /*
         * The quieter half of the same attack: change the colleague's e-mail
         * to one the attacker controls, then use whatever account-recovery
         * exists. There is no password reset flow today, which is the only
         * reason this is not already an account takeover — so it must not
         * depend on that staying true.
         */
        $attacker = $this->employee($this->company, [Permissions::EMPLOYEES_UPDATE]);
        $victim = $this->employee($this->company, Permissions::all(), ['email' => 'victim@example.test']);

        $response = $this->actingAsUser($attacker)->putJson("/api/employees/{$victim->id}", [
            'email' => 'attacker-controlled@evil.test',
        ]);

        $this->assertSame('victim@example.test', $victim->fresh()->email);
        $this->assertApiError($response, 403);
    }

    #[Test]
    public function an_employee_cannot_lock_out_a_colleague(): void
    {
        $attacker = $this->employee($this->company, [Permissions::EMPLOYEES_UPDATE]);
        $victim = $this->employee($this->company, Permissions::all());

        $this->actingAsUser($attacker)->putJson("/api/employees/{$victim->id}", [
            'is_active' => false,
        ]);

        $this->assertTrue($victim->fresh()->is_active, 'An employee disabled a colleague.');
    }

    #[Test]
    public function an_employee_may_still_correct_a_colleagues_everyday_details(): void
    {
        // The permission has to keep meaning something, or the fix has simply
        // removed the feature.
        $attacker = $this->employee($this->company, [Permissions::EMPLOYEES_UPDATE]);
        $colleague = $this->employee($this->company, [], ['name' => 'Typo Name']);

        $response = $this->actingAsUser($attacker)->putJson("/api/employees/{$colleague->id}", [
            'name' => 'Corrected Name',
            'phone' => '+966500000000',
        ]);

        $this->assertApiSuccess($response);
        $this->assertSame('Corrected Name', $colleague->fresh()->name);
    }

    #[Test]
    public function an_owner_may_do_all_of_it(): void
    {
        // An owner already holds every permission in their company; withholding
        // these from them would be theatre, not security.
        $owner = $this->owner($this->company);
        $employee = $this->employee($this->company, [], ['email' => 'before@example.test']);

        $response = $this->actingAsUser($owner)->putJson("/api/employees/{$employee->id}", [
            'email' => 'after@example.test',
            'password' => 'owner-set-password-1',
            'is_active' => false,
        ]);

        $this->assertApiSuccess($response);

        $employee->refresh();

        $this->assertSame('after@example.test', $employee->email);
        $this->assertTrue(Hash::check('owner-set-password-1', $employee->password));
        $this->assertFalse($employee->is_active);
    }

    // -- A deleted company ----------------------------------------------------

    #[Test]
    public function a_user_whose_company_was_deleted_can_do_nothing(): void
    {
        $owner = $this->owner($this->company);
        $token = $this->tokenFor($owner);

        $this->assertApiSuccess($this->withToken($token)->getJson('/api/packages'));

        $this->company->delete();

        // Each of these is a separate request, as it would be in production.
        foreach ([
            ['getJson', '/api/packages', []],
            ['postJson', '/api/packages', ['name' => 'After deletion']],
            ['postJson', '/api/employees', [
                'name' => 'Ghost', 'email' => 'ghost@example.test', 'password' => 'a-good-password-9',
            ]],
        ] as [$method, $url, $body]) {
            $response = $this->nextRequest()->withToken($token)->{$method}($url, $body);

            $this->assertApiError($response, 403);
        }

        $this->assertSame(0, User::query()->where('email', 'ghost@example.test')->count());
        $this->assertSame(0, Package::query()->withoutGlobalScopes()->where('name', 'After deletion')->count());
    }

    #[Test]
    public function a_resource_whose_company_vanished_does_not_crash_the_api(): void
    {
        /*
         * A super admin can still see records belonging to a soft-deleted
         * company. The company relation then resolves to null, and a resource
         * that assumes otherwise answers with a 500 — turning a tidy-up into
         * an outage on an unrelated screen.
         */
        $package = Package::factory()->forCompany($this->company)->create();

        $this->company->delete();

        $response = $this->actingAsUser($this->superAdmin())
            ->getJson("/api/packages/{$package->id}");

        $this->assertNotSame(500, $response->status(), 'A missing company relation crashed the resource.');
        $this->assertApiSuccess($response)->assertJsonPath('data.company', null);
    }

    #[Test]
    public function a_super_admin_cannot_create_inside_a_deleted_company(): void
    {
        $this->company->delete();

        $this->actingAsUser($this->superAdmin());

        $this->assertApiError($this->postJson('/api/packages', [
            'name' => 'Ghost package',
            'company_id' => $this->company->id,
        ]), 422);

        $this->assertApiError($this->postJson('/api/employees', [
            'name' => 'Ghost',
            'email' => 'ghost@example.test',
            'password' => 'a-good-password-9',
            'company_id' => $this->company->id,
        ]), 422);

        // An orphan would be inert today but would come back as a live account
        // if the company were ever restored — and it holds the e-mail meanwhile.
        $this->assertDatabaseMissing('users', ['email' => 'ghost@example.test']);
    }

    // -- Sessions must end when credentials change ---------------------------

    #[Test]
    public function changing_a_password_ends_the_sessions_already_open(): void
    {
        /*
         * The standard answer to a compromised account is "reset their
         * password". If that leaves the intruder's token working, the answer
         * does nothing at the moment it matters most.
         */
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);
        $stolen = $this->tokenFor($employee);

        $this->assertApiSuccess($this->withToken($stolen)->getJson('/api/packages'));

        $this->actingAsUser($this->owner($this->company))
            ->putJson("/api/employees/{$employee->id}", ['password' => 'a-fresh-password-7']);

        $this->assertApiError(
            $this->nextRequest()->withToken($stolen)->getJson('/api/packages'),
            401,
        );
    }

    #[Test]
    public function suspending_an_employee_ends_their_sessions(): void
    {
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);
        $token = $this->tokenFor($employee);

        $this->actingAsUser($this->owner($this->company))
            ->putJson("/api/employees/{$employee->id}", ['is_active' => false]);

        $this->assertApiError($this->nextRequest()->withToken($token)->getJson('/api/packages'), 401);
    }

    #[Test]
    public function suspending_a_company_ends_every_session_in_it(): void
    {
        $owner = $this->owner($this->company);
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        $ownerToken = $this->tokenFor($owner);
        $employeeToken = $this->tokenFor($employee);

        $this->actingAsUser($this->superAdmin())
            ->putJson("/api/companies/{$this->company->id}", ['is_active' => false]);

        foreach ([$ownerToken, $employeeToken] as $token) {
            $this->assertApiError($this->nextRequest()->withToken($token)->getJson('/api/packages'), 401);
        }
    }

    // -- The kill switch must cover routes that consult no policy ------------

    #[Test]
    public function a_suspended_account_is_refused_even_where_no_policy_is_consulted(): void
    {
        /*
         * Gate::before only runs when something calls authorize(). These
         * routes read without asking a policy anything, so the kill switch
         * quietly did not reach them: a terminated employee kept a working
         * token and a live view of their old company.
         */
        $employee = $this->employee($this->company, Permissions::all());
        $token = $this->tokenFor($employee);

        foreach (['/api/stats', '/api/auth/me', '/api/permissions'] as $url) {
            $this->assertApiSuccess($this->nextRequest()->withToken($token)->getJson($url));
        }

        $employee->forceFill(['is_active' => false])->save();

        foreach (['/api/stats', '/api/auth/me', '/api/permissions'] as $url) {
            $this->assertApiError($this->nextRequest()->withToken($token)->getJson($url), 403);
        }
    }

    #[Test]
    public function the_dashboard_counters_respect_permissions(): void
    {
        // A count is small, but it still says how many staff a company has.
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        $response = $this->actingAsUser($employee)->getJson('/api/stats');

        $this->assertApiSuccess($response);
        $this->assertSame(['packages'], array_keys($response->json('data')));
    }

    #[Test]
    public function an_employee_with_no_permissions_sees_no_counters(): void
    {
        $response = $this->actingAsUser($this->employee($this->company))->getJson('/api/stats');

        $this->assertApiSuccess($response);
        $this->assertSame([], $response->json('data'));
    }

    // -- No account enumeration ----------------------------------------------

    #[Test]
    public function a_rejected_caller_cannot_learn_which_addresses_have_accounts(): void
    {
        /*
         * Validation used to run before authorisation, so an unauthorised
         * caller got 422 "already taken" for a real address and 403 for an
         * invented one — a reliable oracle over every account in the system,
         * the super admin's included.
         */
        $other = $this->company();
        $this->owner($other, ['email' => 'owner-elsewhere@example.test']);
        $this->superAdmin(['email' => 'root@example.test']);

        $this->actingAsUser($this->employee($this->company));   // holds nothing

        $statuses = [];

        foreach ([
            'owner-elsewhere@example.test',
            'root@example.test',
            'nobody-here@example.test',
        ] as $email) {
            $statuses[] = $this->postJson('/api/employees', [
                'name' => 'X',
                'email' => $email,
                'password' => 'a-good-password-9',
            ])->status();
        }

        // All three identical: the refusal says nothing about the address.
        $this->assertSame([403, 403, 403], $statuses);
    }
}
