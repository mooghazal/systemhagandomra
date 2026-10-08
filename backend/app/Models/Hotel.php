<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Hotel extends Model
{
    use BelongsToCompany;
    use HasFactory;
    use SoftDeletes;

    /** `company_id` and `image_path` are set by HotelService, not by clients. */
    protected $fillable = [
        'name',
        'location',
        'description',
        'distance_from_haram',
        'distance_from_masjid_nabawi',
        'rating',
        'room_type',
        'features',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'distance_from_haram' => 'integer',
            'distance_from_masjid_nabawi' => 'integer',
            'rating' => 'integer',
            'features' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
