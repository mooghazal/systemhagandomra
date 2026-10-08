<?php

namespace Tests\Feature\Security;

use App\Models\Company;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * `employees.permissions` lets an owner delegate the granting of permissions
 * to a manager.
 *
 * It is the one permission in the catalogue that is about the permission
 * system itself, which makes it the one with a route back to every other.
 * Two rules keep it bounded — never on your own account, never beyond what you
 * already hold — and every test here is an attempt to get round one of them.
 */
class DelegatedGrantTest extends TestCase
{
    private Company $company;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->owner = $this->owner($this->company);
    }

    /** A manager who may grant, and holds the packages group. */
    private function manager(array $extra = []): User
    {
        return $this->employee($this->company, [
            Permissions::EMPLOYEES_PERMISSIONS,
            Permissions::EMPLOYEES_VIEW,
            Permissions::PACKAGES_VIEW,
            Permissions::PACKAGES_CREATE,
            Permissions::PACKAGES_UPDATE,
            Permissions::PACKAGES_DELETE,
            ...$extra,
        ]);
    }

    private function permissionsOf(User $user): array
    {
        return $user->fresh()->permissionNames()->sort()->values()->all();
    }

    // -- What it is for ------------------------------------------------------

    #[Test]
    public function a_manager_can_grant_a_colleague_permissions_they_hold_themselves(): void
    {
        $manager = $this->manager();
        $staff = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        $this->assertApiSuccess(
            $this->actingAsUser($manager)->putJson("/api/employees/{$staff->id}/permissions", [
                'permissions' => [
                    Permissions::PACKAGES_VIEW,
                    Permissions::PACKAGES_UPDATE,
                    Permissions::PACKAGES_DELETE,
                ],
            ])
        );

        $this->assertSame(
            ['packages.delete', 'packages.update', 'packages.view'],
            $this->permissionsOf($staff),
        );
    }

    #[Test]
    public function a_manager_can_revoke_what_they_granted(): void
    {
        $manager = $this->manager();
        $staff = $this->employee($this->company, [
            Permissions::PACKAGES_VIEW,
            Permissions::PACKAGES_DELETE,
        ]);

        $this->assertApiSuccess(
            $this->actingAsUser($manager)->putJson("/api/employees/{$staff->id}/permissions", [
                'permissions' => [Permissions::PACKAGES_VIEW],
            ])
        );

        $this->assertSame(['packages.view'], $this->permissionsOf($staff));
    }

    // -- Rule one: never on your own account ---------------------------------

    #[Test]
    public function a_manager_cannot_grant_themselves_anything(): void
    {
        $manager = $this->manager();

        $this->assertApiError(
            $this->actingAsUser($manager)->putJson("/api/employees/{$manager->id}/permissions", [
                'permissions' => Permissions::all(),
            ]),
            403,
        );

        $this->assertNotContains(Permissions::HOTELS_DELETE, $this->permissionsOf($manager));
    }

    #[Test]
    public function a_manager_cannot_quietly_keep_their_own_set_while_editing_it(): void
    {
        // Even a no-op write to your own account is refused, so there is no
        // "I only reordered it" path to probe the rule with.
        $manager = $this->manager();

        $this->assertApiError(
            $this->actingAsUser($manager)->putJson("/api/employees/{$manager->id}/permissions", [
                'permissions' => $this->permissionsOf($manager),
            ]),
            403,
        );
    }

    // -- Rule two: never beyond what you hold --------------------------------

    #[Test]
    public function a_manager_cannot_grant_a_permission_they_do_not_hold(): void
    {
        $manager = $this->manager();
        $staff = $this->employee($this->company, []);

        $this->assertApiError(
            $this->actingAsUser($manager)->putJson("/api/employees/{$staff->id}/permissions", [
                'permissions' => [Permissions::HOTELS_DELETE],
            ]),
            403,
        );

        $this->assertSame([], $this->permissionsOf($staff));
    }

    #[Test]
    public function a_manager_cannot_smuggle_one_unheld_permission_in_with_held_ones(): void
    {
        $manager = $this->manager();
        $staff = $this->employee($this->company, []);

        $this->assertApiError(
            $this->actingAsUser($manager)->putJson("/api/employees/{$staff->id}/permissions", [
                'permissions' => [
                    Permissions::PACKAGES_VIEW,
                    Permissions::PACKAGES_UPDATE,
                    Permissions::BUSES_DELETE,
                ],
            ]),
            403,
        );

        // All or nothing: the held ones must not land either.
        $this->assertSame([], $this->permissionsOf($staff));
    }

    #[Test]
    public function a_manager_cannot_pass_on_the_granting_permission_itself_unless_they_hold_it(): void
    {
        // They do hold it here, so this one is allowed — the chain stays
        // inside what the owner already delegated.
        $manager = $this->manager();
        $staff = $this->employee($this->company, []);

        $this->assertApiSuccess(
            $this->actingAsUser($manager)->putJson("/api/employees/{$staff->id}/permissions", [
                'permissions' => [Permissions::EMPLOYEES_PERMISSIONS],
            ])
        );

        // And the account it created cannot then exceed the manager either.
        $this->assertApiError(
            $this->nextRequest()->actingAsUser($staff->fresh())
                ->putJson("/api/employees/{$manager->id}/permissions", [
                    'permissions' => Permissions::all(),
                ]),
            403,
        );
    }

    #[Test]
    public function a_manager_cannot_touch_a_colleague_who_holds_more_than_they_do(): void
    {
        $manager = $this->manager();
        $senior = $this->employee($this->company, [
            Permissions::PACKAGES_VIEW,
            Permissions::HOTELS_DELETE,
        ]);

        /*
         * Saving replaces the whole set, so allowing this would let a manager
         * strip a colleague of something they could never grant back.
         */
        $this->assertApiError(
            $this->actingAsUser($manager)->putJson("/api/employees/{$senior->id}/permissions", [
                'permissions' => [Permissions::PACKAGES_VIEW],
            ]),
            403,
        );

        $this->assertContains(Permissions::HOTELS_DELETE, $this->permissionsOf($senior));
    }

    // -- The long way round --------------------------------------------------

    #[Test]
    public function a_manager_cannot_mint_a_new_account_more_privileged_than_themselves(): void
    {
        /*
         * Creating carries a password the creator chooses, so an unbounded
         * create would be an escalation with an extra step: make the account,
         * give it everything, sign in as it.
         */
        $manager = $this->manager([Permissions::EMPLOYEES_CREATE]);

        $this->assertApiError(
            $this->actingAsUser($manager)->postJson('/api/employees', [
                'name' => 'Puppet',
                'email' => 'puppet@example.test',
                'password' => 'a-known-password-9',
                'permissions' => [Permissions::HOTELS_DELETE],
            ]),
            403,
        );

        $this->assertDatabaseMissing('users', ['email' => 'puppet@example.test']);
    }

    #[Test]
    public function a_manager_may_still_create_an_account_within_their_own_set(): void
    {
        $manager = $this->manager([Permissions::EMPLOYEES_CREATE]);

        $this->assertApiSuccess(
            $this->actingAsUser($manager)->postJson('/api/employees', [
                'name' => 'Junior',
                'email' => 'junior@example.test',
                'password' => 'a-known-password-9',
                'permissions' => [Permissions::PACKAGES_VIEW],
            ]),
            201,
        );

        $created = User::query()->where('email', 'junior@example.test')->sole();

        $this->assertSame(['packages.view'], $this->permissionsOf($created));
    }

    // -- The credential powers stay where they were --------------------------

    #[Test]
    public function granting_permissions_does_not_carry_the_power_to_reset_a_password(): void
    {
        /*
         * managePermissions and manageCredentials were the same check until
         * granting became delegable. If they had stayed one check, this
         * manager could set a colleague's password, sign in as them and
         * inherit whatever they hold — the escalation every other rule here
         * exists to stop.
         */
        $manager = $this->manager([Permissions::EMPLOYEES_UPDATE]);
        $staff = $this->employee($this->company, [], ['password' => 'their-own-password-7']);

        $this->assertApiError(
            $this->actingAsUser($manager)->putJson("/api/employees/{$staff->id}", [
                'password' => 'chosen-by-the-manager-9',
            ]),
            403,
        );

        $this->assertTrue(Hash::check('their-own-password-7', $staff->fresh()->password));
    }

    #[Test]
    public function granting_permissions_does_not_carry_the_power_to_move_an_email_or_suspend(): void
    {
        $manager = $this->manager([Permissions::EMPLOYEES_UPDATE]);
        $staff = $this->employee($this->company, [], ['email' => 'theirs@example.test']);

        foreach ([['email' => 'attacker@example.test'], ['is_active' => false]] as $payload) {
            $this->assertApiError(
                $this->nextRequest()->actingAsUser($manager)
                    ->putJson("/api/employees/{$staff->id}", $payload),
                403,
            );
        }

        $staff->refresh();

        $this->assertSame('theirs@example.test', $staff->email);
        $this->assertTrue($staff->is_active);
    }

    // -- The boundaries that already existed stay ----------------------------

    #[Test]
    public function a_manager_cannot_grant_across_companies(): void
    {
        $manager = $this->manager();
        $stranger = $this->employee($this->company(), []);

        $this->assertApiError(
            $this->actingAsUser($manager)->putJson("/api/employees/{$stranger->id}/permissions", [
                'permissions' => [Permissions::PACKAGES_VIEW],
            ]),
            404,
        );
    }

    #[Test]
    public function a_manager_cannot_point_the_grant_endpoint_at_an_owner(): void
    {
        $manager = $this->manager();

        $this->assertApiError(
            $this->actingAsUser($manager)->putJson("/api/employees/{$this->owner->id}/permissions", [
                'permissions' => [Permissions::PACKAGES_VIEW],
            ]),
            404,
        );
    }

    #[Test]
    public function an_employee_without_the_permission_still_cannot_grant_at_all(): void
    {
        $plain = $this->employee($this->company, [
            Permissions::EMPLOYEES_VIEW,
            Permissions::EMPLOYEES_UPDATE,
            Permissions::PACKAGES_VIEW,
        ]);
        $staff = $this->employee($this->company, []);

        $this->assertApiError(
            $this->actingAsUser($plain)->putJson("/api/employees/{$staff->id}/permissions", [
                'permissions' => [Permissions::PACKAGES_VIEW],
            ]),
            403,
        );
    }

    #[Test]
    public function a_suspended_manager_grants_nothing(): void
    {
        $manager = $this->manager();
        $staff = $this->employee($this->company, []);
        $token = $this->tokenFor($manager);

        $manager->forceFill(['is_active' => false])->save();

        $this->assertApiError(
            $this->nextRequest()->withToken($token)
                ->putJson("/api/employees/{$staff->id}/permissions", [
                    'permissions' => [Permissions::PACKAGES_VIEW],
                ]),
            403,
        );
    }

    #[Test]
    public function the_owner_is_unaffected_by_any_of_this(): void
    {
        $staff = $this->employee($this->company, []);

        $this->assertApiSuccess(
            $this->actingAsUser($this->owner)->putJson("/api/employees/{$staff->id}/permissions", [
                'permissions' => Permissions::all(),
            ])
        );

        $this->assertCount(count(Permissions::all()), $this->permissionsOf($staff));
    }
}
