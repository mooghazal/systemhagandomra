<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PermissionResource;
use App\Models\Permission;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/permissions — the catalogue the dashboards render as checkboxes
 * when editing an employee.
 *
 * Read-only: the permission list is fixed in App\Support\Permissions and
 * seeded, not managed through the API.
 */
class PermissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /*
         * No authorize() call, deliberately — the one action in the API
         * without one.
         *
         * This is the fixed, seeded catalogue of permission names: no tenant
         * data, no account data, the same sixteen rows for everyone. Gating it
         * was tried and reverted. It protects nothing, and the suspended-
         * account test in EscalationTest leans on this route precisely because
         * it consults no policy — that is how it proves the kill switch
         * reaches routes Gate::before never sees.
         */
        $permissions = Permission::query()
            ->orderBy('group')
            ->orderBy('name')
            ->get();

        return ApiResponse::success([
            'permissions' => PermissionResource::collection($permissions)->toArray($request),
            'groups' => $permissions->groupBy('group')->map(
                fn ($group) => $group->pluck('name')->values()
            ),
        ]);
    }
}
