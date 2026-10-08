<?php

namespace Tests;

use App\Models\Company;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Policies are checked against permission *names*, but the grants are
        // rows, so the catalogue has to exist before any employee can be given
        // anything.
        $this->seed(PermissionSeeder::class);
    }

    /**
     * Authenticates as the given user for subsequent requests.
     *
     * Issues a real token and sends it as a bearer header, rather than using
     * Sanctum::actingAs. actingAs installs a Mockery double in place of the
     * access token, which answers can() but carries no abilities — so any code
     * that inspects the token itself (RequestSource, for one) would be tested
     * against a stub that behaves nothing like the real thing.
     *
     * @param  array<int, string>  $abilities
     */
    protected function actingAsUser(User $user, array $abilities = ['*']): static
    {
        // Forget first, so switching identity mid-test actually switches it
        // instead of reusing whoever the guard resolved a moment ago.
        return $this->nextRequest()->withToken($this->tokenFor($user, $abilities));
    }

    /**
     * An MCP-issued token, which differs from a dashboard token only in that
     * it carries the `mcp` ability — used to label the audit trail, never to
     * widen what the account may do.
     */
    protected function actingAsMcp(User $user): static
    {
        return $this->actingAsUser($user, ['mcp']);
    }

    /**
     * A real Sanctum token, as a client would hold.
     *
     * Unlike Sanctum::actingAs this forces the user to be re-read from the
     * database on each request, which is what tests about revocation and
     * lockout need: actingAs hands the guard a PHP object that the test also
     * holds, so changes to the database go unnoticed.
     *
     * @param  array<int, string>  $abilities
     */
    protected function tokenFor(User $user, array $abilities = ['*']): string
    {
        return $user->createToken('test', $abilities)->plainTextToken;
    }

    /**
     * Marks the boundary between two HTTP requests.
     *
     * Production rebuilds the container per request, so a revoked token or a
     * freshly disabled account takes effect immediately. Inside a single test
     * the auth guard memoises whoever it resolved first and keeps answering
     * with them — which would make a revocation test pass while proving
     * nothing. Calling this makes the next request resolve its identity again.
     */
    protected function nextRequest(): static
    {
        $this->app['auth']->forgetGuards();

        return $this;
    }

    protected function company(array $attributes = []): Company
    {
        return Company::factory()->create($attributes);
    }

    protected function superAdmin(array $attributes = []): User
    {
        return User::factory()->superAdmin()->create($attributes);
    }

    protected function owner(Company $company, array $attributes = []): User
    {
        return User::factory()->owner()->forCompany($company)->create($attributes);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    protected function employee(Company $company, array $permissions = [], array $attributes = []): User
    {
        return User::factory()
            ->employee()
            ->forCompany($company)
            ->withPermissions($permissions)
            ->create($attributes);
    }

    /**
     * Asserts the standard error envelope rather than just the status code, so
     * a response that fails with the right number but the wrong shape is still
     * caught.
     */
    protected function assertApiError(TestResponse $response, int $status): TestResponse
    {
        $response->assertStatus($status)->assertJson(['success' => false]);
        $this->assertIsString($response->json('message'));

        return $response;
    }

    protected function assertApiSuccess(TestResponse $response, int $status = 200): TestResponse
    {
        return $response->assertStatus($status)->assertJson(['success' => true]);
    }
}
