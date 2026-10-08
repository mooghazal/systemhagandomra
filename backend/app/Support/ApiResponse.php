<?php

namespace App\Support;

use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\AbstractPaginator;

/**
 * The single response envelope used by every endpoint:
 *
 *   { "success": true,  "data": ... }
 *   { "success": false, "message": "...", "errors": { ... } }
 *
 * Keeping it in one place means the dashboards and the MCP client can parse
 * any response the same way, including errors raised deep inside the framework
 * (see App\Exceptions\Handler wiring in bootstrap/app.php).
 */
final class ApiResponse
{
    public static function success(mixed $data = null, int $status = 200, array $meta = []): JsonResponse
    {
        $payload = ['success' => true, 'data' => self::normalise($data)];

        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    public static function created(mixed $data = null): JsonResponse
    {
        return self::success($data, 201);
    }

    public static function noContent(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => null], 200);
    }

    public static function error(string $message, int $status = 400, array $errors = []): JsonResponse
    {
        $payload = ['success' => false, 'message' => $message];

        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }

    /**
     * Paginated collections keep their rows under `data` and move the paging
     * details to `meta`, so clients never have to unwrap two envelopes.
     */
    public static function paginated(ResourceCollection|AbstractPaginator $collection): JsonResponse
    {
        $paginator = $collection instanceof ResourceCollection
            ? $collection->resource
            : $collection;

        $items = $collection instanceof ResourceCollection
            ? $collection->collection
            : $paginator->getCollection();

        return self::success(self::normalise($items), 200, [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ]);
    }

    private static function normalise(mixed $data): mixed
    {
        return match (true) {
            $data instanceof JsonResource,
            $data instanceof Arrayable => $data->toArray(request()),
            default => $data,
        };
    }
}
