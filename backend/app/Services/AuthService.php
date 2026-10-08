<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Login and logout.
 *
 * Tokens are Sanctum personal access tokens, used identically by the admin
 * panel, the company dashboard and the MCP server. Abilities on the token
 * record *which door* a client came through; they never widen what the account
 * may do, which stays a function of role and permissions.
 */
class AuthService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array<int, string>  $abilities
     * @return array{user: User, token: string}
     *
     * @throws ValidationException
     */
    public function login(string $email, string $password, string $deviceName = 'web', array $abilities = ['*']): array
    {
        $user = User::query()->where('email', $email)->first();

        // One message and one timing profile for every failure mode, so the
        // response cannot be used to learn which addresses exist. Hash::check
        // is run against a dummy hash when there is no user, to keep the work
        // comparable.
        $passwordMatches = $user !== null
            ? Hash::check($password, $user->password)
            : Hash::check($password, '$2y$12$c0Vlp3pSZ1TMxGBShEoKAuqHkK8vzLzZr5WkJn7bLSqW8xkZ.6yAu');

        if ($user === null || ! $passwordMatches) {
            $this->audit->log(
                action: 'login_failed',
                resourceType: 'auth',
                metadata: ['email' => $email],
            );

            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $this->assertAccountUsable($user);

        $token = $user->createToken($deviceName, $abilities, $this->tokenExpiry());

        $this->audit->log(
            action: 'login',
            resourceType: 'auth',
            resourceId: $user->id,
            metadata: ['device' => $deviceName, 'abilities' => $abilities],
            companyId: $user->company_id,
            actor: $user,
        );

        return ['user' => $user, 'token' => $token->plainTextToken];
    }

    /**
     * Revokes the token used for the current request only, leaving the user's
     * other sessions and their MCP token alone.
     */
    public function logout(User $user): void
    {
        $token = $user->currentAccessToken();

        $this->audit->log(
            action: 'logout',
            resourceType: 'auth',
            resourceId: $user->id,
            companyId: $user->company_id,
            actor: $user,
        );

        $token?->delete();
    }

    public function logoutEverywhere(User $user): void
    {
        $user->tokens()->delete();

        $this->audit->log(
            action: 'logout_all',
            resourceType: 'auth',
            resourceId: $user->id,
            companyId: $user->company_id,
            actor: $user,
        );
    }

    /**
     * A disabled account, or one whose company has been disabled, cannot hold
     * a session at all. Checking here as well as in Gate::before means such an
     * account never even receives a token.
     *
     * @throws ValidationException
     */
    private function assertAccountUsable(User $user): void
    {
        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => __('messages.account_disabled'),
            ]);
        }

        if (! $user->companyIsActive()) {
            throw ValidationException::withMessages([
                'email' => __('messages.company_disabled'),
            ]);
        }
    }

    private function tokenExpiry(): ?\DateTimeInterface
    {
        $minutes = config('sanctum.expiration');

        return $minutes ? now()->addMinutes((int) $minutes) : null;
    }
}
