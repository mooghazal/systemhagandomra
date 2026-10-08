<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use Notifiable;
    use SoftDeletes;

    /**
     * Deliberately narrow.
     *
     * `company_id`, `role` and `is_active` decide what the account may do, so
     * they are never mass-assignable. Services set them explicitly after the
     * caller has been authorised. See docs/SECURITY.md.
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        // Generated columns carrying unique indexes over non-deleted rows;
        // the database computes them. See the users migration.
        'live_email',
        'owner_of_company',
    ];

    /** Request-lifetime memo for companyIsActive(). */
    private ?bool $companyIsActive = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
        ];
    }

    // -- Relations ------------------------------------------------------------

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'employee_permissions')
            ->withTimestamps();
    }

    // -- Role helpers ---------------------------------------------------------

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SuperAdmin;
    }

    public function isOwner(): bool
    {
        return $this->role === UserRole::Owner;
    }

    public function isEmployee(): bool
    {
        return $this->role === UserRole::Employee;
    }

    /**
     * Whether the company this account belongs to is still enabled.
     *
     * Deliberately a scalar query rather than `$this->company->is_active`: this
     * runs inside Gate::before on every authorisation check, where touching a
     * relation would trip strict lazy-loading. Memoised for the request.
     *
     * A soft-deleted company is filtered out by Company's own scope, so the
     * lookup finds nothing and the answer is false — deleting a company locks
     * its users out as surely as disabling it.
     */
    public function companyIsActive(): bool
    {
        if (! $this->role->belongsToCompany()) {
            return true;
        }

        return $this->companyIsActive ??= (bool) Company::query()
            ->whereKey($this->company_id)
            ->value('is_active');
    }

    /**
     * Whether this account may act on records owned by the given company.
     *
     * Super admins may act on any company. Everyone else is confined to their
     * own, which is what makes cross-tenant access impossible even when an id
     * from another company is guessed correctly.
     */
    public function belongsToCompanyId(?int $companyId): bool
    {
        if ($this->isSuperAdmin()) {
            return $companyId !== null;
        }

        return $companyId !== null && $this->company_id === $companyId;
    }

    // -- Permissions ----------------------------------------------------------

    /**
     * Super admins hold every permission; owners hold every permission inside
     * their own company. Only employees are limited to explicit grants.
     */
    public function hasPermissionTo(string $permission): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->isSuperAdmin() || $this->isOwner()) {
            return true;
        }

        return $this->permissionNames()->contains($permission);
    }

    /**
     * @return \Illuminate\Support\Collection<int, string>
     */
    public function permissionNames(): \Illuminate\Support\Collection
    {
        return $this->relationLoaded('permissions')
            ? $this->permissions->pluck('name')
            : $this->permissions()->pluck('name');
    }

    /**
     * The effective permission list, used by the dashboards to decide what to
     * render. It is a convenience for the UI only; the backend re-checks every
     * operation regardless of what the client believes.
     *
     * @return array<int, string>
     */
    public function effectivePermissions(): array
    {
        if ($this->isSuperAdmin() || $this->isOwner()) {
            return Permission::query()->orderBy('name')->pluck('name')->all();
        }

        return $this->permissionNames()->sort()->values()->all();
    }

    // -- Scopes ---------------------------------------------------------------

    public function scopeEmployees(Builder $query): Builder
    {
        return $query->where('role', UserRole::Employee);
    }

    public function scopeOwners(Builder $query): Builder
    {
        return $query->where('role', UserRole::Owner);
    }

    public function scopeOfCompany(Builder $query, int $companyId): Builder
    {
        return $query->where('company_id', $companyId);
    }
}
