<?php

namespace App\Support;

/**
 * The single source of truth for permission names.
 *
 * Policies, the permissions seeder, the employee-permission validator and the
 * MCP tool definitions all read from here, so a permission cannot drift out of
 * sync between the dashboards and the agent.
 */
final class Permissions
{
    public const EMPLOYEES_VIEW = 'employees.view';
    public const EMPLOYEES_CREATE = 'employees.create';
    public const EMPLOYEES_UPDATE = 'employees.update';
    public const EMPLOYEES_DELETE = 'employees.delete';

    public const PACKAGES_VIEW = 'packages.view';
    public const PACKAGES_CREATE = 'packages.create';
    public const PACKAGES_UPDATE = 'packages.update';
    public const PACKAGES_DELETE = 'packages.delete';

    public const HOTELS_VIEW = 'hotels.view';
    public const HOTELS_CREATE = 'hotels.create';
    public const HOTELS_UPDATE = 'hotels.update';
    public const HOTELS_DELETE = 'hotels.delete';

    public const BUSES_VIEW = 'buses.view';
    public const BUSES_CREATE = 'buses.create';
    public const BUSES_UPDATE = 'buses.update';
    public const BUSES_DELETE = 'buses.delete';

    /**
     * name => [group, label]
     *
     * @return array<string, array{0: string, 1: string}>
     */
    public static function definitions(): array
    {
        return [
            self::EMPLOYEES_VIEW => ['employees', 'View employees'],
            self::EMPLOYEES_CREATE => ['employees', 'Create employees'],
            self::EMPLOYEES_UPDATE => ['employees', 'Update employees'],
            self::EMPLOYEES_DELETE => ['employees', 'Delete employees'],

            self::PACKAGES_VIEW => ['packages', 'View packages'],
            self::PACKAGES_CREATE => ['packages', 'Create packages'],
            self::PACKAGES_UPDATE => ['packages', 'Update packages'],
            self::PACKAGES_DELETE => ['packages', 'Delete packages'],

            self::HOTELS_VIEW => ['hotels', 'View hotels'],
            self::HOTELS_CREATE => ['hotels', 'Create hotels'],
            self::HOTELS_UPDATE => ['hotels', 'Update hotels'],
            self::HOTELS_DELETE => ['hotels', 'Delete hotels'],

            self::BUSES_VIEW => ['buses', 'View buses'],
            self::BUSES_CREATE => ['buses', 'Create buses'],
            self::BUSES_UPDATE => ['buses', 'Update buses'],
            self::BUSES_DELETE => ['buses', 'Delete buses'],
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function all(): array
    {
        return array_keys(self::definitions());
    }

    public static function exists(string $permission): bool
    {
        return array_key_exists($permission, self::definitions());
    }
}
