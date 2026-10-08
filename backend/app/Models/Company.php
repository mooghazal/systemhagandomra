<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use HasFactory;
    use SoftDeletes;

    /** `slug` is derived from the name by CompanyService, never supplied by a client. */
    protected $fillable = [
        'name',
        'domain',
        'email',
        'phone',
        'address',
    ];

    /**
     * `live_slug` and `live_domain` are generated columns that exist only to
     * carry a unique index over non-deleted rows (see the companies
     * migration). The database computes them; nothing should read or write
     * them, so they stay out of both $fillable and any serialised output.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'live_slug',
        'live_domain',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function owners(): HasMany
    {
        return $this->hasMany(User::class)->owners();
    }

    public function employees(): HasMany
    {
        return $this->hasMany(User::class)->employees();
    }

    public function packages(): HasMany
    {
        return $this->hasMany(Package::class);
    }

    public function hotels(): HasMany
    {
        return $this->hasMany(Hotel::class);
    }

    public function buses(): HasMany
    {
        return $this->hasMany(Bus::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
