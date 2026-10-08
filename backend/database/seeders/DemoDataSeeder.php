<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use App\Models\Permission;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Development and testing data only.
 *
 * Never part of DatabaseSeeder — run it deliberately:
 *
 *     php artisan db:seed --class=DemoDataSeeder
 *
 * It refuses to run in production, and every password here is an obvious
 * placeholder rather than anything that could be mistaken for a real
 * credential.
 *
 * Two companies are created on purpose: cross-tenant behaviour is impossible
 * to eyeball with only one.
 */
class DemoDataSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'demo-password-123';

    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DemoDataSeeder will not run in production.');

            return;
        }

        $this->call(PermissionSeeder::class);

        DB::transaction(function () {
            $alpha = $this->makeCompany('Al Noor Travel', 'alnoor.example');
            $beta = $this->makeCompany('Baraka Tours', 'baraka.example');

            $this->populate($alpha, 'Makkah');
            $this->populate($beta, 'Madinah');
        });

        $this->command?->info('Demo data created. All demo accounts use the password: '.self::DEMO_PASSWORD);
        $this->command?->info('  Owners:    owner@alnoor.example / owner@baraka.example');
        $this->command?->info('  Employees: *.employee@<company domain>');
    }

    private function makeCompany(string $name, string $domain): Company
    {
        $company = new Company;
        $company->fill([
            'name' => $name,
            'domain' => $domain,
            'email' => "info@{$domain}",
            'phone' => '+966500000000',
            'address' => 'Saudi Arabia',
        ]);
        $company->slug = Str::slug($name);
        $company->is_active = true;
        $company->save();

        return $company;
    }

    private function populate(Company $company, string $city): void
    {
        $domain = $company->domain;

        $this->makeUser($company, UserRole::Owner, 'Owner of '.$company->name, "owner@{$domain}");

        // One employee per shape of access, so every branch of the permission
        // model has something to click through.
        $manager = $this->makeUser($company, UserRole::Employee, 'Full Access Employee', "manager.employee@{$domain}");
        $this->grant($manager, Permissions::all());

        $sales = $this->makeUser($company, UserRole::Employee, 'Packages Only', "sales.employee@{$domain}");
        $this->grant($sales, [
            Permissions::PACKAGES_VIEW,
            Permissions::PACKAGES_CREATE,
            Permissions::PACKAGES_UPDATE,
        ]);

        $viewer = $this->makeUser($company, UserRole::Employee, 'Read Only', "viewer.employee@{$domain}");
        $this->grant($viewer, [
            Permissions::PACKAGES_VIEW,
            Permissions::HOTELS_VIEW,
            Permissions::BUSES_VIEW,
        ]);

        // No permissions at all — the account that should be refused everywhere.
        $this->makeUser($company, UserRole::Employee, 'No Permissions', "nobody.employee@{$domain}");

        // A deliberately uneven mix: some records carry every optional field,
        // others only a name, because that is exactly what the system has to
        // cope with (spec §43).
        Package::factory()->forCompany($company)->create([
            'name' => 'Ramadan Umrah',
            'description' => 'Ten nights across Makkah and Madinah.',
            'price' => 35000,
            'currency' => 'SAR',
            'days' => 10,
            'trip_type' => 'Ramadan Umrah',
            'location' => $city,
            'features' => ['Hotel', 'Transportation', 'Meals', 'Visa'],
        ]);

        Package::factory()->forCompany($company)->minimal()->create([
            'name' => 'Economy Umrah',
            'price' => 12000,
        ]);

        Package::factory()->forCompany($company)->minimal()->create([
            'name' => 'Enquire for pricing',
        ]);

        Package::factory()->count(3)->forCompany($company)->create();

        Hotel::factory()->forCompany($company)->create([
            'name' => 'Swissotel Al Maqam',
            'location' => 'Makkah',
            'distance_from_haram' => 150,
            'distance_from_masjid_nabawi' => null,
            'rating' => 5,
            'room_type' => 'Quad',
            'features' => ['Breakfast', 'Wifi', 'Elevator'],
        ]);

        Hotel::factory()->forCompany($company)->create([
            'name' => 'Anwar Al Madinah',
            'location' => 'Madinah',
            'distance_from_haram' => null,
            'distance_from_masjid_nabawi' => 300,
            'rating' => 4,
            'features' => ['Breakfast', 'Air Conditioning'],
        ]);

        Hotel::factory()->forCompany($company)->minimal()->create(['name' => 'Budget Guesthouse']);

        Bus::factory()->forCompany($company)->create([
            'name' => 'VIP Coach 1',
            'type' => 'VIP',
            'capacity' => 30,
            'model' => 'Mercedes Tourismo',
            'features' => ['Air Conditioning', 'Wifi', 'USB Charging', 'Reclining Seats'],
        ]);

        Bus::factory()->forCompany($company)->minimal()->create(['name' => 'Standard Coach 2']);
    }

    private function makeUser(Company $company, UserRole $role, string $name, string $email): User
    {
        $user = new User;
        $user->fill([
            'name' => $name,
            'email' => $email,
            'password' => self::DEMO_PASSWORD,
            'phone' => '+966500000000',
        ]);
        $user->role = $role;
        $user->company_id = $company->id;
        $user->is_active = true;
        $user->save();

        return $user;
    }

    /**
     * @param  array<int, string>  $permissions
     */
    private function grant(User $user, array $permissions): void
    {
        $user->permissions()->sync(
            Permission::query()->whereIn('name', $permissions)->pluck('id')
        );
    }
}
