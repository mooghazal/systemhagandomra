<?php

namespace App\Services;

use App\Models\Bus;
use Illuminate\Database\Eloquent\Builder;

class BusService extends CompanyResourceService
{
    protected function modelClass(): string
    {
        return Bus::class;
    }

    protected function imageDirectory(): string
    {
        return 'buses';
    }

    protected function applyFilters(Builder $query, array $filters): Builder
    {
        if (! empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (isset($filters['min_capacity']) && $filters['min_capacity'] !== null) {
            $query->where('capacity', '>=', (int) $filters['min_capacity']);
        }

        return $query;
    }

    /** @return array<int, string> */
    protected function sortableColumns(): array
    {
        return ['id', 'name', 'capacity', 'created_at', 'updated_at'];
    }
}
