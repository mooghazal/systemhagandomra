<?php

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Package;
use App\Models\User;
use App\Support\Permissions;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * CSV export.
 *
 * An export is the one request that deliberately ignores pagination, so it is
 * the one place where a missing tenant filter would hand somebody every row in
 * the database rather than the fifteen on their screen. Most of these tests
 * are about that.
 */
class ExportTest extends TestCase
{
    private Company $company;

    private Company $other;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->other = $this->company();
        $this->owner = $this->owner($this->company);
    }

    private function body(string $url, ?User $as = null): string
    {
        $response = $this->actingAsUser($as ?? $this->owner)->get($url);

        $response->assertOk();

        return $response->streamedContent();
    }

    // -- What it is for ------------------------------------------------------

    #[Test]
    public function it_exports_the_rows_as_csv(): void
    {
        Package::factory()->forCompany($this->company)->create(['name' => 'عمرة رمضان']);

        $csv = $this->body('/api/packages/export');

        $this->assertStringContainsString('عمرة رمضان', $csv);
        $this->assertStringContainsString('الاسم', $csv);
    }

    #[Test]
    public function it_offers_the_file_as_a_download(): void
    {
        $response = $this->actingAsUser($this->owner)->get('/api/packages/export');

        $this->assertStringContainsString('attachment', (string) $response->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('text/csv', (string) $response->headers->get('Content-Type'));
    }

    #[Test]
    public function it_starts_with_a_byte_order_mark_so_excel_reads_the_arabic(): void
    {
        /*
         * Without it, Excel on Windows reads the file as the system codepage
         * and every Arabic name opens as mojibake — and the person looking at
         * it has no way to tell whether the data or the file is broken.
         */
        Package::factory()->forCompany($this->company)->create(['name' => 'عمرة رمضان']);

        $this->assertStringStartsWith("\xEF\xBB\xBF", $this->body('/api/packages/export'));
    }

    #[Test]
    public function it_ignores_the_page_size_and_exports_everything(): void
    {
        Package::factory()->count(20)->forCompany($this->company)->create();

        $csv = $this->body('/api/packages/export');

        // 20 rows plus the heading.
        $this->assertSame(21, substr_count(trim($csv), "\n") + 1);
    }

    #[Test]
    public function it_honours_the_filters_the_listing_was_using(): void
    {
        // Otherwise the file disagrees with the screen it was taken from.
        Package::factory()->forCompany($this->company)->create(['name' => 'عمرة رمضان']);
        Package::factory()->forCompany($this->company)->create(['name' => 'حج التمتع']);

        $csv = $this->body('/api/packages/export?search=رمضان');

        $this->assertStringContainsString('عمرة رمضان', $csv);
        $this->assertStringNotContainsString('حج التمتع', $csv);
    }

    // -- Tenant isolation ----------------------------------------------------

    #[Test]
    public function an_owner_exports_only_their_own_company(): void
    {
        Package::factory()->forCompany($this->company)->create(['name' => 'باقتنا']);
        Package::factory()->forCompany($this->other)->create(['name' => 'باقة الغير']);

        $csv = $this->body('/api/packages/export');

        $this->assertStringContainsString('باقتنا', $csv);
        $this->assertStringNotContainsString('باقة الغير', $csv);
    }

    #[Test]
    public function naming_another_company_does_not_widen_the_export(): void
    {
        Package::factory()->forCompany($this->other)->create(['name' => 'باقة الغير']);

        // The company_id is ignored for a company user rather than obeyed.
        $csv = $this->body("/api/packages/export?company_id={$this->other->id}");

        $this->assertStringNotContainsString('باقة الغير', $csv);
    }

    #[Test]
    public function a_super_admin_exports_across_companies(): void
    {
        Package::factory()->forCompany($this->company)->create(['name' => 'باقة أ']);
        Package::factory()->forCompany($this->other)->create(['name' => 'باقة ب']);

        $csv = $this->body('/api/packages/export', $this->superAdmin());

        $this->assertStringContainsString('باقة أ', $csv);
        $this->assertStringContainsString('باقة ب', $csv);
    }

    // -- Permission ----------------------------------------------------------

    #[Test]
    public function an_employee_who_may_read_may_export(): void
    {
        Package::factory()->forCompany($this->company)->create(['name' => 'عمرة رمضان']);

        $employee = $this->employee($this->company, [Permissions::PACKAGES_VIEW]);

        $this->assertStringContainsString('عمرة رمضان', $this->body('/api/packages/export', $employee));
    }

    #[Test]
    public function an_employee_who_may_not_read_may_not_export(): void
    {
        $employee = $this->employee($this->company, [Permissions::HOTELS_VIEW]);

        $this->assertApiError(
            $this->actingAsUser($employee)->getJson('/api/packages/export'),
            403,
        );
    }

    #[Test]
    public function a_signed_out_caller_gets_nothing(): void
    {
        $this->getJson('/api/packages/export')->assertStatus(401);
    }

    // -- The other two resources --------------------------------------------

    #[Test]
    public function hotels_and_buses_export_too(): void
    {
        $this->actingAsUser($this->owner)->get('/api/hotels/export')->assertOk();
        $this->nextRequest()->actingAsUser($this->owner)->get('/api/buses/export')->assertOk();
    }

    #[Test]
    public function the_export_route_is_not_mistaken_for_a_record_id(): void
    {
        /*
         * `apiResource` registers GET packages/{package}, and "export" is a
         * perfectly good id as far as the router is concerned. Declared in the
         * wrong order these would reach show() and answer 404.
         */
        $this->actingAsUser($this->owner)->get('/api/packages/export')->assertOk();
    }
}
