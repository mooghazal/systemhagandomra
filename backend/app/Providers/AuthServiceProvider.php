<?php

namespace App\Providers;

use App\Models\AuditLog;
use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use App\Models\User;
use App\Policies\AuditLogPolicy;
use App\Policies\BusPolicy;
use App\Policies\CompanyPolicy;
use App\Policies\EmployeePolicy;
use App\Policies\HotelPolicy;
use App\Policies\PackagePolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    private array $policies = [
        Company::class => CompanyPolicy::class,
        User::class => EmployeePolicy::class,
        Package::class => PackagePolicy::class,
        Hotel::class => HotelPolicy::class,
        Bus::class => BusPolicy::class,
        AuditLog::class => AuditLogPolicy::class,
    ];

    public function boot(): void
    {
        foreach ($this->policies as $model => $policy) {
            Gate::policy($model, $policy);
        }

        /*
         * Runs before every policy method.
         *
         * Returning false short-circuits to a denial, true to a grant, and null
         * hands over to the policy. The order matters: the two kill switches
         * are checked before the super admin grant, so a disabled super admin
         * or one belonging to a disabled company is denied like anyone else.
         */
        Gate::before(function (User $user, string $ability) {
            if (! $user->is_active) {
                return false;
            }

            if (! $user->companyIsActive()) {
                return false;
            }

            return $user->isSuperAdmin() ? true : null;
        });
    }
}
