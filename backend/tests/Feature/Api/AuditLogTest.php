<?php

namespace Tests\Feature\Api;

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Package;
use App\Models\User;
use App\Services\AuditLogger;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    private Company $company;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->owner = $this->owner($this->company);
    }

    #[Test]
    public function creating_a_package_is_recorded(): void
    {
        $this->actingAsUser($this->owner)
            ->postJson('/api/packages', ['name' => 'Ramadan Umrah', 'price' => 35000]);

        $log = AuditLog::query()->where('resource_type', 'package')->sole();

        $this->assertSame('created', $log->action);
        $this->assertSame($this->owner->id, $log->user_id);
        $this->assertSame($this->owner->name, $log->actor_name);
        $this->assertSame('owner', $log->actor_role);
        $this->assertSame($this->company->id, $log->company_id);
        $this->assertSame('Ramadan Umrah', $log->metadata['attributes']['name']);
    }

    #[Test]
    public function updating_records_what_changed(): void
    {
        $package = Package::factory()->forCompany($this->company)->create(['name' => 'Before']);

        $this->actingAsUser($this->owner)
            ->putJson("/api/packages/{$package->id}", ['name' => 'After']);

        $log = AuditLog::query()->where('action', 'updated')->sole();

        $this->assertContains('name', $log->metadata['changed']);
        $this->assertSame('After', $log->metadata['attributes']['name']);
    }

    #[Test]
    public function deleting_is_recorded(): void
    {
        $package = Package::factory()->forCompany($this->company)->create(['name' => 'Doomed']);

        $this->actingAsUser($this->owner)->deleteJson("/api/packages/{$package->id}");

        $log = AuditLog::query()->where('action', 'deleted')->sole();

        $this->assertSame('package', $log->resource_type);
        $this->assertSame($package->id, $log->resource_id);
        $this->assertSame('Doomed', $log->metadata['name']);
    }

    #[Test]
    public function the_source_distinguishes_the_agent_from_the_dashboard(): void
    {
        $this->actingAsMcp($this->owner)
            ->postJson('/api/packages', ['name' => 'By the agent']);

        $log = AuditLog::query()->where('resource_type', 'package')->sole();

        $this->assertSame('mcp_agent', $log->source->value);
    }

    #[Test]
    public function the_dashboard_header_labels_an_interactive_request(): void
    {
        $this->actingAsUser($this->owner)
            ->withHeader('X-Client-Source', 'dashboard')
            ->postJson('/api/packages', ['name' => 'By a human']);

        $log = AuditLog::query()->where('resource_type', 'package')->sole();

        $this->assertSame('dashboard', $log->source->value);
    }

    #[Test]
    public function the_source_header_cannot_disguise_an_agent_request(): void
    {
        // The ability is on the token; a header does not get to contradict it.
        $this->actingAsMcp($this->owner)
            ->withHeader('X-Client-Source', 'dashboard')
            ->postJson('/api/packages', ['name' => 'Wearing a disguise']);

        $log = AuditLog::query()->where('resource_type', 'package')->sole();

        $this->assertSame('mcp_agent', $log->source->value);
    }

    #[Test]
    public function the_source_header_cannot_claim_the_agent_path(): void
    {
        $this->actingAsUser($this->owner)
            ->withHeader('X-Client-Source', 'mcp_agent')
            ->postJson('/api/packages', ['name' => 'Pretending']);

        $log = AuditLog::query()->where('resource_type', 'package')->sole();

        $this->assertSame('api', $log->source->value);
    }

    #[Test]
    public function an_agent_operation_produces_the_same_record_as_a_dashboard_one(): void
    {
        $this->actingAsUser($this->owner)
            ->withHeader('X-Client-Source', 'dashboard')
            ->postJson('/api/packages', ['name' => 'Identical']);

        $this->actingAsMcp($this->owner)
            ->postJson('/api/packages', ['name' => 'Identical']);

        $logs = AuditLog::query()->where('resource_type', 'package')->orderBy('id')->get();

        $this->assertCount(2, $logs);

        // Same actor, same company, same action, same metadata — only the
        // source differs, which is the whole point of the dual path.
        $this->assertSame($logs[0]->action, $logs[1]->action);
        $this->assertSame($logs[0]->company_id, $logs[1]->company_id);
        $this->assertSame($logs[0]->user_id, $logs[1]->user_id);
        $this->assertSame(
            $logs[0]->metadata['attributes']['name'],
            $logs[1]->metadata['attributes']['name'],
        );
        $this->assertSame('dashboard', $logs[0]->source->value);
        $this->assertSame('mcp_agent', $logs[1]->source->value);
    }

    #[Test]
    public function permission_changes_record_the_before_and_after(): void
    {
        $employee = $this->employee($this->company, ['packages.view']);

        $this->actingAsUser($this->owner)
            ->putJson("/api/employees/{$employee->id}/permissions", [
                'permissions' => ['hotels.view', 'buses.view'],
            ]);

        $log = AuditLog::query()->where('action', 'permissions_updated')->sole();

        $this->assertSame(['packages.view'], $log->metadata['before']);
        $this->assertEqualsCanonicalizing(['buses.view', 'hotels.view'], $log->metadata['after']);
    }

    #[Test]
    public function secrets_are_stripped_from_metadata(): void
    {
        $redacted = AuditLogger::redact([
            'name' => 'Ahmed',
            'password' => 'hunter2',
            'password_confirmation' => 'hunter2',
            'api_key' => 'sk-live-123',
            'authorization' => 'Bearer abc',
            'nested' => ['access_token' => 'xyz', 'keep' => 'this'],
        ]);

        $this->assertSame('Ahmed', $redacted['name']);
        $this->assertSame('this', $redacted['nested']['keep']);

        foreach (['password', 'password_confirmation', 'api_key', 'authorization'] as $key) {
            $this->assertSame('[redacted]', $redacted[$key]);
        }

        $this->assertSame('[redacted]', $redacted['nested']['access_token']);
        $this->assertStringNotContainsString('hunter2', json_encode($redacted));
        $this->assertStringNotContainsString('sk-live-123', json_encode($redacted));
    }

    #[Test]
    public function creating_an_employee_never_logs_the_password(): void
    {
        $this->actingAsUser($this->owner)->postJson('/api/employees', [
            'name' => 'Ahmed',
            'email' => 'ahmed@example.test',
            'password' => 'super-secret-pw-1',
        ]);

        $logs = json_encode(AuditLog::query()->get()->toArray());

        $this->assertStringNotContainsString('super-secret-pw-1', $logs);
    }

    #[Test]
    public function an_owner_reads_only_their_own_companys_trail(): void
    {
        $other = $this->company();
        $otherOwner = $this->owner($other);

        $this->actingAsUser($this->owner)->postJson('/api/packages', ['name' => 'Mine']);
        $this->actingAsUser($otherOwner)->postJson('/api/packages', ['name' => 'Theirs']);

        $response = $this->actingAsUser($this->owner)->getJson('/api/audit-logs');

        $this->assertApiSuccess($response);

        foreach ($response->json('data') as $row) {
            $this->assertSame($this->company->id, $row['company_id']);
        }
    }

    #[Test]
    public function a_super_admin_reads_every_companys_trail(): void
    {
        $other = $this->company();
        $otherOwner = $this->owner($other);

        $this->actingAsUser($this->owner)->postJson('/api/packages', ['name' => 'Mine']);
        $this->actingAsUser($otherOwner)->postJson('/api/packages', ['name' => 'Theirs']);

        $response = $this->actingAsUser($this->superAdmin())
            ->getJson('/api/audit-logs?resource_type=package');

        $this->assertCount(2, $response->json('data'));
    }

    #[Test]
    public function the_trail_can_be_filtered(): void
    {
        $this->actingAsUser($this->owner);
        $this->postJson('/api/packages', ['name' => 'One']);
        $this->postJson('/api/hotels', ['name' => 'Two']);

        $this->assertCount(1, $this->getJson('/api/audit-logs?resource_type=package')->json('data'));
        $this->assertCount(1, $this->getJson('/api/audit-logs?resource_type=hotel')->json('data'));
        $this->assertCount(2, $this->getJson('/api/audit-logs?action=created')->json('data'));
    }

    #[Test]
    public function a_failed_write_leaves_no_audit_record_behind(): void
    {
        $employee = $this->employee($this->company);   // no permissions

        $this->actingAsUser($employee)->postJson('/api/packages', ['name' => 'Denied']);

        $this->assertSame(0, AuditLog::query()->where('resource_type', 'package')->count());
    }

    #[Test]
    public function a_rejected_validation_leaves_no_partial_record(): void
    {
        $this->actingAsUser($this->owner)->postJson('/api/packages', ['price' => 100]);   // no name

        $this->assertSame(0, AuditLog::query()->where('resource_type', 'package')->count());
        $this->assertSame(0, Package::query()->count());
    }
}
