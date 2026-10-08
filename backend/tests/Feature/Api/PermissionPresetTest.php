<?php

namespace Tests\Feature\Api;

use App\Support\PermissionPresets;
use App\Support\Permissions;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Presets are a convenience in the grant dialog, so the things worth testing
 * are the ones that would make them quietly wrong rather than visibly broken:
 * a name that no longer exists, a set that grew without anyone noticing, or a
 * preset mistaken for a grant.
 */
class PermissionPresetTest extends TestCase
{
    #[Test]
    public function every_preset_names_only_real_permissions(): void
    {
        foreach (PermissionPresets::definitions() as $name => [, $permissions]) {
            foreach ($permissions as $permission) {
                $this->assertTrue(
                    Permissions::exists($permission),
                    "Preset '{$name}' names '{$permission}', which is not a permission. "
                    .'A preset pointing at a renamed permission silently grants less than it says.',
                );
            }
        }
    }

    #[Test]
    public function no_preset_lists_the_same_permission_twice(): void
    {
        foreach (PermissionPresets::definitions() as $name => [, $permissions]) {
            $this->assertSame(
                array_values(array_unique($permissions)),
                array_values($permissions),
                "Preset '{$name}' repeats a permission.",
            );
        }
    }

    #[Test]
    public function the_manager_preset_covers_the_whole_catalogue(): void
    {
        [, $manager] = PermissionPresets::definitions()['manager'];

        $this->assertEqualsCanonicalizing(Permissions::all(), $manager);
    }

    #[Test]
    public function the_read_only_preset_grants_nothing_that_writes(): void
    {
        [, $viewer] = PermissionPresets::definitions()['viewer'];

        foreach ($viewer as $permission) {
            $this->assertStringEndsWith(
                '.view',
                $permission,
                "The read-only preset includes '{$permission}'.",
            );
        }
    }

    #[Test]
    public function the_catalogue_endpoint_returns_the_presets(): void
    {
        $response = $this->actingAsUser($this->owner($this->company()))->getJson('/api/permissions');

        $this->assertApiSuccess($response)
            ->assertJsonPath('data.presets.0.name', 'manager')
            ->assertJsonCount(count(PermissionPresets::definitions()), 'data.presets');

        foreach ($response->json('data.presets') as $preset) {
            $this->assertArrayHasKey('label', $preset);
            $this->assertIsArray($preset['permissions']);
        }
    }

    #[Test]
    public function reading_the_presets_does_not_grant_anybody_anything(): void
    {
        /*
         * The whole safety argument for presets is that they are inert — a
         * list of names the dialog ticks boxes with. If merely fetching them
         * changed what an account could do, that argument would be wrong.
         */
        $employee = $this->employee($this->company(), []);

        $this->actingAsUser($employee)->getJson('/api/permissions')->assertOk();

        $this->assertSame([], $employee->fresh()->permissions->pluck('name')->all());

        $this->assertApiError(
            $this->nextRequest()->actingAsUser($employee)->getJson('/api/packages'),
            403,
        );
    }
}
