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
     * GET /api/stats/packages-by-type
     *
     * How the catalogue breaks down by trip type — the one question a count
     * cannot answer. "Ninety packages" says nothing about whether they are all
     * Ramadan Umrah and the company has nothing for Hajj.
     *
     * Gated on the same permission as the package list it summarises: a
     * breakdown is a weaker read of the same data, and it should not be a way
     * to see around that permission.
     */
    public function packagesByType(): JsonResponse
    {
        $user = $this->tenant->user();

        $this->authorize('viewAny', Package::class);

        $query = Package::query();

        if (! $user->isSuperAdmin()) {
            $query->where('company_id', $user->company_id);
        }

        /*
         * trip_type is free text, so this is whatever companies have actually
         * typed — not a fixed list. An untyped package is its own bucket
         * rather than being dropped: "forty with no type set" is worth seeing.
         */
        $rows = $query->selectRaw('COALESCE(NULLIF(TRIM(trip_type), ""), ?) as label, COUNT(*) as total', ['غير محدّد'])
            ->groupBy('label')
            ->orderByDesc('total')
            ->get();

        /*
         * More than a handful of bars stops being readable, and trip_type has
         * no ceiling. The tail folds into one bucket rather than being cut,
         * so the totals still add up to the catalogue.
         */
        $top = $rows->take(self::MAX_SLICES);
        $rest = $rows->slice(self::MAX_SLICES);

        $breakdown = $top->map(fn ($row) => [
            'label' => (string) $row->label,
            'total' => (int) $row->total,
        ])->values()->all();

        if ($rest->isNotEmpty()) {
            $breakdown[] = ['label' => 'أخرى', 'total' => (int) $rest->sum('total')];
        }

        return ApiResponse::success(['breakdown' => $breakdown]);
    }

    /** Bars beyond this fold into "أخرى". */
    private const MAX_SLICES = 6;

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
