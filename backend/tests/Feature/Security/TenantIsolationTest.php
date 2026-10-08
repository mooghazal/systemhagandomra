<?php

namespace Tests\Feature\Security;

use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use App\Models\User;
use App\Support\Permissions;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Company A must never reach Company B's data, through any verb, as any role,
 * from any client.
 *
 * Cross-tenant ids resolve to 404 rather than 403: a "forbidden" would confirm
 * that the record exists, which is itself a leak.
 */
class TenantIsolationTest extends TestCase
{
    private Company $companyA;

    private Company $companyB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = $this->company(['name' => 'Alpha Travel']);
        $this->companyB = $this->company(['name' => 'Beta Travel']);
    }

    /**
     * @return array<string, array{0: string, 1: class-string}>
     */
    public static function resources(): array
    {
        return [
            'packages' => ['packages', Package::class],
            'hotels' => ['hotels', Hotel::class],
            'buses' => ['buses', Bus::class],
        ];
    }

    // -- Reads ---------------------------------------------------------------

    #[Test]
    #[DataProvider('resources')]
    public function an_owner_sees_only_their_own_companys_records(string $path, string $model): void
    {
        $model::factory()->count(3)->forCompany($this->companyA)->create();
        $model::factory()->count(2)->forCompany($this->companyB)->create();

        $response = $this->actingAsUser($this->owner($this->companyA))->getJson("/api/{$path}");

        $this->assertApiSuccess($response);
        $this->assertCount(3, $response->json('data'));

        foreach ($response->json('data') as $record) {
            $this->assertSame($this->companyA->id, $record['company_id']);
        }
    }

    #[Test]
    #[DataProvider('resources')]
    public function reading_another_companys_record_by_id_is_not_found(string $path, string $model): void
    {
        $theirs = $model::factory()->forCompany($this->companyB)->create();

        $response = $this->actingAsUser($this->owner($this->companyA))
            ->getJson("/api/{$path}/{$theirs->id}");

        $this->assertApiError($response, 404);
    }

    #[Test]
    #[DataProvider('resources')]
    public function updating_another_companys_record_is_not_found(string $path, string $model): void
    {
        $theirs = $model::factory()->forCompany($this->companyB)->create(['name' => 'Untouched']);

        $response = $this->actingAsUser($this->owner($this->companyA))
            ->putJson("/api/{$path}/{$theirs->id}", ['name' => 'Hijacked']);

        $this->assertApiError($response, 404);
        $this->assertSame('Untouched', $theirs->fresh()->name);
    }

    #[Test]
    #[DataProvider('resources')]
    public function deleting_another_companys_record_is_not_found(string $path, string $model): void
    {
        $theirs = $model::factory()->forCompany($this->companyB)->create();

        $response = $this->actingAsUser($this->owner($this->companyA))
            ->deleteJson("/api/{$path}/{$theirs->id}");

        $this->assertApiError($response, 404);
        $this->assertNotSoftDeleted($theirs);
    }

    #[Test]
    #[DataProvider('resources')]
    public function an_employee_with_full_permissions_still_cannot_cross_the_boundary(string $path, string $model): void
    {
        $theirs = $model::factory()->forCompany($this->companyB)->create();

        // Every permission the system has, and it still changes nothing: the
        // permission says *what* they may do, the tenant says *where*.
        $employee = $this->employee($this->companyA, Permissions::all());

        $this->actingAsUser($employee);

        $this->assertApiError($this->getJson("/api/{$path}/{$theirs->id}"), 404);
        $this->assertApiError($this->putJson("/api/{$path}/{$theirs->id}", ['name' => 'X']), 404);
        $this->assertApiError($this->deleteJson("/api/{$path}/{$theirs->id}"), 404);
    }

    #[Test]
    #[DataProvider('resources')]
    public function a_record_is_created_in_the_callers_company_whatever_the_payload_says(string $path, string $model): void
    {
        $owner = $this->owner($this->companyA);

        $response = $this->actingAsUser($owner)->postJson("/api/{$path}", [
            'name' => 'Created by A',
            'company_id' => $this->companyB->id,   // ignored
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.company_id', $this->companyA->id);

        $this->assertSame(0, $model::query()->withoutGlobalScopes()
            ->where('company_id', $this->companyB->id)->count());
    }

    #[Test]
    #[DataProvider('resources')]
    public function a_record_cannot_be_moved_to_another_company(string $path, string $model): void
    {
        $record = $model::factory()->forCompany($this->companyA)->create();

        $response = $this->actingAsUser($this->owner($this->companyA))
            ->putJson("/api/{$path}/{$record->id}", [
                'name' => 'Renamed',
                'company_id' => $this->companyB->id,   // ignored
            ]);

        $this->assertApiSuccess($response)
            ->assertJsonPath('data.company_id', $this->companyA->id);

        $this->assertSame($this->companyA->id, $record->fresh()->company_id);
    }

    #[Test]
    #[DataProvider('resources')]
    public function the_list_filter_cannot_be_pointed_at_another_company(string $path, string $model): void
    {
        $model::factory()->count(2)->forCompany($this->companyA)->create();
        $model::factory()->count(4)->forCompany($this->companyB)->create();

        $response = $this->actingAsUser($this->owner($this->companyA))
            ->getJson("/api/{$path}?company_id={$this->companyB->id}");

        $this->assertApiSuccess($response);
        $this->assertCount(2, $response->json('data'));

        foreach ($response->json('data') as $record) {
            $this->assertSame($this->companyA->id, $record['company_id']);
        }
    }

    // -- Employees -----------------------------------------------------------

    #[Test]
    public function employees_of_another_company_are_invisible(): void
    {
        $this->employee($this->companyA);
        $this->employee($this->companyB);
        $this->employee($this->companyB);

        $response = $this->actingAsUser($this->owner($this->companyA))->getJson('/api/employees');

        $this->assertApiSuccess($response);
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($this->companyA->id, $response->json('data.0.company_id'));
    }

    #[Test]
    public function another_companys_employee_cannot_be_read_updated_or_deleted(): void
    {
        $theirs = $this->employee($this->companyB, [], ['name' => 'Untouched']);

        $this->actingAsUser($this->owner($this->companyA));

        $this->assertApiError($this->getJson("/api/employees/{$theirs->id}"), 404);
        $this->assertApiError($this->putJson("/api/employees/{$theirs->id}", ['name' => 'Hijacked']), 404);
        $this->assertApiError($this->deleteJson("/api/employees/{$theirs->id}"), 404);

        $this->assertSame('Untouched', $theirs->fresh()->name);
        $this->assertDatabaseHas('users', ['id' => $theirs->id]);
    }

    #[Test]
    public function another_companys_employee_cannot_be_granted_permissions(): void
    {
        $theirs = $this->employee($this->companyB);

        $response = $this->actingAsUser($this->owner($this->companyA))
            ->putJson("/api/employees/{$theirs->id}/permissions", [
                'permissions' => Permissions::all(),
            ]);

        $this->assertApiError($response, 404);
        $this->assertCount(0, $theirs->fresh()->permissionNames());
    }

    #[Test]
    public function a_new_employee_lands_in_the_callers_company(): void
    {
        $response = $this->actingAsUser($this->owner($this->companyA))->postJson('/api/employees', [
            'name' => 'New Hire',
            'email' => 'hire@example.test',
            'password' => 'a-good-password-9',
            'company_id' => $this->companyB->id,   // ignored
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.company_id', $this->companyA->id);

        $this->assertDatabaseHas('users', [
            'email' => 'hire@example.test',
            'company_id' => $this->companyA->id,
            'role' => 'employee',
        ]);
    }

    // -- Companies -----------------------------------------------------------

    #[Test]
    public function a_company_user_cannot_list_companies(): void
    {
        $this->assertApiError(
            $this->actingAsUser($this->owner($this->companyA))->getJson('/api/companies'),
            403
        );
    }

    #[Test]
    public function an_owner_may_read_their_own_company_but_not_another(): void
    {
        $this->actingAsUser($this->owner($this->companyA));

        $this->assertApiSuccess($this->getJson("/api/companies/{$this->companyA->id}"))
            ->assertJsonPath('data.id', $this->companyA->id);

        // 404, not 403: a forbidden-but-existing company answering differently
        // from a made-up id would let anyone count the platform's tenants.
        $this->assertApiError($this->getJson("/api/companies/{$this->companyB->id}"), 404);
    }

    #[Test]
    public function another_companys_id_is_indistinguishable_from_one_that_does_not_exist(): void
    {
        $this->actingAsUser($this->owner($this->companyA));

        $real = $this->getJson("/api/companies/{$this->companyB->id}");
        $invented = $this->getJson('/api/companies/999999');

        $this->assertSame($invented->status(), $real->status());
        $this->assertSame($invented->json('message'), $real->json('message'));

        // The same must hold for the nested owner routes.
        $realOwners = $this->getJson("/api/companies/{$this->companyB->id}/owners");
        $inventedOwners = $this->getJson('/api/companies/999999/owners');

        $this->assertSame($inventedOwners->status(), $realOwners->status());
    }

    #[Test]
    public function a_company_user_cannot_create_update_or_delete_companies(): void
    {
        $this->actingAsUser($this->owner($this->companyA));

        $this->assertApiError($this->postJson('/api/companies', ['name' => 'Mine Now']), 403);

        // Their own company: reachable, so this is a refusal rather than a miss.
        $this->assertApiError($this->putJson("/api/companies/{$this->companyA->id}", ['name' => 'Renamed']), 403);

        // Another company: not reachable at all.
        $this->assertApiError($this->deleteJson("/api/companies/{$this->companyB->id}"), 404);

        $this->assertDatabaseHas('companies', ['id' => $this->companyB->id]);
        $this->assertSame('Alpha Travel', $this->companyA->fresh()->name);
    }

    // -- Super admin ---------------------------------------------------------

    #[Test]
    #[DataProvider('resources')]
    public function a_super_admin_sees_across_companies(string $path, string $model): void
    {
        $model::factory()->count(2)->forCompany($this->companyA)->create();
        $model::factory()->count(3)->forCompany($this->companyB)->create();

        $response = $this->actingAsUser($this->superAdmin())->getJson("/api/{$path}");

        $this->assertApiSuccess($response);
        $this->assertCount(5, $response->json('data'));
    }

    #[Test]
    #[DataProvider('resources')]
    public function a_super_admin_can_filter_to_one_company(string $path, string $model): void
    {
        $model::factory()->count(2)->forCompany($this->companyA)->create();
        $model::factory()->count(3)->forCompany($this->companyB)->create();

        $response = $this->actingAsUser($this->superAdmin())
            ->getJson("/api/{$path}?company_id={$this->companyB->id}");

        $this->assertCount(3, $response->json('data'));
    }

    #[Test]
    #[DataProvider('resources')]
    public function a_super_admin_must_name_a_company_when_creating(string $path, string $model): void
    {
        $admin = $this->superAdmin();

        // No company means there is nothing to attribute the record to.
        $this->assertApiError(
            $this->actingAsUser($admin)->postJson("/api/{$path}", ['name' => 'Orphan']),
            422
        )->assertJsonStructure(['errors' => ['company_id']]);

        $response = $this->actingAsUser($admin)->postJson("/api/{$path}", [
            'name' => 'Attributed',
            'company_id' => $this->companyB->id,
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.company_id', $this->companyB->id);
    }

    #[Test]
    public function the_database_refuses_an_owner_without_a_company(): void
    {
        $this->expectException(\Illuminate\Database\QueryException::class);

        // The users_role_company_check constraint, not application code.
        User::factory()->owner()->create(['company_id' => null]);
    }

    #[Test]
    public function the_database_refuses_a_super_admin_attached_to_a_company(): void
    {
        $this->expectException(\Illuminate\Database\QueryException::class);

        User::factory()->superAdmin()->create(['company_id' => $this->companyA->id]);
    }
}
