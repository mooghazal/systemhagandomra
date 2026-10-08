<?php

namespace App\Policies;

class BusPolicy extends CompanyResourcePolicy
{
    protected function permissionPrefix(): string
    {
        return 'buses';
    }
}
