<?php

namespace Database\Factories;

use App\Enums\TripType;
use App\Models\Company;
use App\Models\Package;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<Package>
 */
class PackageFactory extends Factory
{
    protected $model = Package::class;

    public function definition(): array
    {
        $start = $this->faker->dateTimeBetween('+1 week', '+6 months');
        $days = $this->faker->numberBetween(5, 21);

        return [
            'company_id' => Company::factory(),
            'name' => $this->faker->randomElement(['Ramadan', 'Economy', 'VIP', 'Family']).' Umrah',
            'description' => $this->faker->paragraph(),
            'price' => $this->faker->randomFloat(2, 3000, 60000),
            'currency' => 'SAR',
            'days' => $days,
            'start_date' => $start,
            'end_date' => (clone $start)->modify("+{$days} days"),
            'trip_type' => $this->faker->randomElement([
                'Hajj', 'Umrah', 'Ramadan Umrah', 'Family Umrah', 'VIP', 'Economy',
            ]),
            'location' => $this->faker->randomElement(['Makkah', 'Madinah', 'Jeddah']),
            'features' => $this->faker->randomElements(
                ['Hotel', 'Transportation', 'Meals', 'Visa', 'Guide'],
                $this->faker->numberBetween(0, 4)
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

    /**
     * A package with only the required field set, for checking that optional
     * values stay null instead of being filled in with defaults.
     */
    public function minimal(): static
    {
        return $this->state(fn () => [
            'description' => null,
            'price' => null,
            'currency' => null,
            'days' => null,
            'start_date' => null,
            'end_date' => null,
            'trip_type' => null,
            'location' => null,
            'features' => null,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
