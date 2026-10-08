<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Creates the first super admin from the environment.
 *
 * There is deliberately no default password: if SUPER_ADMIN_PASSWORD is unset
 * the seeder stops rather than creating a system-level account with a
 * guessable credential.
 */
class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = mb_strtolower((string) env('SUPER_ADMIN_EMAIL', 'admin@hagamra.test'));
        $password = (string) env('SUPER_ADMIN_PASSWORD', '');

        if ($password === '') {
            throw new RuntimeException(
                'SUPER_ADMIN_PASSWORD is not set. Choose a password in .env before seeding.'
            );
        }

        if (User::query()->where('email', $email)->exists()) {
            $this->command?->info("Super admin {$email} already exists; leaving it untouched.");

            return;
        }

        $admin = new User;
        $admin->fill([
            'name' => (string) env('SUPER_ADMIN_NAME', 'Super Admin'),
            'email' => $email,
            'password' => $password,
        ]);
        $admin->role = UserRole::SuperAdmin;
        $admin->company_id = null;
        $admin->is_active = true;
        $admin->save();

        $this->command?->info("Created super admin {$email}.");
    }
}
