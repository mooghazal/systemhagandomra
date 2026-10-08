<?php

namespace App\Models\Concerns;

use App\Models\Company;
use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

/**
 * Applied to every company-owned resource (packages, hotels, buses).
 *
 * Two guarantees come with it:
 *   1. reads are scoped to the caller's company (see CompanyScope);
 *   2. a record can never be written without a company, so a missing tenant
 *      resolution fails loudly instead of creating an orphan row.
 *
 * `company_id` is intentionally absent from every $fillable list. It is set by
 * service classes from the authenticated context, never from request input.
 */
trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope(new CompanyScope);

        static::creating(function (self $model): void {
            if (empty($model->company_id)) {
                throw new RuntimeException(sprintf(
                    '%s was created without a company_id. Company-owned records must be '
                    .'created through their service class so the tenant is resolved from '
                    .'the authenticated context.',
                    static::class,
                ));
            }
        });

        // Re-homing a record to another company is never a legitimate update.
        static::updating(function (self $model): void {
            if ($model->isDirty('company_id')) {
                throw new RuntimeException(sprintf(
                    '%s#%s attempted to change company_id from %s to %s.',
                    static::class,
                    $model->getKey(),
                    var_export($model->getOriginal('company_id'), true),
                    var_export($model->company_id, true),
                ));
            }
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
