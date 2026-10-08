<?php

namespace Tests\Feature\Api;

use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Hotels and buses share their machinery with packages (CompanyResourceService),
 * so this covers what is specific to them rather than repeating PackageApiTest.
 */
class HotelAndBusApiTest extends TestCase
{
    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->actingAsUser($this->owner($this->company));
    }

    // -- Hotels --------------------------------------------------------------

    #[Test]
    public function a_hotel_needs_only_a_name(): void
    {
        $response = $this->postJson('/api/hotels', ['name' => 'Swissotel Al Maqam']);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.name', 'Swissotel Al Maqam')
            ->assertJsonPath('data.rating', null)
            ->assertJsonPath('data.distance_from_haram', null)
            ->assertJsonPath('data.distance_from_masjid_nabawi', null)
            ->assertJsonPath('data.features', []);
    }

    #[Test]
    public function a_makkah_hotel_records_one_distance_and_leaves_the_other_null(): void
    {
        $response = $this->postJson('/api/hotels', [
            'name' => 'Anjum Makkah',
            'location' => 'Makkah',
            'distance_from_haram' => 850,
            'rating' => 5,
            'room_type' => 'Quad',
            'features' => ['Breakfast', 'Shuttle'],
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.distance_from_haram', 850)
            ->assertJsonPath('data.distance_from_masjid_nabawi', null)
            ->assertJsonPath('data.rating', 5);
    }

    #[Test]
    public function the_rating_is_limited_to_one_through_five(): void
    {
        $this->assertApiError($this->postJson('/api/hotels', ['name' => 'X', 'rating' => 6]), 422)
            ->assertJsonStructure(['errors' => ['rating']]);

        $this->assertApiError($this->postJson('/api/hotels', ['name' => 'X', 'rating' => 0]), 422);
    }

    #[Test]
    public function hotels_can_be_filtered_by_rating_and_distance(): void
    {
        Hotel::factory()->forCompany($this->company)->create(['rating' => 5, 'distance_from_haram' => 200]);
        Hotel::factory()->forCompany($this->company)->create(['rating' => 3, 'distance_from_haram' => 2500]);
        Hotel::factory()->forCompany($this->company)->create(['rating' => 4, 'distance_from_haram' => 900]);

        $this->assertCount(2, $this->getJson('/api/hotels?min_rating=4')->json('data'));
        $this->assertCount(2, $this->getJson('/api/hotels?max_distance_from_haram=1000')->json('data'));
        $this->assertCount(1, $this->getJson('/api/hotels?min_rating=4&max_distance_from_haram=500')->json('data'));
    }

    #[Test]
    public function a_hotel_can_be_updated_and_deleted(): void
    {
        $hotel = Hotel::factory()->forCompany($this->company)->create(['name' => 'Before']);

        $this->assertApiSuccess($this->putJson("/api/hotels/{$hotel->id}", ['name' => 'After']))
            ->assertJsonPath('data.name', 'After');

        $this->assertApiSuccess($this->deleteJson("/api/hotels/{$hotel->id}"));
        $this->assertSoftDeleted($hotel);
    }

    // -- Buses ---------------------------------------------------------------

    #[Test]
    public function a_bus_needs_only_a_name(): void
    {
        $response = $this->postJson('/api/buses', ['name' => 'Fleet 12']);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.name', 'Fleet 12')
            ->assertJsonPath('data.capacity', null)
            ->assertJsonPath('data.type', null)
            ->assertJsonPath('data.model', null)
            ->assertJsonPath('data.features', []);
    }

    #[Test]
    public function a_vip_bus_records_its_details(): void
    {
        $response = $this->postJson('/api/buses', [
            'name' => 'VIP 1',
            'type' => 'VIP',
            'capacity' => 30,
            'model' => 'Mercedes Tourismo',
            'features' => ['Air conditioning', 'Wifi'],
        ]);

        $this->assertApiSuccess($response, 201)
            ->assertJsonPath('data.type', 'VIP')
            ->assertJsonPath('data.capacity', 30)
            ->assertJsonPath('data.features', ['Air conditioning', 'Wifi']);
    }

    #[Test]
    public function the_capacity_must_be_a_sensible_number(): void
    {
        $this->assertApiError($this->postJson('/api/buses', ['name' => 'X', 'capacity' => 0]), 422)
            ->assertJsonStructure(['errors' => ['capacity']]);

        $this->assertApiError($this->postJson('/api/buses', ['name' => 'X', 'capacity' => 5000]), 422);
    }

    #[Test]
    public function buses_can_be_filtered_by_type_and_capacity(): void
    {
        Bus::factory()->forCompany($this->company)->create(['type' => 'VIP', 'capacity' => 30]);
        Bus::factory()->forCompany($this->company)->create(['type' => 'Standard', 'capacity' => 50]);
        Bus::factory()->forCompany($this->company)->create(['type' => 'VIP', 'capacity' => 45]);

        $this->assertCount(2, $this->getJson('/api/buses?type=VIP')->json('data'));
        $this->assertCount(2, $this->getJson('/api/buses?min_capacity=45')->json('data'));
    }

    #[Test]
    public function the_buses_table_is_used_rather_than_a_mispluralised_one(): void
    {
        $bus = Bus::factory()->forCompany($this->company)->create();

        $this->assertSame('buses', $bus->getTable());
        $this->assertDatabaseHas('buses', ['id' => $bus->id]);
    }
}
