<?php

namespace Tests\Feature\Security;

use App\Enums\UserRole;
use App\Models\Company;
use App\Models\Package;
use App\Models\User;
use App\Support\Permissions;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Privileged fields must be unreachable from request input, whichever client
 * sends it.
 *
 * The pattern throughout is that the hostile value is *ignored* rather than
 * rejected: the operation succeeds with the correct value, so a caller
 * probing for a validation error learns nothing either way.
 */
class MassAssignmentTest extends TestCase
{
    private Company $company;

    private Company $other;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->other = $this->company();
    }

    #[Test]
    public function an_employee_cannot_be_created_with_an_elevated_role(): void
    {
        $response = $this->actingAsUser($this->owner($this->company))->postJson('/api/employees', [
            'name' => 'Trojan',
            'email' => 'trojan@example.test',
            'password' => 'a-good-password-9',
            'role' => 'super_admin',
            'is_admin' => true,
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.role', 'employee');

        $created = User::query()->where('email', 'trojan@example.test')->sole();

        $this->assertSame(UserRole::Employee, $created->role);
        $this->assertSame($this->company->id, $created->company_id);
    }

    #[Test]
    public function an_employee_cannot_be_promoted_through_an_update(): void
    {
        $employee = $this->employee($this->company);

        $response = $this->actingAsUser($this->owner($this->company))
            ->putJson("/api/employees/{$employee->id}", [
                'name' => 'Still An Employee',
                'role' => 'owner',
                'company_id' => $this->other->id,
            ]);

        $this->assertApiSuccess($response);

        $employee->refresh();

        $this->assertSame(UserRole::Employee, $employee->role);
        $this->assertSame($this->company->id, $employee->company_id);
        $this->assertSame('Still An Employee', $employee->name);
    }

    #[Test]
    public function an_employee_cannot_grant_themselves_permissions(): void
    {
        // The strongest employee-level permission there is, and it still does
        // not reach the permission system.
        $employee = $this->employee($this->company, [
            Permissions::EMPLOYEES_VIEW,
            Permissions::EMPLOYEES_CREATE,
            Permissions::EMPLOYEES_UPDATE,
        ]);

        $response = $this->actingAsUser($employee)
            ->putJson("/api/employees/{$employee->id}/permissions", [
                'permissions' => Permissions::all(),
            ]);

        $this->assertApiError($response, 403);
        $this->assertCount(3, $employee->fresh()->permissionNames());
    }

    #[Test]
    public function an_employee_cannot_grant_permissions_to_a_colleague(): void
    {
        $actor = $this->employee($this->company, [
            Permissions::EMPLOYEES_VIEW,
            Permissions::EMPLOYEES_UPDATE,
        ]);
        $colleague = $this->employee($this->company);

        $response = $this->actingAsUser($actor)
            ->putJson("/api/employees/{$colleague->id}/permissions", [
                'permissions' => [Permissions::PACKAGES_DELETE],
            ]);

        $this->assertApiError($response, 403);
        $this->assertCount(0, $colleague->fresh()->permissionNames());
    }

    #[Test]
    public function an_employee_with_create_permission_cannot_seed_a_new_account_with_permissions(): void
    {
        $actor = $this->employee($this->company, [Permissions::EMPLOYEES_CREATE]);

        $response = $this->actingAsUser($actor)->postJson('/api/employees', [
            'name' => 'Accomplice',
            'email' => 'accomplice@example.test',
            'password' => 'a-good-password-9',
            'permissions' => Permissions::all(),
        ]);

        $this->assertApiError($response, 403);
        $this->assertDatabaseMissing('users', ['email' => 'accomplice@example.test']);
    }

    #[Test]
    public function an_owner_may_grant_permissions(): void
    {
        $employee = $this->employee($this->company);

        $response = $this->actingAsUser($this->owner($this->company))
            ->putJson("/api/employees/{$employee->id}/permissions", [
                'permissions' => [Permissions::PACKAGES_VIEW, Permissions::PACKAGES_CREATE],
            ]);

        $this->assertApiSuccess($response);
        $this->assertEqualsCanonicalizing(
            [Permissions::PACKAGES_CREATE, Permissions::PACKAGES_VIEW],
            $employee->fresh()->permissionNames()->all(),
        );
    }

    #[Test]
    public function an_invented_permission_name_is_rejected(): void
    {
        $employee = $this->employee($this->company);

        $response = $this->actingAsUser($this->owner($this->company))
            ->putJson("/api/employees/{$employee->id}/permissions", [
                'permissions' => ['packages.view', 'system.root', '*'],
            ]);

        $this->assertApiError($response, 422);
        $this->assertCount(0, $employee->fresh()->permissionNames());
    }

    #[Test]
    public function a_package_payload_cannot_set_its_own_id_or_timestamps(): void
    {
        $existing = Package::factory()->forCompany($this->company)->create();

        $response = $this->actingAsUser($this->owner($this->company))->postJson('/api/packages', [
            'name' => 'Injected',
            'id' => $existing->id,
            'created_at' => '1990-01-01 00:00:00',
            'image_path' => '../../../etc/passwd',
        ]);

        $this->assertApiSuccess($response, 201);

        $created = Package::query()->where('name', 'Injected')->sole();

        $this->assertNotSame($existing->id, $created->id);
        $this->assertNull($created->image_path);
        $this->assertTrue($created->created_at->isToday());
    }

    #[Test]
    public function an_owner_cannot_create_an_owner_or_a_super_admin_anywhere(): void
    {
        $this->actingAsUser($this->owner($this->company));

        // There is no company-facing endpoint that assigns these roles at all.
        $this->assertApiError(
            $this->postJson("/api/companies/{$this->company->id}/owners", [
                'name' => 'Second Owner',
                'email' => 'second@example.test',
                'password' => 'a-good-password-9',
            ]),
            403
        );

        $this->assertSame(1, User::query()->where('role', UserRole::Owner)->count());
        $this->assertSame(0, User::query()->where('role', UserRole::SuperAdmin)->count());
    }

    #[Test]
    public function the_mcp_token_ability_does_not_widen_what_an_account_may_do(): void
    {
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        // Same account, same permissions, arriving over the agent path.
        $this->actingAsMcp($employee);

        $this->assertApiSuccess($this->getJson('/api/packages'));
        $this->assertApiError($this->postJson('/api/packages', ['name' => 'By agent']), 403);
        $this->assertApiError($this->getJson('/api/companies'), 403);
        $this->assertApiError($this->getJson('/api/employees'), 403);
    }

    #[Test]
    public function an_agent_cannot_reach_another_tenant_by_asking_nicely(): void
    {
        $theirs = Package::factory()->forCompany($this->other)->create();

        // Everything an agent might be talked into sending, at once.
        $response = $this->actingAsMcp($this->owner($this->company))->postJson('/api/packages', [
            'name' => 'Ramadan Umrah',
            'company_id' => $this->other->id,
            'role' => 'super_admin',
            'permissions' => ['*'],
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.company_id', $this->company->id);

        $this->assertApiError($this->getJson("/api/packages/{$theirs->id}"), 404);
    }
}
