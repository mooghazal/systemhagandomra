<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Package;
use App\Models\User;
use App\Support\Permissions;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * `GET /api/stats/packages-by-type` — the figures behind the dashboard chart.
 *
 * A breakdown is a weaker read of the package list, so the thing worth proving
 * is that it cannot be used to see around the permission that guards the list
 * itself, or across the tenant boundary.
 */
class PackageBreakdownTest extends TestCase
{
    private Company $company;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->owner = $this->owner($this->company);
    }

    private function breakdown(?User $as = null): array
    {
        $response = $this->actingAsUser($as ?? $this->owner)->getJson('/api/stats/packages-by-type');

        $this->assertApiSuccess($response);

        return $response->json('data.breakdown');
    }

    #[Test]
    public function it_counts_packages_by_trip_type(): void
    {
        Package::factory()->count(3)->forCompany($this->company)->create(['trip_type' => 'عمرة']);
        Package::factory()->count(1)->forCompany($this->company)->create(['trip_type' => 'حج']);

        $this->assertSame(
            [['label' => 'عمرة', 'total' => 3], ['label' => 'حج', 'total' => 1]],
            $this->breakdown(),
        );
    }

    #[Test]
    public function it_orders_the_largest_first(): void
    {
        // So the chart reads top to bottom without the reader sorting it.
        Package::factory()->count(1)->forCompany($this->company)->create(['trip_type' => 'حج']);
        Package::factory()->count(5)->forCompany($this->company)->create(['trip_type' => 'عمرة']);

        $this->assertSame('عمرة', $this->breakdown()[0]['label']);
    }

    #[Test]
    public function packages_with_no_type_get_their_own_bucket(): void
    {
        /*
         * Rather than being dropped. "Forty packages with no type set" is
         * worth seeing — a chart that silently omitted them would show a
         * catalogue smaller than the one the counts report.
         */
        Package::factory()->count(2)->forCompany($this->company)->create(['trip_type' => null]);
        Package::factory()->count(1)->forCompany($this->company)->create(['trip_type' => '   ']);

        $this->assertSame([['label' => 'غير محدّد', 'total' => 3]], $this->breakdown());
    }

    #[Test]
    public function the_tail_folds_into_one_bucket_rather_than_being_cut(): void
    {
        // trip_type is free text and has no ceiling, but a chart does. The
        // totals still have to add up to the catalogue.
        foreach (range(1, 9) as $n) {
            Package::factory()->count($n)->forCompany($this->company)->create(['trip_type' => "نوع {$n}"]);
        }

        $breakdown = $this->breakdown();

        $this->assertCount(7, $breakdown, 'Six bars plus the folded tail.');
        $this->assertSame('أخرى', end($breakdown)['label']);
        $this->assertSame(45, array_sum(array_column($breakdown, 'total')));
    }

    // -- Boundaries ----------------------------------------------------------

    #[Test]
    public function it_counts_only_the_callers_own_company(): void
    {
        $other = $this->company();

        Package::factory()->count(2)->forCompany($this->company)->create(['trip_type' => 'عمرة']);
        Package::factory()->count(9)->forCompany($other)->create(['trip_type' => 'عمرة']);

        $this->assertSame([['label' => 'عمرة', 'total' => 2]], $this->breakdown());
    }

    #[Test]
    public function an_employee_without_the_package_permission_is_refused(): void
    {
        $employee = $this->employee($this->company, [Permissions::HOTELS_VIEW]);

        $this->assertApiError(
            $this->actingAsUser($employee)->getJson('/api/stats/packages-by-type'),
            403,
        );
    }

    #[Test]
    public function an_employee_who_may_read_packages_may_read_the_breakdown(): void
    {
        Package::factory()->forCompany($this->company)->create(['trip_type' => 'عمرة']);

        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        $this->assertSame([['label' => 'عمرة', 'total' => 1]], $this->breakdown($employee));
    }

    #[Test]
    public function a_super_admin_counts_across_companies(): void
    {
        $other = $this->company();

        Package::factory()->count(2)->forCompany($this->company)->create(['trip_type' => 'عمرة']);
        Package::factory()->count(3)->forCompany($other)->create(['trip_type' => 'عمرة']);

        $this->assertSame([['label' => 'عمرة', 'total' => 5]], $this->breakdown($this->superAdmin()));
    }

    #[Test]
    public function an_empty_catalogue_returns_an_empty_breakdown(): void
    {
        $this->assertSame([], $this->breakdown());
    }
}
