<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class EmployeeApiTest extends TestCase
{
    private Company $company;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->owner = $this->owner($this->company);
        $this->actingAsUser($this->owner);
    }

    #[Test]
    public function an_owner_can_create_an_employee(): void
    {
        $response = $this->postJson('/api/employees', [
            'name' => 'Ahmed Saleh',
            'email' => 'ahmed@example.test',
            'password' => 'a-good-password-9',
            'phone' => '+966500000000',
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.name', 'Ahmed Saleh')
            ->assertJsonPath('data.role', 'employee')
            ->assertJsonPath('data.company_id', $this->company->id)
            ->assertJsonPath('data.is_active', true);

        $this->assertArrayNotHasKey('password', $response->json('data'));
    }

    #[Test]
    public function the_password_is_hashed_and_never_returned(): void
    {
        $response = $this->postJson('/api/employees', [
            'name' => 'Ahmed',
            'email' => 'ahmed@example.test',
            'password' => 'a-good-password-9',
        ]);

        $employee = User::query()->where('email', 'ahmed@example.test')->sole();

        $this->assertNotSame('a-good-password-9', $employee->password);
        $this->assertTrue(Hash::check('a-good-password-9', $employee->password));
        $this->assertStringNotContainsString('a-good-password-9', $response->getContent());
        $this->assertStringNotContainsString($employee->password, $response->getContent());
    }

    #[Test]
    public function a_weak_password_is_rejected(): void
    {
        $this->assertApiError($this->postJson('/api/employees', [
            'name' => 'Ahmed',
            'email' => 'ahmed@example.test',
            'password' => '123',
        ]), 422)->assertJsonStructure(['errors' => ['password']]);
    }

    #[Test]
    public function the_email_must_be_unique_and_is_normalised(): void
    {
        $this->postJson('/api/employees', [
            'name' => 'First', 'email' => 'Taken@Example.test', 'password' => 'a-good-password-9',
        ])->assertStatus(201);

        $this->assertDatabaseHas('users', ['email' => 'taken@example.test']);

        $this->assertApiError($this->postJson('/api/employees', [
            'name' => 'Second', 'email' => 'TAKEN@example.test', 'password' => 'a-good-password-9',
        ]), 422)->assertJsonStructure(['errors' => ['email']]);
    }

    #[Test]
    public function an_employee_can_be_created_with_permissions_by_an_owner(): void
    {
        $response = $this->postJson('/api/employees', [
            'name' => 'Ahmed',
            'email' => 'ahmed@example.test',
            'password' => 'a-good-password-9',
            'permissions' => [Permissions::PACKAGES_VIEW, Permissions::PACKAGES_CREATE],
        ]);

        $this->assertApiSuccess($response, 201);

        $this->assertEqualsCanonicalizing(
            [Permissions::PACKAGES_CREATE, Permissions::PACKAGES_VIEW],
            $response->json('data.permissions'),
        );
    }

    #[Test]
    public function permissions_can_be_read_and_replaced(): void
    {
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        $this->assertSame(
            [Permissions::PACKAGES_VIEW],
            $this->getJson("/api/employees/{$employee->id}/permissions")->json('data.permissions'),
        );

        $response = $this->putJson("/api/employees/{$employee->id}/permissions", [
            'permissions' => [Permissions::HOTELS_VIEW, Permissions::BUSES_VIEW],
        ]);

        $this->assertApiSuccess($response);

        // Replaced wholesale, not merged.
        $this->assertEqualsCanonicalizing(
            [Permissions::BUSES_VIEW, Permissions::HOTELS_VIEW],
            $response->json('data.permissions'),
        );
    }

    #[Test]
    public function an_empty_permission_list_revokes_everything(): void
    {
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW, Permissions::HOTELS_VIEW]);

        $response = $this->putJson("/api/employees/{$employee->id}/permissions", ['permissions' => []]);

        $this->assertApiSuccess($response);
        $this->assertSame([], $response->json('data.permissions'));
    }

    #[Test]
    public function the_permission_list_must_be_sent_explicitly(): void
    {
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        // An omitted key would otherwise be an easy way to wipe a set by
        // accident, so it is a validation error rather than "revoke all".
        $this->assertApiError(
            $this->putJson("/api/employees/{$employee->id}/permissions", []),
            422
        )->assertJsonStructure(['errors' => ['permissions']]);

        $this->assertCount(1, $employee->fresh()->permissionNames());
    }

    #[Test]
    public function an_employee_can_be_updated_without_resending_every_field(): void
    {
        $employee = $this->employee($this->company, [], [
            'name' => 'Original Name',
            'phone' => '+966500000000',
        ]);

        $response = $this->putJson("/api/employees/{$employee->id}", ['name' => 'New Name']);

        $this->assertApiSuccess($response)
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.phone', '+966500000000');
    }

    #[Test]
    public function an_employee_can_be_deactivated_rather_than_deleted(): void
    {
        $employee = $this->employee($this->company);

        $this->assertApiSuccess($this->putJson("/api/employees/{$employee->id}", ['is_active' => false]))
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('users', ['id' => $employee->id, 'is_active' => false]);
    }

    #[Test]
    public function a_deactivated_employee_is_refused_everywhere(): void
    {
        $employee = $this->employee($this->company, Permissions::all(), ['is_active' => false]);

        $this->actingAsUser($employee);

        $this->assertApiError($this->getJson('/api/packages'), 403);
        $this->assertApiError($this->postJson('/api/packages', ['name' => 'X']), 403);
    }

    #[Test]
    public function changing_a_password_rehashes_it(): void
    {
        $employee = $this->employee($this->company);
        $before = $employee->password;

        $this->assertApiSuccess(
            $this->putJson("/api/employees/{$employee->id}", ['password' => 'a-brand-new-pw-4'])
        );

        $employee->refresh();

        $this->assertNotSame($before, $employee->password);
        $this->assertTrue(Hash::check('a-brand-new-pw-4', $employee->password));
    }

    #[Test]
    public function an_employee_is_soft_deleted_and_disappears_from_the_api(): void
    {
        $employee = $this->employee($this->company);

        $this->assertApiSuccess($this->deleteJson("/api/employees/{$employee->id}"));

        $this->assertSoftDeleted($employee);
        $this->assertApiError($this->getJson("/api/employees/{$employee->id}"), 404);
        $this->assertCount(0, $this->getJson('/api/employees')->json('data'));
    }

    #[Test]
    public function a_deleted_employee_can_no_longer_authenticate(): void
    {
        $employee = $this->employee($this->company, [], [
            'email' => 'leaver@example.test',
            'password' => 'correct-horse-7',
        ]);

        $this->deleteJson("/api/employees/{$employee->id}");

        $this->assertApiError($this->postJson('/api/auth/login', [
            'email' => 'leaver@example.test',
            'password' => 'correct-horse-7',
        ]), 422);
    }

    #[Test]
    public function a_deleted_employees_address_can_be_used_again(): void
    {
        $employee = $this->employee($this->company, [], ['email' => 'rehire@example.test']);

        $this->deleteJson("/api/employees/{$employee->id}");

        // The point of the live_email generated column: a departing employee
        // must not take their own address with them.
        $response = $this->postJson('/api/employees', [
            'name' => 'Rehired',
            'email' => 'rehire@example.test',
            'password' => 'a-good-password-9',
        ]);

        $this->assertApiSuccess($response, 201);
        $this->assertNotSame($employee->id, $response->json('data.id'));
    }

    #[Test]
    public function a_deleted_employees_permission_grants_are_retained_for_restore(): void
    {
        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        $this->assertDatabaseCount('employee_permissions', 1);

        $this->deleteJson("/api/employees/{$employee->id}");

        // The row survives because the user row does; a restore brings the
        // account back exactly as it was.
        $this->assertDatabaseCount('employee_permissions', 1);
    }

    #[Test]
    public function the_employee_list_excludes_owners_and_super_admins(): void
    {
        $this->employee($this->company);
        $this->employee($this->company);
        $this->superAdmin();

        $response = $this->getJson('/api/employees');

        $this->assertCount(2, $response->json('data'));

        foreach ($response->json('data') as $row) {
            $this->assertSame('employee', $row['role']);
        }
    }

    #[Test]
    public function employees_can_be_searched_by_name_or_email(): void
    {
        $this->employee($this->company, [], ['name' => 'Ahmed Saleh', 'email' => 'ahmed@example.test']);
        $this->employee($this->company, [], ['name' => 'Fatima Noor', 'email' => 'fatima@example.test']);

        $this->assertCount(1, $this->getJson('/api/employees?search=Ahmed')->json('data'));
        $this->assertCount(1, $this->getJson('/api/employees?search=fatima@')->json('data'));
        $this->assertCount(0, $this->getJson('/api/employees?search=nobody')->json('data'));
    }
}
