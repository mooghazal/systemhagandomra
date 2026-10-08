<?php

namespace App\Services;

use App\Models\Hotel;
use Illuminate\Database\Eloquent\Builder;

class HotelService extends CompanyResourceService
{
    protected function modelClass(): string
    {
        return Hotel::class;
    }

    protected function imageDirectory(): string
    {
        return 'hotels';
    }

    protected function applyFilters(Builder $query, array $filters): Builder
    {
        if (! empty($filters['location'])) {
            $query->where('location', 'like', '%'.self::escapeLike($filters['location']).'%');
        }

        if (isset($filters['min_rating']) && $filters['min_rating'] !== null) {
            $query->where('rating', '>=', (int) $filters['min_rating']);
        }

        if (isset($filters['max_distance_from_haram']) && $filters['max_distance_from_haram'] !== null) {
            $query->where('distance_from_haram', '<=', (int) $filters['max_distance_from_haram']);
        }

        if (isset($filters['max_distance_from_masjid_nabawi']) && $filters['max_distance_from_masjid_nabawi'] !== null) {
            $query->where('distance_from_masjid_nabawi', '<=', (int) $filters['max_distance_from_masjid_nabawi']);
        }

        return $query;
    }

    /** @return array<int, string> */
    protected function sortableColumns(): array
    {
        return ['id', 'name', 'rating', 'distance_from_haram', 'distance_from_masjid_nabawi', 'created_at', 'updated_at'];
    }
}
