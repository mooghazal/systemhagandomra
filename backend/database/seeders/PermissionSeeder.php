<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Support\Permissions;
use Illuminate\Database\Seeder;

/**
 * Mirrors App\Support\Permissions into the permissions table.
 *
 * Idempotent: safe to run on every deploy, which is how new permissions reach
 * an existing installation. Permissions removed from the registry are deleted,
 * and their employee grants cascade away with them.
 */
class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Permissions::definitions() as $name => [$group, $label]) {
            Permission::query()->updateOrCreate(
                ['name' => $name],
                ['group' => $group, 'label' => $label],
            );
        }

        Permission::query()->whereNotIn('name', Permissions::all())->delete();
    }
}
