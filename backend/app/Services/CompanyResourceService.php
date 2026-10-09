<?php

namespace App\Services;

use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Shared behaviour for the three company-owned resources (packages, hotels,
 * buses), which differ only in their fields and filters.
 *
 * This class is the business layer referred to throughout the architecture: a
 * dashboard request and an MCP tool call both end up here, so tenant
 * resolution, image handling and audit logging cannot differ between them.
 * Callers are expected to have passed authorisation (policies) and validation
 * (Form Requests or the equivalent MCP schema) first.
 */
abstract class CompanyResourceService
{
    public const MAX_PER_PAGE = 100;

    public function __construct(
        protected readonly TenantContext $tenant,
        protected readonly AuditLogger $audit,
        protected readonly ImageStorage $images,
    ) {}

    /** @return class-string<Model> */
    abstract protected function modelClass(): string;

    /** Sub-directory on the public disk, e.g. "packages". */
    abstract protected function imageDirectory(): string;

    /** Resource-specific query filters. */
    abstract protected function applyFilters(Builder $query, array $filters): Builder;

    /**
     * The filtered, sorted query behind a listing — without the paging.
     *
     * Shared by paginate() and the CSV export, so an export carries exactly
     * the rows the person was looking at. Two code paths building the same
     * filters is how an export quietly starts disagreeing with the screen it
     * was taken from.
     *
     * @param  array<string, mixed>  $filters
     */
    public function query(array $filters = []): Builder
    {
        $query = $this->newQuery();

        // A super admin sees every company unless they ask for one; for an
        // owner or employee this is already enforced by the global scope and
        // simply re-states their own company.
        $companyId = $this->tenant->resolveCompanyIdForRead(
            isset($filters['company_id']) ? (int) $filters['company_id'] : null
        );

        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        if (($search = trim((string) ($filters['search'] ?? ''))) !== '') {
            $query->where('name', 'like', '%'.self::escapeLike($search).'%');
        }

        if (array_key_exists('is_active', $filters) && $filters['is_active'] !== null) {
            $query->where('is_active', (bool) $filters['is_active']);
        }

        $query = $this->applyFilters($query, $filters);

        $this->applySort($query, $filters);

        return $query->with('company');
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $perPage = min(
            max((int) ($filters['per_page'] ?? 15), 1),
            self::MAX_PER_PAGE
        );

        return $this->query($filters)
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * Columns a client may sort by.
     *
     * An allowlist, not the request string: `sort` reaches an ORDER BY clause,
     * which the query builder does not parameterise, so an arbitrary value
     * would be an injection point.
     *
     * @return array<int, string>
     */
    protected function sortableColumns(): array
    {
        return ['id', 'name', 'created_at', 'updated_at'];
    }

    protected function applySort(Builder $query, array $filters): void
    {
        $column = (string) ($filters['sort'] ?? 'id');
        $direction = strtolower((string) ($filters['direction'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        if (! in_array($column, $this->sortableColumns(), true)) {
            $column = 'id';
        }

        $query->orderBy($query->qualifyColumn($column), $direction);

        // A stable tiebreaker, so paging through equal values cannot show the
        // same row twice or skip one.
        if ($column !== 'id') {
            $query->orderByDesc($query->qualifyColumn('id'));
        }
    }

    /**
     * @param  array<string, mixed>  $attributes  already-validated input
     */
    public function create(array $attributes, ?UploadedFile $image = null): Model
    {
        // The company is taken from the authenticated context. For an owner or
        // employee any company_id in the payload is discarded here.
        $companyId = $this->tenant->resolveCompanyIdForWrite(
            isset($attributes['company_id']) ? (int) $attributes['company_id'] : null
        );

        $attributes = $this->stripProtectedAttributes($attributes);

        return DB::transaction(function () use ($attributes, $companyId, $image) {
            /** @var Model $model */
            $model = new ($this->modelClass());
            $model->fill($attributes);
            $model->company_id = $companyId;

            if ($image !== null) {
                $model->image_path = $this->images->store($image, $this->imageDirectory());
            }

            $model->save();

            $this->audit->logModel('created', $model, [
                'attributes' => $model->only($model->getFillable()),
            ]);

            return $model->fresh(['company']);
        });
    }

    /**
     * @param  array<string, mixed>  $attributes  already-validated input
     */
    public function update(
        Model $model,
        array $attributes,
        ?UploadedFile $image = null,
        bool $removeImage = false,
    ): Model {
        $attributes = $this->stripProtectedAttributes($attributes);

        return DB::transaction(function () use ($model, $attributes, $image, $removeImage) {
            $model->fill($attributes);

            $previousImage = $model->image_path;

            if ($image !== null) {
                $model->image_path = $this->images->replace(
                    $previousImage, $image, $this->imageDirectory()
                );
            } elseif ($removeImage) {
                $model->image_path = null;
            }

            $changed = array_keys($model->getDirty());
            $model->save();

            if ($removeImage && $image === null) {
                $this->images->delete($previousImage);
            }

            $this->audit->logModel('updated', $model, [
                'changed' => $changed,
                'attributes' => $model->only($changed),
            ]);

            return $model->fresh(['company']);
        });
    }

    /**
     * Soft delete. The image is deliberately kept so a restore is lossless.
     */
    public function delete(Model $model): void
    {
        DB::transaction(function () use ($model) {
            $model->delete();

            $this->audit->logModel('deleted', $model, [
                'name' => $model->getAttribute('name'),
            ]);
        });
    }

    /**
     * A query that already carries the tenant scope.
     */
    protected function newQuery(): Builder
    {
        return ($this->modelClass())::query();
    }

    /**
     * Removes anything a client must never set directly, even if it slipped
     * past validation. `company_id` is resolved separately and `image_path` is
     * only ever written from an actual upload.
     *
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    protected function stripProtectedAttributes(array $attributes): array
    {
        return array_diff_key($attributes, array_flip([
            'id', 'company_id', 'image_path', 'created_at', 'updated_at', 'deleted_at',
        ]));
    }

    protected function actor(): User
    {
        return $this->tenant->user();
    }

    /**
     * Escapes the wildcards a user could otherwise inject into a LIKE filter
     * to make it scan the whole table.
     */
    protected static function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $value);
    }
}
