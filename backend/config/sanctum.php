<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Laravel\Sanctum\Sanctum;

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    |
    | Requests from the following domains / hosts will receive stateful API
    | authentication cookies. Typically, these should include your local
    | and production domains which access your API via a frontend SPA.
    |
    */

    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
        Sanctum::currentApplicationUrlWithPort(),
        // Sanctum::currentRequestHost(),
    ))),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Guards
    |--------------------------------------------------------------------------
    |
    | This array contains the authentication guards that will be checked when
    | Sanctum is trying to authenticate a request. If none of these guards
    | are able to authenticate the request, Sanctum will use the bearer
    | token that's present on an incoming request for authentication.
    |
    */

    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Expiration Minutes
    |--------------------------------------------------------------------------
    |
    | This value controls the number of minutes until an issued token will be
    | considered expired. This will override any values set in the token's
    | "expires_at" attribute, but first-party sessions are not affected.
    |
    */

    /*
     * Minutes before a token stops working; null means never.
     *
     * Read from the environment rather than hardcoded, because an MCP token
     * lives in an agent process and is worth expiring — and because
     * docs/SECURITY.md tells an operator to set SANCTUM_TOKEN_EXPIRATION,
     * which would otherwise do nothing at all.
     */
    'expiration' => env('SANCTUM_TOKEN_EXPIRATION') ?: null,

    /*
     * Minutes before a browser session token stops working.
     *
     * Separate from 'expiration' above, which Sanctum enforces globally from
     * each token's created_at — including the MCP agent's, which is a service
     * credential meant to live until it is revoked rather than to be reissued
     * every working day. So the browser lifetime is applied to each token as
     * it is created instead, by AuthService.
     *
     * There is a real default rather than null. Left unset, a signed-in
     * session never expired on the server: the cookie carrying it went stale
     * after eight hours, but the token itself stayed valid for ever, so a copy
     * taken from a log or a backup kept working indefinitely.
     *
     * Keep it in step with SESSION_LIFETIME_MINUTES in the two panels, which
     * sets how long the cookie survives in the browser.
     */
    'session_expiration' => (int) env('SESSION_TOKEN_EXPIRATION', 480),

    /*
    |--------------------------------------------------------------------------
    | Token Prefix
    |--------------------------------------------------------------------------
    |
    | Sanctum can prefix new tokens in order to take advantage of numerous
    | security scanning initiatives maintained by open source platforms
    | that notify developers if they commit tokens into repositories.
    |
    | See: https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning
    |
    */

    /*
     * A recognisable prefix is what lets GitHub and GitLab secret scanning
     * spot a leaked token and alert you. It costs nothing.
     */
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', 'hagamra_'),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Middleware
    |--------------------------------------------------------------------------
    |
    | When authenticating your first-party SPA with Sanctum you may need to
    | customize some of the middleware Sanctum uses while processing the
    | request. You may change the middleware listed below as required.
    |
    */

    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],

];
