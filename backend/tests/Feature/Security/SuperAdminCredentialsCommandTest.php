<?php

namespace Tests\Feature\Security;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Prompts\Prompt;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * The command that lets the operator set their own super-admin credentials.
 *
 * Its whole purpose is that the password reaches the database and nowhere
 * else, so these tests are mostly about what must NOT happen: no echo, no
 * .env, no surviving session.
 */
class SuperAdminCredentialsCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Prompt::fake();
    }

    protected function tearDown(): void
    {
        Prompt::fallbackWhen(false);

        parent::tearDown();
    }

    /** The base helper, pinned to a known address and password. */
    private function admin(): User
    {
        return $this->superAdmin([
            'email' => 'admin@example.test',
            'password' => 'old-password-123',
        ]);
    }

    #[Test]
    public function it_sets_the_email_and_password_the_operator_types(): void
    {
        $admin = $this->admin();

        $this->artisan('admin:credentials')
            ->expectsQuestion('New e-mail address', 'chosen@example.test')
            ->expectsQuestion('New password', 'a-chosen-password-9')
            ->expectsQuestion('Repeat the password', 'a-chosen-password-9')
            ->assertSuccessful();

        $admin->refresh();

        $this->assertSame('chosen@example.test', $admin->email);
        $this->assertTrue(Hash::check('a-chosen-password-9', $admin->password));
    }

    #[Test]
    public function it_never_prints_the_password_back(): void
    {
        $this->admin();

        $this->artisan('admin:credentials')
            ->expectsQuestion('New e-mail address', 'chosen@example.test')
            ->expectsQuestion('New password', 'a-chosen-password-9')
            ->expectsQuestion('Repeat the password', 'a-chosen-password-9')
            ->doesntExpectOutputToContain('a-chosen-password-9')
            ->assertSuccessful();
    }

    #[Test]
    public function it_revokes_every_existing_token_so_the_old_password_stops_granting_access(): void
    {
        $admin = $this->admin();
        $admin->createToken('browser', ['*']);
        $admin->createToken('mcp', ['mcp']);

        $this->assertSame(2, $admin->tokens()->count());

        $this->artisan('admin:credentials')
            ->expectsQuestion('New e-mail address', $admin->email)
            ->expectsQuestion('New password', 'a-chosen-password-9')
            ->expectsQuestion('Repeat the password', 'a-chosen-password-9')
            ->assertSuccessful();

        $this->assertSame(0, $admin->tokens()->count());
    }

    #[Test]
    public function it_refuses_a_password_that_does_not_match_its_confirmation(): void
    {
        $admin = $this->admin();

        $this->artisan('admin:credentials')
            ->expectsQuestion('New e-mail address', $admin->email)
            ->expectsQuestion('New password', 'a-chosen-password-9')
            ->expectsQuestion('Repeat the password', 'a-different-password-9')
            ->assertFailed();

        $admin->refresh();

        $this->assertTrue(Hash::check('old-password-123', $admin->password));
    }

    #[Test]
    public function it_refuses_a_password_below_the_policy(): void
    {
        $admin = $this->admin();

        $this->artisan('admin:credentials')
            ->expectsQuestion('New e-mail address', $admin->email)
            ->expectsQuestion('New password', 'short1')
            ->expectsQuestion('Repeat the password', 'short1')
            ->assertFailed();

        $admin->refresh();

        $this->assertTrue(Hash::check('old-password-123', $admin->password));
    }

    #[Test]
    public function it_refuses_an_email_another_live_account_already_uses(): void
    {
        $admin = $this->admin();
        $company = $this->company();
        $taken = $this->owner($company);

        $this->artisan('admin:credentials')
            ->expectsQuestion('New e-mail address', $taken->email)
            ->expectsQuestion('New password', 'a-chosen-password-9')
            ->expectsQuestion('Repeat the password', 'a-chosen-password-9')
            ->assertFailed();

        $admin->refresh();

        $this->assertSame('admin@example.test', $admin->email);
    }
}
