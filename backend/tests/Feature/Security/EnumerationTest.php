<?php

namespace Tests\Feature\Security;

use App\Models\Company;
use App\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Oracles: endpoints that refuse an action but answer a question in the
 * refusing.
 *
 * None of these let anybody read or change a thing. They let an outsider map
 * the platform — which addresses have accounts, which ids are owners — and a
 * map is how the next attack gets aimed. The throttles and the password policy
 * only matter against someone who knows what to aim at.
 */
class EnumerationTest extends TestCase
{
    private Company $company;

    private Company $other;

    private User $nobody;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = $this->company();
        $this->other = $this->company();

        // The weakest account the system issues: a real employee, zero grants.
        $this->nobody = $this->employee($this->company, []);
    }

    // -- E-mail addresses ----------------------------------------------------

    /*
     * Validation runs before the controller's authorize(), so a global
     * `unique:users,email` rule answers "that address is taken" to a caller
     * who may not create anything at all. The 422-versus-403 split is then a
     * yes/no oracle over every account in the system.
     */

    #[Test]
    public function creating_a_company_refuses_before_it_reports_that_an_address_is_taken(): void
    {
        $target = $this->owner($this->other, ['email' => 'target@example.test']);

        $taken = $this->actingAsUser($this->nobody)->postJson('/api/companies', [
            'name' => 'probe',
            'owner' => ['name' => 'x', 'email' => $target->email, 'password' => 'a-long-password-9'],
        ]);

        $free = $this->nextRequest()->actingAsUser($this->nobody)->postJson('/api/companies', [
            'name' => 'probe',
            'owner' => ['name' => 'x', 'email' => 'nobody-has-this@example.test', 'password' => 'a-long-password-9'],
        ]);

        // Both 403. If the taken address came back 422 the pair would be an
        // oracle, whatever the other one said.
        $this->assertApiError($taken, 403);
        $this->assertApiError($free, 403);
        $this->assertSame(
            $taken->getStatusCode(),
            $free->getStatusCode(),
            'A taken address and a free one answered differently.',
        );
    }

    #[Test]
    public function adding_an_owner_refuses_before_it_reports_that_an_address_is_taken(): void
    {
        $target = $this->owner($this->other, ['email' => 'target@example.test']);

        $taken = $this->actingAsUser($this->nobody)
            ->postJson("/api/companies/{$this->company->id}/owners", [
                'name' => 'x', 'email' => $target->email, 'password' => 'a-long-password-9',
            ]);

        $free = $this->nextRequest()->actingAsUser($this->nobody)
            ->postJson("/api/companies/{$this->company->id}/owners", [
                'name' => 'x', 'email' => 'nobody-has-this@example.test', 'password' => 'a-long-password-9',
            ]);

        $this->assertApiError($taken, 403);
        $this->assertSame($taken->getStatusCode(), $free->getStatusCode());
    }

    #[Test]
    public function updating_a_colleague_refuses_before_it_reports_that_an_address_is_taken(): void
    {
        $colleague = $this->employee($this->company, []);
        $target = $this->owner($this->other, ['email' => 'target@example.test']);

        $taken = $this->actingAsUser($this->nobody)
            ->putJson("/api/employees/{$colleague->id}", ['email' => $target->email]);

        $free = $this->nextRequest()->actingAsUser($this->nobody)
            ->putJson("/api/employees/{$colleague->id}", ['email' => 'nobody-has-this@example.test']);

        $this->assertApiError($taken, 403);
        $this->assertSame($taken->getStatusCode(), $free->getStatusCode());
    }

    // -- Owner ids -----------------------------------------------------------

    #[Test]
    public function an_owner_id_from_another_company_is_not_found_rather_than_forbidden(): void
    {
        $foreign = $this->owner($this->other);

        /*
         * The route binding used to resolve any owner on the platform, leaving
         * the controller to answer 403 — while a made-up id fell through to
         * 404. An employee with no permissions could walk the id space on
         * their own company's URL and learn which users anywhere are owners.
         */
        $existing = $this->actingAsUser($this->nobody)
            ->putJson("/api/companies/{$this->company->id}/owners/{$foreign->id}", ['name' => 'x']);

        $invented = $this->nextRequest()->actingAsUser($this->nobody)
            ->putJson("/api/companies/{$this->company->id}/owners/99999", ['name' => 'x']);

        $this->assertApiError($existing, 404);
        $this->assertSame(
            $existing->getStatusCode(),
            $invented->getStatusCode(),
            'A real owner id and an invented one answered differently.',
        );
    }

    #[Test]
    public function a_super_admin_still_reaches_every_owner(): void
    {
        $owner = $this->owner($this->other, ['name' => 'Before']);

        $this->assertApiSuccess(
            $this->actingAsUser($this->superAdmin())
                ->putJson("/api/companies/{$this->other->id}/owners/{$owner->id}", ['name' => 'After'])
        );

        $this->assertSame('After', $owner->fresh()->name);
    }
}
