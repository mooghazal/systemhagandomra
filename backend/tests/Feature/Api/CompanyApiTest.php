<?php

namespace Tests\Feature\Api;

use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use App\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CompanyApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAsUser($this->superAdmin());
    }

    #[Test]
    public function a_company_is_created_with_a_derived_slug(): void
    {
        $response = $this->postJson('/api/companies', [
            'name' => 'Al Noor Travel & Tours',
            'email' => 'info@alnoor.test',
            'phone' => '+966500000000',
            'address' => 'Jeddah',
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.name', 'Al Noor Travel & Tours')
            ->assertJsonPath('data.slug', 'al-noor-travel-tours')
            ->assertJsonPath('data.is_active', true);
    }

    #[Test]
    public function duplicate_names_get_distinct_slugs(): void
    {
        $first = $this->postJson('/api/companies', ['name' => 'Al Noor'])->json('data.slug');
        $second = $this->postJson('/api/companies', ['name' => 'Al Noor'])->json('data.slug');

        $this->assertSame('al-noor', $first);
        $this->assertSame('al-noor-2', $second);
    }

    #[Test]
    public function a_company_can_be_created_with_its_first_owner(): void
    {
        $response = $this->postJson('/api/companies', [
            'name' => 'Al Noor Travel',
            'owner' => [
                'name' => 'Khalid',
                'email' => 'khalid@alnoor.test',
                'password' => 'a-good-password-9',
            ],
        ]);

        $this->assertApiSuccess($response, 201);

        $company = Company::query()->where('name', 'Al Noor Travel')->sole();

        $this->assertDatabaseHas('users', [
            'email' => 'khalid@alnoor.test',
            'role' => 'owner',
            'company_id' => $company->id,
        ]);
    }

    #[Test]
    public function an_incomplete_owner_block_is_rejected_and_nothing_is_created(): void
    {
        $response = $this->postJson('/api/companies', [
            'name' => 'Al Noor Travel',
            'owner' => ['name' => 'Khalid'],   // no email, no password
        ]);

        $this->assertApiError($response, 422)
            ->assertJsonStructure(['errors' => ['owner.email', 'owner.password']]);

        $this->assertDatabaseMissing('companies', ['name' => 'Al Noor Travel']);
    }

    #[Test]
    public function the_company_list_carries_resource_counts(): void
    {
        $company = $this->company();
        $this->owner($company);
        $this->employee($company);
        Package::factory()->count(3)->forCompany($company)->create();
        Hotel::factory()->count(2)->forCompany($company)->create();
        Bus::factory()->forCompany($company)->create();

        $row = collect($this->getJson('/api/companies')->json('data'))
            ->firstWhere('id', $company->id);

        $this->assertSame(
            ['owners' => 1, 'employees' => 1, 'packages' => 3, 'hotels' => 2, 'buses' => 1],
            $row['counts'],
        );
    }

    #[Test]
    public function a_company_can_be_updated_and_deactivated(): void
    {
        $company = $this->company(['name' => 'Before']);

        $this->assertApiSuccess($this->putJson("/api/companies/{$company->id}", [
            'name' => 'After',
            'is_active' => false,
        ]))->assertJsonPath('data.name', 'After')->assertJsonPath('data.is_active', false);
    }

    #[Test]
    public function the_slug_is_immutable(): void
    {
        $company = $this->company(['name' => 'Original']);
        $slug = $company->slug;

        $this->putJson("/api/companies/{$company->id}", ['name' => 'Renamed', 'slug' => 'hijacked']);

        $this->assertSame($slug, $company->fresh()->slug);
    }

    #[Test]
    public function deleting_a_company_soft_deletes_everything_it_owns(): void
    {
        $company = $this->company();
        $owner = $this->owner($company);
        $employee = $this->employee($company);
        $package = Package::factory()->forCompany($company)->create();
        $hotel = Hotel::factory()->forCompany($company)->create();
        $bus = Bus::factory()->forCompany($company)->create();

        $survivor = $this->company();
        $survivorPackage = Package::factory()->forCompany($survivor)->create();

        $this->assertApiSuccess($this->deleteJson("/api/companies/{$company->id}"));

        // A database ON DELETE CASCADE does not fire on a soft delete, so the
        // service has to carry it — otherwise the company's staff would still
        // be able to log in.
        $this->assertSoftDeleted($company);
        $this->assertSoftDeleted($owner);
        $this->assertSoftDeleted($employee);
        $this->assertSoftDeleted($package);
        $this->assertSoftDeleted($hotel);
        $this->assertSoftDeleted($bus);

        // Another company's data is untouched.
        $this->assertNotSoftDeleted($survivor);
        $this->assertNotSoftDeleted($survivorPackage);
    }

    #[Test]
    public function a_deleted_companys_owner_can_no_longer_authenticate(): void
    {
        $company = $this->company();
        $owner = $this->owner($company, ['email' => 'gone@example.test', 'password' => 'correct-horse-7']);

        $this->deleteJson("/api/companies/{$company->id}");

        $this->assertApiError($this->postJson('/api/auth/login', [
            'email' => 'gone@example.test',
            'password' => 'correct-horse-7',
        ]), 422);
    }

    #[Test]
    public function deleting_a_company_releases_its_slug_and_its_users_addresses(): void
    {
        $company = $this->postJson('/api/companies', [
            'name' => 'Al Noor',
            'owner' => [
                'name' => 'Khalid',
                'email' => 'khalid@alnoor.test',
                'password' => 'a-good-password-9',
            ],
        ])->json('data');

        $this->deleteJson("/api/companies/{$company['id']}");

        // The generated columns go NULL on soft delete, so both values are
        // immediately available again rather than being locked up by a row
        // nobody can see.
        $recreated = $this->postJson('/api/companies', [
            'name' => 'Al Noor',
            'owner' => [
                'name' => 'Khalid',
                'email' => 'khalid@alnoor.test',
                'password' => 'a-good-password-9',
            ],
        ]);

        $this->assertApiSuccess($recreated, 201)
            ->assertJsonPath('data.slug', 'al-noor');

        $this->assertNotSame($company['id'], $recreated->json('data.id'));
    }

    #[Test]
    public function a_company_has_exactly_one_owner(): void
    {
        $company = $this->company();

        $this->assertApiSuccess($this->postJson("/api/companies/{$company->id}/owners", [
            'name' => 'First Owner',
            'email' => 'first@example.test',
            'password' => 'a-good-password-9',
        ]), 201);

        $second = $this->postJson("/api/companies/{$company->id}/owners", [
            'name' => 'Second Owner',
            'email' => 'second@example.test',
            'password' => 'a-good-password-9',
        ]);

        $this->assertApiError($second, 422)->assertJsonStructure(['errors' => ['owner']]);

        $this->assertSame(1, $company->owners()->count());
    }

    #[Test]
    public function removing_an_owner_frees_the_slot(): void
    {
        $company = $this->company();
        $first = $this->owner($company);

        $this->assertApiSuccess($this->deleteJson("/api/companies/{$company->id}/owners/{$first->id}"));

        $this->assertApiSuccess($this->postJson("/api/companies/{$company->id}/owners", [
            'name' => 'Replacement',
            'email' => 'replacement@example.test',
            'password' => 'a-good-password-9',
        ]), 201);

        $this->assertSame(1, $company->owners()->count());
    }

    #[Test]
    public function a_domain_is_unique_among_live_companies(): void
    {
        $this->assertApiSuccess(
            $this->postJson('/api/companies', ['name' => 'First', 'domain' => 'shared.example']),
            201
        );

        $this->assertApiError(
            $this->postJson('/api/companies', ['name' => 'Second', 'domain' => 'shared.example']),
            422
        )->assertJsonStructure(['errors' => ['domain']]);
    }

    #[Test]
    public function owners_can_be_listed_added_updated_and_removed(): void
    {
        $company = $this->company();

        $created = $this->postJson("/api/companies/{$company->id}/owners", [
            'name' => 'Khalid',
            'email' => 'khalid@example.test',
            'password' => 'a-good-password-9',
        ]);

        $this->assertApiSuccess($created, 201)->assertJsonPath('data.role', 'owner');
        $ownerId = $created->json('data.id');

        $this->assertCount(1, $this->getJson("/api/companies/{$company->id}/owners")->json('data'));

        $this->assertApiSuccess(
            $this->putJson("/api/companies/{$company->id}/owners/{$ownerId}", ['name' => 'Khalid Updated'])
        )->assertJsonPath('data.name', 'Khalid Updated');

        $this->assertApiSuccess($this->deleteJson("/api/companies/{$company->id}/owners/{$ownerId}"));
        $this->assertSoftDeleted('users', ['id' => $ownerId]);
    }

    #[Test]
    public function an_owner_cannot_be_addressed_through_another_companys_url(): void
    {
        $companyA = $this->company();
        $companyB = $this->company();
        $owner = $this->owner($companyB);

        $this->assertApiError(
            $this->putJson("/api/companies/{$companyA->id}/owners/{$owner->id}", ['name' => 'Moved']),
            404
        );

        $this->assertApiError(
            $this->deleteJson("/api/companies/{$companyA->id}/owners/{$owner->id}"),
            404
        );

        $this->assertDatabaseHas('users', ['id' => $owner->id, 'company_id' => $companyB->id]);
    }

    #[Test]
    public function an_employee_id_cannot_be_used_on_the_owner_endpoints(): void
    {
        $company = $this->company();
        $employee = $this->employee($company);

        $this->assertApiError(
            $this->putJson("/api/companies/{$company->id}/owners/{$employee->id}", ['name' => 'Promoted']),
            404
        );

        $this->assertDatabaseHas('users', ['id' => $employee->id, 'role' => 'employee']);
    }

    #[Test]
    public function the_owner_list_never_exposes_credentials(): void
    {
        $company = $this->company();
        $this->owner($company);

        $response = $this->getJson("/api/companies/{$company->id}/owners");

        $this->assertStringNotContainsString('$2y$', $response->getContent());
        $this->assertArrayNotHasKey('password', $response->json('data.0'));
    }

    #[Test]
    public function companies_can_be_searched_and_filtered(): void
    {
        $this->company(['name' => 'Al Noor Travel']);
        $this->company(['name' => 'Baraka Tours']);
        $this->company(['name' => 'Retired Agency', 'is_active' => false]);

        $this->assertCount(1, $this->getJson('/api/companies?search=Noor')->json('data'));
        $this->assertCount(2, $this->getJson('/api/companies?is_active=1')->json('data'));
        $this->assertCount(1, $this->getJson('/api/companies?is_active=0')->json('data'));
    }
}
