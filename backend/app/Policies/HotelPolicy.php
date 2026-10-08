<?php

namespace App\Policies;

class HotelPolicy extends CompanyResourcePolicy
{
    protected function permissionPrefix(): string
    {
        return 'hotels';
    }
}
