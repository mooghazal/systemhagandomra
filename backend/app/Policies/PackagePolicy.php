<?php

namespace App\Policies;

class PackagePolicy extends CompanyResourcePolicy
{
    protected function permissionPrefix(): string
    {
        return 'packages';
    }
}
