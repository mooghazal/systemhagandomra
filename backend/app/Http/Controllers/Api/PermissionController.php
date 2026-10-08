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
