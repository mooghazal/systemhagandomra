<?php

namespace App\Services;

use App\Models\Package;
use Illuminate\Database\Eloquent\Builder;

class PackageService extends CompanyResourceService
{
    protected function modelClass(): string
    {
        return Package::class;
    }

    protected function imageDirectory(): string
    {
        return 'packages';
    }

    protected function applyFilters(Builder $query, array $filters): Builder
    {
        if (! empty($filters['trip_type'])) {
            $query->where('trip_type', $filters['trip_type']);
        }

        if (isset($filters['min_price']) && $filters['min_price'] !== null) {
            $query->where('price', '>=', $filters['min_price']);
        }

        if (isset($filters['max_price']) && $filters['max_price'] !== null) {
            $query->where('price', '<=', $filters['max_price']);
        }

        if (! empty($filters['location'])) {
            $query->where('location', 'like', '%'.self::escapeLike($filters['location']).'%');
        }

        return $query;
    }

    /** @return array<int, string> */
    protected function sortableColumns(): array
    {
        return ['id', 'name', 'price', 'days', 'start_date', 'end_date', 'created_at', 'updated_at'];
    }
}
