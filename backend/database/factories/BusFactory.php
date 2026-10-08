<?php

namespace Database\Factories;

use App\Models\Bus;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<Bus>
 */
class BusFactory extends Factory
{
    protected $model = Bus::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name' => 'Bus '.$this->faker->unique()->numberBetween(1, 999),
            'type' => $this->faker->randomElement(['VIP', 'Standard', 'Sleeper']),
            'capacity' => $this->faker->randomElement([30, 45, 50]),
            'model' => $this->faker->randomElement(['Mercedes Tourismo', 'Scania Touring', 'MAN Lion']),
            'description' => $this->faker->sentence(),
            'features' => $this->faker->randomElements(
                ['Air conditioning', 'Wifi', 'Refrigerator', 'USB charging'],
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
            'type' => null,
            'capacity' => null,
            'model' => null,
            'description' => null,
            'features' => null,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
