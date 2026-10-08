<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Bus extends Model
{
    use BelongsToCompany;
    use HasFactory;
    use SoftDeletes;

    /** Laravel would otherwise pluralise "Bus" to "bus". */
    protected $table = 'buses';

    /** `company_id` and `image_path` are set by BusService, not by clients. */
    protected $fillable = [
        'name',
        'type',
        'capacity',
        'model',
        'description',
        'features',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'features' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
