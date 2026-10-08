<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChangeOwnPasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    /**
     * POST /api/auth/login
     *
     * Rate limited to 5 attempts per minute per e-mail+IP (see the `login`
     * limiter). Returns a bearer token the client stores and sends as
     * `Authorization: Bearer <token>` on every later request.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->auth->login(
            email: $request->validated('email'),
            password: $request->validated('password'),
            deviceName: $request->deviceName(),
        );

        return ApiResponse::success([
            'token' => $result['token'],
            'user' => UserResource::make($result['user']->load('company'))->toArray($request),
        ]);
    }

    /**
     * POST /api/auth/logout — revokes the current token only.
     */
    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request->user());

        return ApiResponse::success(null);
    }

    /**
     * POST /api/auth/logout-all — revokes every token for the account.
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $this->auth->logoutEverywhere($request->user());

        return ApiResponse::success(null);
    }

    /**
     * POST /api/auth/password — the account holder changing their own.
     *
     * Available to every role, including an employee, and that is deliberate.
     * Until this existed the only way to change a password was for somebody
     * more senior to do it: an employee who thought their account was
     * compromised had to find their owner, and an owner had to find a super
     * admin. The person with the most reason to act immediately was the one
     * who could not.
     *
     * The response carries a new token because every session was just
     * revoked, including this one.
     */
    public function changePassword(ChangeOwnPasswordRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $token = $this->auth->changeOwnPassword(
            $user,
            $request->validated('password'),
            $request->validated('device_name') ?: 'web',
        );

        return ApiResponse::success(['token' => $token]);
    }

    /**
     * GET /api/auth/me
     *
     * `permissions` is the effective list for this account. The dashboards use
     * it to decide what to render; it is never treated as authorisation, which
     * is re-evaluated server-side on every request.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->load(['company', 'permissions']);

        return ApiResponse::success([
            'user' => UserResource::make($user)->toArray($request),
            'permissions' => $user->effectivePermissions(),
        ]);
    }
}
