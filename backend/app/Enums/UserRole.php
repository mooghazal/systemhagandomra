<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case Owner = 'owner';
    case Employee = 'employee';

    /**
     * Super admins operate above the tenant boundary; everyone else is bound
     * to exactly one company.
     */
    public function belongsToCompany(): bool
    {
        return $this !== self::SuperAdmin;
    }

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::Owner => 'Company Owner',
            self::Employee => 'Employee',
        };
    }
}
