<?php

namespace App\Support;

/**
 * Named bundles of permissions, offered as a starting point when an owner sets
 * up an employee.
 *
 * Granting sixteen permissions one checkbox at a time is tedious enough that
 * people stop reading them, and the usual result is everyone getting
 * everything because it was quicker. A handful of named shapes — the ones a
 * travel company actually hires for — makes the careful choice the easy one.
 *
 * These are a convenience and nothing more. Applying one just ticks boxes; the
 * employee still ends up with an explicit list of permissions, stored and
 * checked exactly as if each had been ticked by hand. Nothing here grants
 * anything, no policy consults it, and a preset cannot widen what an owner was
 * already allowed to grant.
 *
 * The sets are built from the Permissions constants rather than written out as
 * strings, so a permission renamed there cannot leave a preset pointing at a
 * name that no longer exists.
 */
final class PermissionPresets
{
    /**
     * name => [label, [permissions]]
     *
     * @return array<string, array{0: string, 1: array<int, string>}>
     */
    public static function definitions(): array
    {
        $full = static fn (string $group): array => [
            "{$group}.view", "{$group}.create", "{$group}.update", "{$group}.delete",
        ];

        return [
            // Everything an owner can delegate — which is everything except
            // the owner-only powers (credentials and granting permissions),
            // and those are not in the catalogue to begin with.
            'manager' => ['Manager', Permissions::all()],

            // The trips and what they are made of, with no say over who works
            // here. The common shape: someone runs the catalogue, someone else
            // runs the staff.
            'operations' => ['Operations', [
                ...$full('packages'),
                ...$full('hotels'),
                ...$full('buses'),
            ]],

            // Builds and prices the offers, and needs to see the hotels and
            // buses to do it — but does not maintain them, and cannot remove a
            // package once it is out.
            'sales' => ['Sales', [
                Permissions::PACKAGES_VIEW,
                Permissions::PACKAGES_CREATE,
                Permissions::PACKAGES_UPDATE,
                Permissions::HOTELS_VIEW,
                Permissions::BUSES_VIEW,
            ]],

            // Sees the work, changes none of it.
            'viewer' => ['Read only', [
                Permissions::PACKAGES_VIEW,
                Permissions::HOTELS_VIEW,
                Permissions::BUSES_VIEW,
                Permissions::EMPLOYEES_VIEW,
            ]],
        ];
    }

    /**
     * The shape the API returns: a flat list, ordered as above.
     *
     * @return array<int, array{name: string, label: string, permissions: array<int, string>}>
     */
    public static function all(): array
    {
        $presets = [];

        foreach (self::definitions() as $name => [$label, $permissions]) {
            $presets[] = [
                'name' => $name,
                'label' => $label,
                'permissions' => array_values($permissions),
            ];
        }

        return $presets;
    }
}
