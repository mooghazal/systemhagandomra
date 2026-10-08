<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Hotel;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<Hotel>
 */
class HotelFactory extends Factory
{
    protected $model = Hotel::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name' => $this->faker->randomElement(['Hilton', 'Swissotel', 'Pullman', 'Anjum']).' '.$this->faker->citySuffix(),
            'location' => $this->faker->randomElement(['Makkah', 'Madinah']),
            'description' => $this->faker->paragraph(),
            'distance_from_haram' => $this->faker->numberBetween(50, 3000),
            'distance_from_masjid_nabawi' => null,
            'rating' => $this->faker->numberBetween(3, 5),
            'room_type' => $this->faker->randomElement(['Double', 'Triple', 'Quad', 'Suite']),
            'features' => $this->faker->randomElements(
                ['Breakfast', 'Wifi', 'Shuttle', 'Laundry'],
                $this->faker->numberBetween(0, 3)
            ),
            'is_active' => true,
        ];
    }

    /** `company_id` is not mass-assignable; see UserFactory::newModel(). */
    public function newModel(array $attributes = []): Model
    {
        $class = $this->modelName();

        return (new $class)->forceFill($attributes);
    }

    public function forCompany(Company|int $company): static
    {
        return $this->state(fn () => [
            'company_id' => $company instanceof Company ? $company->id : $company,
        ]);
    }

    public function minimal(): static
    {
        return $this->state(fn () => [
            'location' => null,
            'description' => null,
            'distance_from_haram' => null,
            'distance_from_masjid_nabawi' => null,
            'rating' => null,
            'room_type' => null,
            'features' => null,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
