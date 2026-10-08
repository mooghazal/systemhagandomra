<?php

namespace Tests\Feature\Security;

use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use App\Support\Permissions;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Permission enforcement per role.
 *
 * Super admins hold everything, owners hold everything inside their company,
 * and employees hold exactly what was granted — checked verb by verb, because
 * "can view" must not quietly imply "can delete".
 */
class AuthorizationTest extends TestCase
{
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
    }

    /**
     * @return array<string, array{0: string, 1: class-string, 2: string}>
     */
    public static function resources(): array
    {
        return [
            'packages' => ['packages', Package::class, 'packages'],
            'hotels' => ['hotels', Hotel::class, 'hotels'],
            'buses' => ['buses', Bus::class, 'buses'],
        ];
    }

    #[Test]
    #[DataProvider('resources')]
    public function an_employee_with_no_permissions_can_do_nothing(string $path, string $model): void
    {
        $record = $model::factory()->forCompany($this->company)->create();

        $this->actingAsUser($this->employee($this->company));

        $this->assertApiError($this->getJson("/api/{$path}"), 403);
        $this->assertApiError($this->getJson("/api/{$path}/{$record->id}"), 403);
        $this->assertApiError($this->postJson("/api/{$path}", ['name' => 'X']), 403);
        $this->assertApiError($this->putJson("/api/{$path}/{$record->id}", ['name' => 'X']), 403);
        $this->assertApiError($this->deleteJson("/api/{$path}/{$record->id}"), 403);
    }

    #[Test]
    #[DataProvider('resources')]
    public function view_permission_does_not_imply_write_permission(string $path, string $model, string $group): void
    {
        $record = $model::factory()->forCompany($this->company)->create(['name' => 'Original']);

        $this->actingAsUser($this->employee($this->company, ["{$group}.view"]));

        $this->assertApiSuccess($this->getJson("/api/{$path}"));
        $this->assertApiSuccess($this->getJson("/api/{$path}/{$record->id}"));

        $this->assertApiError($this->postJson("/api/{$path}", ['name' => 'X']), 403);
        $this->assertApiError($this->putJson("/api/{$path}/{$record->id}", ['name' => 'X']), 403);
        $this->assertApiError($this->deleteJson("/api/{$path}/{$record->id}"), 403);

        $this->assertSame('Original', $record->fresh()->name);
    }

    #[Test]
    #[DataProvider('resources')]
    public function create_permission_does_not_imply_update_or_delete(string $path, string $model, string $group): void
    {
        $record = $model::factory()->forCompany($this->company)->create();

        $this->actingAsUser($this->employee($this->company, ["{$group}.create"]));

        $this->assertApiSuccess($this->postJson("/api/{$path}", ['name' => 'Fresh']), 201);
        $this->assertApiError($this->putJson("/api/{$path}/{$record->id}", ['name' => 'X']), 403);
        $this->assertApiError($this->deleteJson("/api/{$path}/{$record->id}"), 403);
    }

    #[Test]
    #[DataProvider('resources')]
    public function delete_permission_allows_only_deleting(string $path, string $model, string $group): void
    {
        $record = $model::factory()->forCompany($this->company)->create();

        $this->actingAsUser($this->employee($this->company, ["{$group}.delete"]));

        $this->assertApiError($this->postJson("/api/{$path}", ['name' => 'X']), 403);
        $this->assertApiError($this->putJson("/api/{$path}/{$record->id}", ['name' => 'X']), 403);
        $this->assertApiSuccess($this->deleteJson("/api/{$path}/{$record->id}"));

        $this->assertSoftDeleted($record);
    }

    #[Test]
    #[DataProvider('resources')]
    public function an_owner_may_do_everything_in_their_own_company(string $path, string $model): void
    {
        $record = $model::factory()->forCompany($this->company)->create();

        $this->actingAsUser($this->owner($this->company));

        $this->assertApiSuccess($this->getJson("/api/{$path}"));
        $this->assertApiSuccess($this->postJson("/api/{$path}", ['name' => 'Owner made this']), 201);
        $this->assertApiSuccess($this->putJson("/api/{$path}/{$record->id}", ['name' => 'Renamed']));
        $this->assertApiSuccess($this->deleteJson("/api/{$path}/{$record->id}"));
    }

    #[Test]
    #[DataProvider('resources')]
    public function a_super_admin_may_do_everything_in_any_company(string $path, string $model): void
    {
        $other = $this->company();
        $record = $model::factory()->forCompany($other)->create();

        $this->actingAsUser($this->superAdmin());

        $this->assertApiSuccess($this->getJson("/api/{$path}/{$record->id}"));
        $this->assertApiSuccess($this->putJson("/api/{$path}/{$record->id}", ['name' => 'Admin renamed']));
        $this->assertApiSuccess($this->deleteJson("/api/{$path}/{$record->id}"));
    }

    // -- Employees -----------------------------------------------------------

    #[Test]
    public function employee_management_needs_the_matching_permission(): void
    {
        $target = $this->employee($this->company);
        $actor = $this->employee($this->company, [Permissions::EMPLOYEES_VIEW]);

        $this->actingAsUser($actor);

        $this->assertApiSuccess($this->getJson('/api/employees'));
        $this->assertApiSuccess($this->getJson("/api/employees/{$target->id}"));

        $this->assertApiError($this->postJson('/api/employees', [
            'name' => 'X', 'email' => 'x@example.test', 'password' => 'a-good-password-9',
        ]), 403);
        $this->assertApiError($this->putJson("/api/employees/{$target->id}", ['name' => 'X']), 403);
        $this->assertApiError($this->deleteJson("/api/employees/{$target->id}"), 403);
    }

    #[Test]
    public function an_employee_cannot_delete_their_own_account(): void
    {
        $actor = $this->employee($this->company, [Permissions::EMPLOYEES_DELETE]);

        $response = $this->actingAsUser($actor)->deleteJson("/api/employees/{$actor->id}");

        $this->assertApiError($response, 403);
        $this->assertDatabaseHas('users', ['id' => $actor->id]);
    }

    #[Test]
    public function the_employee_endpoints_cannot_be_turned_against_an_owner(): void
    {
        $owner = $this->owner($this->company);
        $actor = $this->employee($this->company, [
            Permissions::EMPLOYEES_VIEW,
            Permissions::EMPLOYEES_UPDATE,
            Permissions::EMPLOYEES_DELETE,
        ]);

        $this->actingAsUser($actor);

        // The binding only resolves employees, so an owner's id is simply not
        // a thing this endpoint can address.
        $this->assertApiError($this->getJson("/api/employees/{$owner->id}"), 404);
        $this->assertApiError($this->putJson("/api/employees/{$owner->id}", ['name' => 'Demoted']), 404);
        $this->assertApiError($this->deleteJson("/api/employees/{$owner->id}"), 404);

        $this->assertDatabaseHas('users', ['id' => $owner->id, 'role' => 'owner']);
    }

    #[Test]
    public function the_employee_endpoints_cannot_be_turned_against_a_super_admin(): void
    {
        $admin = $this->superAdmin();
        $owner = $this->owner($this->company);

        $this->actingAsUser($owner);

        $this->assertApiError($this->getJson("/api/employees/{$admin->id}"), 404);
        $this->assertApiError($this->deleteJson("/api/employees/{$admin->id}"), 404);

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'role' => 'super_admin']);
    }

    // -- System level --------------------------------------------------------

    #[Test]
    public function only_a_super_admin_manages_companies(): void
    {
        $this->actingAsUser($this->superAdmin());

        $response = $this->postJson('/api/companies', ['name' => 'New Agency']);

        $this->assertApiSuccess($response, 201);
        $this->assertDatabaseHas('companies', ['name' => 'New Agency']);

        $this->assertApiSuccess($this->getJson('/api/companies'));
    }

    #[Test]
    public function only_a_super_admin_manages_owners(): void
    {
        $this->actingAsUser($this->superAdmin());

        $response = $this->postJson("/api/companies/{$this->company->id}/owners", [
            'name' => 'The Owner',
            'email' => 'theowner@example.test',
            'password' => 'a-good-password-9',
        ]);

        $this->assertApiSuccess($response, 201)->assertJsonPath('data.role', 'owner');

        $this->assertDatabaseHas('users', [
            'email' => 'theowner@example.test',
            'role' => 'owner',
            'company_id' => $this->company->id,
        ]);
    }

    #[Test]
    public function the_audit_trail_is_closed_to_employees(): void
    {
        $employee = $this->employee($this->company, Permissions::all());

        $this->assertApiError(
            $this->actingAsUser($employee)->getJson('/api/audit-logs'),
            403
        );
    }

    #[Test]
    public function the_permission_catalogue_is_readable_by_any_authenticated_user(): void
    {
        $response = $this->actingAsUser($this->employee($this->company))->getJson('/api/permissions');

        $this->assertApiSuccess($response);
        $this->assertCount(count(Permissions::all()), $response->json('data.permissions'));
    }
}
