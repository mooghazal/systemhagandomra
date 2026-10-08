<?php

namespace App\Services;

use App\Enums\AuditSource;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\RequestSource;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Writes the audit trail.
 *
 * Every privileged operation routes through here regardless of which client
 * triggered it, so an MCP agent's package creation produces the same record as
 * one made in the dashboard — only the `source` column differs.
 */
class AuditLogger
{
    /**
     * Keys that must never reach the audit table, matched case-insensitively
     * anywhere in the key name.
     */
    private const REDACTED_KEYS = [
        'password', 'password_confirmation', 'current_password',
        'token', 'access_token', 'refresh_token', 'api_key', 'apikey',
        'secret', 'authorization', 'remember_token', 'credentials',
        'private_key', 'signature',
    ];

    private const REDACTED = '[redacted]';

    public function __construct(
        private readonly TenantContext $tenant,
        private readonly RequestSource $source,
        private readonly Request $request,
    ) {}

    public function log(
        string $action,
        string $resourceType,
        ?int $resourceId = null,
        array $metadata = [],
        ?int $companyId = null,
        ?User $actor = null,
    ): AuditLog {
        $actor ??= $this->tenant->actor();

        return AuditLog::create([
            'user_id' => $actor?->id,
            'actor_name' => $actor?->name,
            'actor_email' => $actor?->email,
            'actor_role' => $actor?->role->value,
            'company_id' => $companyId ?? $actor?->company_id,
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'source' => $this->resolveSource(),
            'ip_address' => $this->request->ip(),
            'metadata' => $metadata === [] ? null : self::redact($metadata),
        ]);
    }

    /**
     * Convenience wrapper that derives the resource type and id from a model.
     */
    public function logModel(string $action, Model $model, array $metadata = [], ?User $actor = null): AuditLog
    {
        return $this->log(
            action: $action,
            resourceType: self::resourceType($model),
            resourceId: $model->getKey(),
            metadata: $metadata,
            companyId: $model->getAttribute('company_id')
                ?? ($model instanceof \App\Models\Company ? $model->getKey() : null),
            actor: $actor,
        );
    }

    public static function resourceType(Model $model): string
    {
        return str(class_basename($model))->snake()->toString();
    }

    private function resolveSource(): AuditSource
    {
        return $this->source->resolve($this->request->header(RequestSource::HEADER));
    }

    /**
     * Strips secrets out of metadata before it is persisted. Applied
     * recursively so nested payloads (e.g. an MCP tool's arguments) are covered.
     */
    public static function redact(array $data): array
    {
        $clean = [];

        foreach ($data as $key => $value) {
            if (is_string($key) && self::isSensitive($key)) {
                $clean[$key] = self::REDACTED;

                continue;
            }

            $clean[$key] = is_array($value) ? self::redact($value) : $value;
        }

        return $clean;
    }

    private static function isSensitive(string $key): bool
    {
        $key = strtolower($key);

        foreach (self::REDACTED_KEYS as $sensitive) {
            if (str_contains($key, $sensitive)) {
                return true;
            }
        }

        return false;
    }
}
