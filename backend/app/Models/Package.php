<?php

namespace App\Models;

use App\Enums\TripType;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Package extends Model
{
    use BelongsToCompany;
    use HasFactory;
    use SoftDeletes;

    /** `company_id` and `image_path` are set by PackageService, not by clients. */
    protected $fillable = [
        'name',
        'description',
        'price',
        'currency',
        'days',
        'start_date',
        'end_date',
        'trip_type',
        'location',
        'features',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'days' => 'integer',
            'start_date' => 'date',
            'end_date' => 'date',
            'features' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
