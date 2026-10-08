<?php

namespace Tests\Feature\Api;

use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * The three endpoints the admin panel needs that the resource routes do not
 * already cover: company logos (spec §13), a flat owner list (§14) and the
 * dashboard counters (§10).
 */
class AdminPanelSupportTest extends TestCase
{
    // -- Company logo --------------------------------------------------------

    #[Test]
    public function a_company_can_be_created_with_a_logo(): void
    {
        Storage::fake('public');

        $response = $this->actingAsUser($this->superAdmin())->post('/api/companies', [
            'name' => 'Al Noor Travel',
            'logo' => UploadedFile::fake()->image('logo.png', 400, 400),
        ], ['Accept' => 'application/json']);

        $this->assertApiSuccess($response, 201);

        $path = $response->json('data.logo_path');

        $this->assertStringStartsWith('companies/', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertNotNull($response->json('data.logo_url'));

        // The client's filename never reaches the filesystem.
        $this->assertStringNotContainsString('logo.png', $path);
    }

    #[Test]
    public function a_company_logo_can_be_replaced_and_removed(): void
    {
        Storage::fake('public');
        $this->actingAsUser($this->superAdmin());

        $created = $this->post('/api/companies', [
            'name' => 'Al Noor',
            'logo' => UploadedFile::fake()->image('first.png'),
        ], ['Accept' => 'application/json']);

        $id = $created->json('data.id');
        $first = $created->json('data.logo_path');

        $replaced = $this->post("/api/companies/{$id}", [
            '_method' => 'PUT',
            'logo' => UploadedFile::fake()->image('second.png'),
        ], ['Accept' => 'application/json']);

        $second = $replaced->json('data.logo_path');

        $this->assertNotSame($first, $second);
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);

        $removed = $this->putJson("/api/companies/{$id}", ['remove_logo' => true]);

        $this->assertApiSuccess($removed)->assertJsonPath('data.logo_path', null);
        Storage::disk('public')->assertMissing($second);
    }

    #[Test]
    public function a_non_image_logo_is_rejected(): void
    {
        Storage::fake('public');

        $response = $this->actingAsUser($this->superAdmin())->post('/api/companies', [
            'name' => 'Malicious',
            'logo' => UploadedFile::fake()->create('shell.php', 16, 'application/x-php'),
        ], ['Accept' => 'application/json']);

        $this->assertApiError($response, 422)->assertJsonStructure(['errors' => ['logo']]);
        $this->assertSame(0, Company::query()->count());
    }

    // -- Flat owner list -----------------------------------------------------

    #[Test]
    public function a_super_admin_lists_every_owner_with_their_company(): void
    {
        $a = $this->company(['name' => 'Alpha']);
        $b = $this->company(['name' => 'Beta']);
        $this->owner($a, ['name' => 'Owner A']);
        $this->owner($b, ['name' => 'Owner B']);
        $this->employee($a);   // must not appear

        $response = $this->actingAsUser($this->superAdmin())->getJson('/api/owners');

        $this->assertApiSuccess($response);
        $this->assertCount(2, $response->json('data'));

        foreach ($response->json('data') as $row) {
            $this->assertSame('owner', $row['role']);
            $this->assertNotNull($row['company']['name']);
        }
    }

    #[Test]
    public function the_owner_list_can_be_searched_and_filtered(): void
    {
        $a = $this->company();
        $b = $this->company();
        $this->owner($a, ['name' => 'Khalid Saleh', 'email' => 'khalid@a.test']);
        $this->owner($b, ['name' => 'Fatima Noor', 'email' => 'fatima@b.test']);

        $this->actingAsUser($this->superAdmin());

        $this->assertCount(1, $this->getJson('/api/owners?search=Khalid')->json('data'));
        $this->assertCount(1, $this->getJson('/api/owners?search=fatima@')->json('data'));
        $this->assertCount(1, $this->getJson("/api/owners?company_id={$b->id}")->json('data'));
        $this->assertCount(0, $this->getJson('/api/owners?search=nobody')->json('data'));
    }

    #[Test]
    public function the_owner_list_is_closed_to_company_users(): void
    {
        $company = $this->company();
        $this->owner($company);

        $this->assertApiError($this->actingAsUser($this->owner($this->company()))->getJson('/api/owners'), 403);
        $this->assertApiError($this->actingAsUser($this->employee($company))->getJson('/api/owners'), 403);
    }

    #[Test]
    public function the_owner_list_never_exposes_credentials(): void
    {
        $this->owner($this->company());

        $response = $this->actingAsUser($this->superAdmin())->getJson('/api/owners');

        $this->assertStringNotContainsString('$2y$', $response->getContent());
        $this->assertArrayNotHasKey('password', $response->json('data.0'));
    }

    // -- Dashboard stats -----------------------------------------------------

    #[Test]
    public function a_super_admin_sees_system_wide_counts(): void
    {
        $a = $this->company();
        $b = $this->company(['is_active' => false]);
        $this->owner($a);
        $this->employee($a);
        $this->employee($b);
        Package::factory()->count(3)->forCompany($a)->create();
        Hotel::factory()->count(2)->forCompany($b)->create();
        Bus::factory()->forCompany($a)->create();

        $response = $this->actingAsUser($this->superAdmin())->getJson('/api/stats');

        $this->assertApiSuccess($response)
            ->assertJsonPath('data.companies', 2)
            ->assertJsonPath('data.active_companies', 1)
            ->assertJsonPath('data.owners', 1)
            ->assertJsonPath('data.employees', 2)
            ->assertJsonPath('data.packages', 3)
            ->assertJsonPath('data.hotels', 2)
            ->assertJsonPath('data.buses', 1);
    }

    #[Test]
    public function a_company_user_sees_only_their_own_counts(): void
    {
        $mine = $this->company();
        $theirs = $this->company();

        $this->employee($mine);
        $this->employee($theirs);
        $this->employee($theirs);
        Package::factory()->count(2)->forCompany($mine)->create();
        Package::factory()->count(7)->forCompany($theirs)->create();
        Hotel::factory()->forCompany($theirs)->create();

        $response = $this->actingAsUser($this->owner($mine))->getJson('/api/stats');

        $this->assertApiSuccess($response)
            ->assertJsonPath('data.employees', 1)
            ->assertJsonPath('data.packages', 2)
            ->assertJsonPath('data.hotels', 0)
            ->assertJsonPath('data.buses', 0);

        // A company user has no business knowing how many companies exist.
        $this->assertArrayNotHasKey('companies', $response->json('data'));
        $this->assertArrayNotHasKey('owners', $response->json('data'));
    }

    #[Test]
    public function stats_require_authentication(): void
    {
        $this->assertApiError($this->getJson('/api/stats'), 401);
    }

    #[Test]
    public function deleted_records_are_not_counted(): void
    {
        $company = $this->company();
        $owner = $this->owner($company);
        $packages = Package::factory()->count(3)->forCompany($company)->create();

        $packages->first()->delete();

        $response = $this->actingAsUser($owner)->getJson('/api/stats');

        $this->assertJsonPathSame($response, 'data.packages', 2);
    }

    private function assertJsonPathSame($response, string $path, int $expected): void
    {
        $this->assertSame($expected, $response->json($path));
    }
}
