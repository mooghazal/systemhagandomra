<?php

namespace Database\Factories;

use App\Enums\UserRole;
use App\Models\Company;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'password' => 'factory-password',   // hashed by the model cast
            'phone' => $this->faker->numerify('+9665########'),
            'role' => UserRole::Employee,
            'company_id' => Company::factory(),
            'is_active' => true,
        ];
    }

    /**
     * `role` and `company_id` are not mass-assignable — that is the point of
     * them — so the factory writes them unguarded rather than the application
     * loosening its own rules to make tests convenient.
     */
    public function newModel(array $attributes = []): Model
    {
        $class = $this->modelName();

        return (new $class)->forceFill($attributes);
    }

    public function superAdmin(): static
    {
        return $this->state(fn () => [
            'role' => UserRole::SuperAdmin,
            'company_id' => null,   // required by the users_role_company_check constraint
        ]);
    }

    public function owner(): static
    {
        return $this->state(fn () => ['role' => UserRole::Owner]);
    }

    public function employee(): static
    {
        return $this->state(fn () => ['role' => UserRole::Employee]);
    }

    public function forCompany(Company|int $company): static
    {
        return $this->state(fn () => [
            'company_id' => $company instanceof Company ? $company->id : $company,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    public function withPermissions(array $permissions): static
    {
        return $this->afterCreating(function (User $user) use ($permissions) {
            $ids = Permission::query()->whereIn('name', $permissions)->pluck('id');

            $user->permissions()->sync($ids);
        });
    }
}
