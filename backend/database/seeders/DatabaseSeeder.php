<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Production-safe: creates the permission catalogue and the first super admin,
 * nothing else.
 *
 * Sample companies and content live in DemoDataSeeder, which has to be asked
 * for by name:  php artisan db:seed --class=DemoDataSeeder
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            SuperAdminSeeder::class,
        ]);
    }
}
