<?php

use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withProviders([
        App\Providers\AuthServiceProvider::class,
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            Illuminate\Http\Middleware\HandleCors::class,
            // Must run before validation, so error messages come back in the
            // language the caller asked for.
            App\Http\Middleware\SetLocale::class,
        ]);

        // A baseline limiter for every API route; write routes add a tighter
        // one of their own on top (see routes/api.php).
        $middleware->api(append: [
            'throttle:api',
            Illuminate\Routing\Middleware\SubstituteBindings::class,
        ]);

        $middleware->append(App\Http\Middleware\SecurityHeaders::class);

        /*
         * Which machines in front of this one are allowed to say where a
         * request came from.
         *
         * Reached directly, nothing is trusted: an X-Forwarded-For header is
         * invented by whoever sent it, so honouring one would let anybody
         * choose their own rate-limit bucket and write a false IP into the
         * audit trail.
         *
         * Behind nginx, a load balancer or Cloudflare the opposite is true
         * and the header is the only way to know the real client. Without
         * this set, $request->ip() returns the proxy's address for every
         * request on the platform — so the login limiter becomes one shared
         * bucket and twenty failed attempts a minute from any one person lock
         * out every account, and every audit row records the same useless
         * address.
         *
         * TRUSTED_PROXIES is a comma-separated list of addresses or CIDR
         * ranges. The literal `*` is accepted for a host where something else
         * guarantees nothing can reach the application directly; it trusts
         * whatever arrives, so it is a deliberate choice and not a default.
         */
        $proxies = trim((string) env('TRUSTED_PROXIES', ''));

        if ($proxies !== '') {
            $middleware->trustProxies(
                at: $proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)),
            );
        }

        $middleware->alias([
            'active' => App\Http\Middleware\EnsureAccountIsActive::class,
        ]);

        /*
         * There is no login page to send anyone to — this application is an
         * API, and the sign-in screens live in the Next.js clients.
         *
         * Laravel's withMiddleware() installs `fn () => route('login')` by
         * default, and Authenticate::unauthenticated() evaluates it eagerly
         * for any request that does not carry `Accept: application/json`. With
         * no such route defined that throws a RouteNotFoundException from
         * inside the middleware, so a caller who simply forgot the header gets
         * a 500 where a 401 belongs. Returning null lets the exception handler
         * answer, which it does in the standard envelope.
         */
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        /*
         * Every API error leaves through here, so a client — browser or MCP —
         * can parse failures the same way it parses successes:
         *
         *     { "success": false, "message": "...", "errors": { ... } }
         *
         * Internal details (SQL, file paths, stack traces) are never included;
         * on a 500 the response carries a generic message while the real
         * exception goes to the log.
         */
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! ($request->is('api/*') || $request->expectsJson())) {
                return null;
            }

            return match (true) {
                $e instanceof ValidationException => ApiResponse::error(
                    'The given data was invalid.', 422, $e->errors()
                ),

                $e instanceof AuthenticationException => ApiResponse::error(
                    'Unauthenticated.', 401
                ),

                $e instanceof AuthorizationException => ApiResponse::error(
                    $e->getMessage() ?: 'This action is unauthorized.', 403
                ),

                // Model binding misses and cross-tenant ids both land here, and
                // both must look identical from the outside.
                $e instanceof ModelNotFoundException,
                $e instanceof NotFoundHttpException => ApiResponse::error(
                    'Resource not found.', 404
                ),

                $e instanceof TooManyRequestsHttpException => ApiResponse::error(
                    'Too many requests. Please slow down.', 429
                ),

                $e instanceof HttpExceptionInterface => ApiResponse::error(
                    $e->getMessage() ?: 'Request failed.', $e->getStatusCode()
                ),

                default => ApiResponse::error(
                    config('app.debug') ? $e->getMessage() : 'Server error.',
                    500
                ),
            };
        });
    })->create();
