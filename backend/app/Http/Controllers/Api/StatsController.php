<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/stats — the counts behind the dashboard cards.
 *
 * Six separate list requests would answer the same question, so this exists to
 * save the dashboard five round trips, not to introduce a reporting layer.
 *
 * The numbers obey the same tenant rules as everything else: a super admin
 * sees the system, a company user sees their own company and no `companies`
 * count at all, because they have no business knowing how many exist.
 */
class StatsController extends Controller
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function index(): JsonResponse
    {
        $user = $this->tenant->user();

        return ApiResponse::success(
            $user->isSuperAdmin() ? $this->systemStats() : $this->companyStats($user)
        );
    }

    /**
     * @return array<string, int>
     */
    private function systemStats(): array
    {
        return [
            'companies' => Company::query()->count(),
            'active_companies' => Company::query()->active()->count(),
            'owners' => User::query()->owners()->count(),
            'employees' => User::query()->employees()->count(),
            'packages' => Package::query()->count(),
            'hotels' => Hotel::query()->count(),
            'buses' => Bus::query()->count(),
        ];
    }

    /**
     * Counts for the caller's own company — and only of the things they are
     * allowed to look at.
     *
     * A count is small but it is still data: how many staff a company has, how
     * much inventory it carries. An employee with no permissions could read
     * all of it here, because this route asks no policy anything. Each figure
     * now depends on the same `*.view` permission that guards the list it
     * summarises, so this endpoint cannot be used to see around them.
     *
     * @return array<string, int>
     */
    private function companyStats(User $user): array
    {
        $companyId = $user->company_id;

        // The global scope already limits these to the caller's company; the
        // explicit where is here so the intent survives a future refactor.
        $counts = [
            'employees' => fn () => User::query()->employees()->ofCompany($companyId)->count(),
            'packages' => fn () => Package::query()->where('company_id', $companyId)->count(),
            'hotels' => fn () => Hotel::query()->where('company_id', $companyId)->count(),
            'buses' => fn () => Bus::query()->where('company_id', $companyId)->count(),
        ];

        $stats = [];

        foreach ($counts as $resource => $count) {
            if ($user->hasPermissionTo("{$resource}.view")) {
                $stats[$resource] = $count();
            }
        }

        return $stats;
    }
}
