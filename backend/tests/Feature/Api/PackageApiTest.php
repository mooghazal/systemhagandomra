<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Package;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PackageApiTest extends TestCase
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
    public function a_package_needs_only_a_name(): void
    {
        $response = $this->postJson('/api/packages', ['name' => 'Ramadan Umrah']);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.name', 'Ramadan Umrah')
            ->assertJsonPath('data.price', null)
            ->assertJsonPath('data.days', null)
            ->assertJsonPath('data.start_date', null)
            ->assertJsonPath('data.trip_type', null)
            ->assertJsonPath('data.features', []);
    }

    #[Test]
    public function the_name_is_required(): void
    {
        $this->assertApiError($this->postJson('/api/packages', ['price' => 35000]), 422)
            ->assertJsonStructure(['errors' => ['name']]);
    }

    #[Test]
    public function a_fully_specified_package_round_trips(): void
    {
        $response = $this->postJson('/api/packages', [
            'name' => 'Ramadan Umrah',
            'description' => 'Ten nights in Makkah and Madinah.',
            'price' => 35000,
            'currency' => 'sar',
            'days' => 10,
            'start_date' => '2027-02-10',
            'end_date' => '2027-02-20',
            'trip_type' => 'umrah',
            'location' => 'Makkah',
            'features' => ['Hotel', 'Transportation', 'Meals'],
        ]);

        // Compared numerically: JSON has one number type, so 35000.0 and
        // 35000 are the same value on the wire and assertJsonPath's strict
        // comparison would be testing PHP's decoder, not the API.
        $this->assertSame(35000.0, (float) $response->json('data.price'));

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.currency', 'SAR')   // normalised
            ->assertJsonPath('data.days', 10)
            ->assertJsonPath('data.start_date', '2027-02-10')
            ->assertJsonPath('data.end_date', '2027-02-20')
            ->assertJsonPath('data.trip_type', 'umrah')
            ->assertJsonPath('data.features', ['Hotel', 'Transportation', 'Meals']);
    }

    #[Test]
    public function zero_and_false_are_stored_rather_than_treated_as_missing(): void
    {
        $response = $this->postJson('/api/packages', [
            'name' => 'Free Trial',
            'price' => 0,
            'is_active' => false,
            'features' => [],
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.features', []);

        // A price of zero is a price, not an absent one.
        $this->assertNotNull($response->json('data.price'));
        $this->assertSame(0.0, (float) $response->json('data.price'));

        $package = Package::query()->where('name', 'Free Trial')->sole();

        $this->assertSame('0.00', $package->price);
        $this->assertFalse($package->is_active);
        $this->assertSame([], $package->features);
    }

    #[Test]
    public function an_omitted_field_is_left_alone_while_an_explicit_null_clears_it(): void
    {
        $package = Package::factory()->forCompany($this->company)->create([
            'price' => 35000,
            'days' => 10,
            'location' => 'Makkah',
        ]);

        // Only `days` is sent, so price and location must survive untouched.
        $response = $this->putJson("/api/packages/{$package->id}", ['days' => 12]);

        $this->assertApiSuccess($response)
            ->assertJsonPath('data.days', 12)
            ->assertJsonPath('data.location', 'Makkah');

        $this->assertSame(35000.0, (float) $response->json('data.price'));

        // An explicit null is a deliberate "clear this".
        $this->assertApiSuccess($this->putJson("/api/packages/{$package->id}", ['location' => null]))
            ->assertJsonPath('data.location', null)
            ->assertJsonPath('data.days', 12);
    }

    #[Test]
    public function an_empty_feature_list_differs_from_no_feature_list(): void
    {
        $package = Package::factory()->forCompany($this->company)->create([
            'features' => ['Hotel', 'Meals'],
        ]);

        // Not mentioned: unchanged.
        $this->assertApiSuccess($this->putJson("/api/packages/{$package->id}", ['name' => 'Renamed']))
            ->assertJsonPath('data.features', ['Hotel', 'Meals']);

        // Explicitly empty: cleared.
        $this->assertApiSuccess($this->putJson("/api/packages/{$package->id}", ['features' => []]))
            ->assertJsonPath('data.features', []);
    }

    #[Test]
    public function arabic_content_round_trips_unchanged(): void
    {
        // The system is for Hajj and Umrah operators, so Arabic is the common
        // case, not an edge one. This fails loudly if a connection, column or
        // JSON setting ever drops back to a single-byte charset — the symptom
        // being text silently stored as "????".
        $name = 'باقة رمضان العائلية';
        $location = 'مكة المكرمة والمدينة المنورة';
        $features = ['فندق', 'مواصلات', 'وجبات'];

        $response = $this->postJson('/api/packages', [
            'name' => $name,
            'trip_type' => 'عمرة رمضان',
            'location' => $location,
            'features' => $features,
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.name', $name)
            ->assertJsonPath('data.location', $location)
            ->assertJsonPath('data.trip_type', 'عمرة رمضان')
            ->assertJsonPath('data.features', $features);

        $stored = Package::query()->sole();

        $this->assertSame($name, $stored->name);
        $this->assertSame($features, $stored->features);
        $this->assertStringNotContainsString('?', $stored->name);
    }

    #[Test]
    public function arabic_search_matches(): void
    {
        Package::factory()->forCompany($this->company)->create(['name' => 'باقة رمضان']);
        Package::factory()->forCompany($this->company)->create(['name' => 'باقة الحج']);

        $this->assertCount(1, $this->getJson('/api/packages?search='.urlencode('رمضان'))->json('data'));
        $this->assertCount(2, $this->getJson('/api/packages?search='.urlencode('باقة'))->json('data'));
    }

    #[Test]
    public function the_end_date_must_not_precede_the_start_date(): void
    {
        $this->assertApiError($this->postJson('/api/packages', [
            'name' => 'Backwards',
            'start_date' => '2027-03-01',
            'end_date' => '2027-02-01',
        ]), 422)->assertJsonStructure(['errors' => ['end_date']]);
    }

    #[Test]
    public function a_partial_date_update_is_checked_against_the_stored_date(): void
    {
        $package = Package::factory()->forCompany($this->company)->create([
            'start_date' => '2027-03-01',
            'end_date' => '2027-03-10',
        ]);

        // Only the start date moves, past the stored end date.
        $this->assertApiError(
            $this->putJson("/api/packages/{$package->id}", ['start_date' => '2027-04-01']),
            422
        )->assertJsonStructure(['errors' => ['end_date']]);

        // Moving both together is fine.
        $this->assertApiSuccess($this->putJson("/api/packages/{$package->id}", [
            'start_date' => '2027-04-01',
            'end_date' => '2027-04-10',
        ]));
    }

    #[Test]
    public function invalid_values_are_rejected_field_by_field(): void
    {
        $response = $this->postJson('/api/packages', [
            'name' => str_repeat('x', 256),
            'price' => -5,
            'days' => 0,
            'features' => 'not-an-array',
            'start_date' => 'yesterday-ish',
        ]);

        $this->assertApiError($response, 422)
            ->assertJsonStructure(['errors' => ['name', 'price', 'days', 'features', 'start_date']]);
    }

    #[Test]
    public function the_trip_type_is_not_limited_to_a_fixed_list(): void
    {
        // Spec §13 names Ramadan Umrah, Family Umrah, VIP and Economy among
        // others, and calls them examples — so a company must be able to use a
        // label the system has never seen without waiting for a migration.
        foreach (['Hajj', 'Umrah', 'Ramadan Umrah', 'Family Umrah', 'VIP', 'Economy', 'Group Umrah'] as $type) {
            $response = $this->postJson('/api/packages', [
                'name' => "Package: {$type}",
                'trip_type' => $type,
            ]);

            $this->assertApiSuccess($response, 201)->assertJsonPath('data.trip_type', $type);
        }
    }

    #[Test]
    public function a_package_can_be_listed_searched_and_filtered(): void
    {
        Package::factory()->forCompany($this->company)->create(['name' => 'Ramadan Umrah', 'trip_type' => 'umrah', 'price' => 35000]);
        Package::factory()->forCompany($this->company)->create(['name' => 'Hajj Deluxe', 'trip_type' => 'hajj', 'price' => 90000]);
        Package::factory()->forCompany($this->company)->create(['name' => 'Economy Umrah', 'trip_type' => 'umrah', 'price' => 12000]);

        $this->assertCount(3, $this->getJson('/api/packages')->json('data'));
        $this->assertCount(2, $this->getJson('/api/packages?trip_type=umrah')->json('data'));
        $this->assertCount(1, $this->getJson('/api/packages?search=Ramadan')->json('data'));
        $this->assertCount(2, $this->getJson('/api/packages?min_price=30000')->json('data'));
        $this->assertCount(1, $this->getJson('/api/packages?min_price=20000&max_price=50000')->json('data'));
    }

    #[Test]
    public function a_wildcard_in_the_search_term_is_treated_as_a_literal(): void
    {
        Package::factory()->forCompany($this->company)->create(['name' => 'Ramadan Umrah']);
        Package::factory()->forCompany($this->company)->create(['name' => 'Hajj Deluxe']);

        // "%" must match nothing, not everything.
        $this->assertCount(0, $this->getJson('/api/packages?search=%')->json('data'));
    }

    #[Test]
    public function the_list_is_paginated_with_a_capped_page_size(): void
    {
        Package::factory()->count(30)->forCompany($this->company)->create();

        $response = $this->getJson('/api/packages?per_page=5');

        $this->assertCount(5, $response->json('data'));
        $this->assertSame(30, $response->json('meta.total'));
        $this->assertSame(6, $response->json('meta.last_page'));

        // A caller cannot ask for the whole table in one response.
        $this->assertSame(100, $this->getJson('/api/packages?per_page=9999')->json('meta.per_page'));
    }

    #[Test]
    public function a_deleted_package_is_soft_deleted_and_disappears_from_the_api(): void
    {
        $package = Package::factory()->forCompany($this->company)->create();

        $this->assertApiSuccess($this->deleteJson("/api/packages/{$package->id}"));

        $this->assertSoftDeleted($package);
        $this->assertApiError($this->getJson("/api/packages/{$package->id}"), 404);
        $this->assertCount(0, $this->getJson('/api/packages')->json('data'));
    }

    // -- Images --------------------------------------------------------------

    #[Test]
    public function an_image_is_stored_on_disk_and_referenced_by_path(): void
    {
        Storage::fake('public');

        $response = $this->post('/api/packages', [
            'name' => 'With Photo',
            'image' => UploadedFile::fake()->image('brochure.jpg', 800, 600),
        ], ['Accept' => 'application/json']);

        $this->assertApiSuccess($response, 201);

        $path = $response->json('data.image_path');

        $this->assertStringStartsWith('packages/', $path);
        Storage::disk('public')->assertExists($path);

        // The client's filename never reaches the filesystem.
        $this->assertStringNotContainsString('brochure', $path);
        $this->assertNotNull($response->json('data.image_url'));
    }

    #[Test]
    public function a_non_image_upload_is_rejected(): void
    {
        Storage::fake('public');

        $response = $this->post('/api/packages', [
            'name' => 'Malicious',
            'image' => UploadedFile::fake()->create('shell.php', 16, 'application/x-php'),
        ], ['Accept' => 'application/json']);

        $this->assertApiError($response, 422)->assertJsonStructure(['errors' => ['image']]);
        $this->assertSame(0, Package::query()->count());
    }

    #[Test]
    public function an_image_with_absurd_dimensions_is_rejected(): void
    {
        Storage::fake('public');

        /*
         * The size limit does not bound this on its own. A 50000 × 50000 PNG
         * of one flat colour compresses to well under five megabytes and
         * passes every other rule — and then every browser that opens the
         * page has to decode two and a half billion pixels. The server
         * shrugs; the reader's tab stops responding.
         */
        /*
         * Over the limit on one side only. A genuinely square monster would
         * have to be allocated here before it could be posted — the first
         * attempt at this test asked GD for 50000 × 50000 and brought down
         * the test run instead of the request.
         */
        $response = $this->post('/api/packages', [
            'name' => 'Decompression bomb',
            'image' => UploadedFile::fake()->image('huge.png', 7000, 120),
        ], ['Accept' => 'application/json']);

        $this->assertApiError($response, 422)->assertJsonStructure(['errors' => ['image']]);
        $this->assertSame(0, Package::query()->count());
    }

    #[Test]
    public function an_ordinary_photograph_is_still_accepted(): void
    {
        Storage::fake('public');

        // The guard above has to leave real uploads alone: this is larger
        // than anything a phone produces and well inside the limit.
        $this->assertApiSuccess(
            $this->post('/api/packages', [
                'name' => 'Real photo',
                'image' => UploadedFile::fake()->image('photo.jpg', 4032, 3024),
            ], ['Accept' => 'application/json']),
            201,
        );
    }

    #[Test]
    public function an_oversized_image_is_rejected(): void
    {
        Storage::fake('public');

        $response = $this->post('/api/packages', [
            'name' => 'Huge',
            'image' => UploadedFile::fake()->image('big.jpg')->size(6000),   // 6 MB
        ], ['Accept' => 'application/json']);

        $this->assertApiError($response, 422)->assertJsonStructure(['errors' => ['image']]);
    }

    #[Test]
    public function replacing_an_image_removes_the_previous_file(): void
    {
        Storage::fake('public');

        $created = $this->post('/api/packages', [
            'name' => 'Swap',
            'image' => UploadedFile::fake()->image('first.jpg'),
        ], ['Accept' => 'application/json']);

        $first = $created->json('data.image_path');
        $id = $created->json('data.id');

        $updated = $this->post("/api/packages/{$id}", [
            '_method' => 'PUT',
            'image' => UploadedFile::fake()->image('second.jpg'),
        ], ['Accept' => 'application/json']);

        $second = $updated->json('data.image_path');

        $this->assertNotSame($first, $second);
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);
    }

    #[Test]
    public function an_image_can_be_removed_explicitly(): void
    {
        Storage::fake('public');

        $created = $this->post('/api/packages', [
            'name' => 'Drop it',
            'image' => UploadedFile::fake()->image('photo.jpg'),
        ], ['Accept' => 'application/json']);

        $path = $created->json('data.image_path');
        $id = $created->json('data.id');

        $response = $this->putJson("/api/packages/{$id}", ['remove_image' => true]);

        $this->assertApiSuccess($response)->assertJsonPath('data.image_path', null);
        Storage::disk('public')->assertMissing($path);
    }
}
