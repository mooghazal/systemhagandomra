<?php

namespace Tests\Feature\Security;

use App\Models\Bus;
use App\Models\Company;
use App\Models\Hotel;
use App\Models\Package;
use App\Models\User;
use Laravel\Prompts\Prompt;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * `purge:deleted` — the only thing in this system that removes data for good.
 *
 * Soft deletes exist so a mistake can be undone. This command is what finally
 * makes one permanent, so the tests that matter are the ones proving it is
 * hard to fire by accident and narrow when it does.
 */
class PurgeDeletedTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Prompt::fake();
    }

    /** A company with one of everything, all soft-deleted $daysAgo. */
    private function deletedCompany(int $daysAgo): Company
    {
        $company = $this->company();
        $owner = $this->owner($company);

        $package = Package::factory()->forCompany($company)->create();
        $hotel = Hotel::factory()->forCompany($company)->create();
        $bus = Bus::factory()->forCompany($company)->create();

        $when = now()->subDays($daysAgo);

        foreach ([$package, $hotel, $bus, $owner, $company] as $record) {
            $record->delete();
            $record->forceFill(['deleted_at' => $when])->saveQuietly();
        }

        return $company;
    }

    private function liveCount(string $model): int
    {
        return $model::withoutGlobalScopes()->count();
    }

    // -- What it is for ------------------------------------------------------

    #[Test]
    public function it_removes_records_deleted_longer_ago_than_the_cutoff(): void
    {
        $this->deletedCompany(daysAgo: 120);

        $this->artisan('purge:deleted', ['--days' => 90, '--force' => true])
            ->assertSuccessful();

        foreach ([Package::class, Hotel::class, Bus::class, User::class, Company::class] as $model) {
            $this->assertSame(0, $this->liveCount($model), class_basename($model).' survived the purge.');
        }
    }

    #[Test]
    public function it_leaves_anything_newer_than_the_cutoff_alone(): void
    {
        $this->deletedCompany(daysAgo: 10);

        $this->artisan('purge:deleted', ['--days' => 90, '--force' => true])
            ->assertSuccessful();

        $this->assertSame(1, $this->liveCount(Company::class));
        $this->assertSame(1, $this->liveCount(Package::class));
    }

    #[Test]
    public function it_never_touches_a_record_that_is_not_deleted(): void
    {
        $company = $this->company();
        Package::factory()->forCompany($company)->create();

        /*
         * The one failure that would be unrecoverable. --days=1 is the most
         * aggressive setting the command accepts, so if live rows were ever
         * going to be caught it would be here.
         */
        $this->artisan('purge:deleted', ['--days' => 1, '--force' => true])
            ->assertSuccessful();

        $this->assertSame(1, $this->liveCount(Company::class));
        $this->assertSame(1, $this->liveCount(Package::class));
    }

    // -- Hard to fire by accident -------------------------------------------

    #[Test]
    public function a_dry_run_changes_nothing(): void
    {
        $this->deletedCompany(daysAgo: 120);

        $this->artisan('purge:deleted', ['--days' => 90, '--dry-run' => true])
            ->assertSuccessful();

        $this->assertSame(1, $this->liveCount(Company::class));
        $this->assertSame(1, $this->liveCount(Package::class));
    }

    #[Test]
    public function answering_no_at_the_prompt_changes_nothing(): void
    {
        $this->deletedCompany(daysAgo: 120);

        $this->artisan('purge:deleted', ['--days' => 90])
            ->expectsConfirmation('Permanently remove 5 records?', 'no')
            ->assertSuccessful();

        $this->assertSame(1, $this->liveCount(Company::class));
    }

    #[Test]
    public function the_prompt_defaults_to_no(): void
    {
        $this->deletedCompany(daysAgo: 120);

        // Enter on its own must not destroy anything.
        $this->artisan('purge:deleted', ['--days' => 90])
            ->expectsConfirmation('Permanently remove 5 records?')
            ->assertSuccessful();

        $this->assertSame(1, $this->liveCount(Company::class));
    }

    // -- Ordering ------------------------------------------------------------

    #[Test]
    public function a_company_with_children_is_removed_without_a_constraint_error(): void
    {
        /*
         * Packages hold a foreign key to their company, and the users table
         * has a stored generated column deriving from company_id — so the
         * database refuses to remove a company while anything still points at
         * it. Deleting in the wrong order does not warn, it throws.
         */
        $this->deletedCompany(daysAgo: 120);

        $this->artisan('purge:deleted', ['--days' => 90, '--force' => true])
            ->assertSuccessful();

        $this->assertSame(0, $this->liveCount(Company::class));
    }

    #[Test]
    public function a_purged_employees_permission_rows_go_with_them(): void
    {
        $company = $this->company();
        $employee = $this->employee($company, [\App\Support\Permissions::PACKAGES_VIEW]);

        $this->assertDatabaseHas('employee_permissions', ['user_id' => $employee->id]);

        $employee->delete();
        $employee->forceFill(['deleted_at' => now()->subDays(120)])->saveQuietly();

        $this->artisan('purge:deleted', ['--days' => 90, '--force' => true])
            ->assertSuccessful();

        $this->assertDatabaseMissing('employee_permissions', ['user_id' => $employee->id]);
    }

    #[Test]
    public function it_reports_nothing_to_do_rather_than_failing(): void
    {
        $this->artisan('purge:deleted', ['--days' => 90, '--force' => true])
            ->assertSuccessful();
    }
}
