<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/audit-logs — read-only.
 *
 * Super admins see every company; owners see their own. The trail is
 * append-only, so there is no store, update or destroy.
 */
class AuditLogController extends Controller
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AuditLog::class);

        $query = AuditLog::query();

        $companyId = $this->tenant->resolveCompanyIdForRead(
            $request->filled('company_id') ? (int) $request->query('company_id') : null
        );

        if ($companyId !== null) {
            $query->ofCompany($companyId);
        }

        foreach (['action', 'resource_type', 'source'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        if ($request->filled('resource_id')) {
            $query->where('resource_id', (int) $request->query('resource_id'));
        }

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->date('to'));
        }

        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $logs = $query->orderByDesc('id')->paginate($perPage)->withQueryString();

        return ApiResponse::paginated(AuditLogResource::collection($logs));
    }
}
