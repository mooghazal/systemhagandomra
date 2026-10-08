<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Picks the language for validation messages from the request.
 *
 * The backend serves three clients with different audiences — an Arabic admin
 * panel, a company dashboard, and an MCP agent whose output a developer reads
 * — so the language belongs to the caller, not to the server. Each one asks
 * with `Accept-Language` and gets its own wording.
 *
 * The header is matched against an allowlist rather than used as given: it is
 * attacker-controlled, and `App::setLocale()` resolves to a filesystem path.
 */
class SetLocale
{
    /** Locales with a translation directory in lang/. */
    private const SUPPORTED = ['ar', 'en'];

    public function handle(Request $request, Closure $next): Response
    {
        foreach ($this->preferences($request) as $locale) {
            if (in_array($locale, self::SUPPORTED, true)) {
                app()->setLocale($locale);

                break;
            }
        }

        return $next($request);
    }

    /**
     * The primary subtags of Accept-Language, best first — so `ar-SA` and
     * `ar-EG` both resolve to `ar`.
     *
     * @return array<int, string>
     */
    private function preferences(Request $request): array
    {
        return array_map(
            fn (string $language) => strtolower(explode('-', trim($language))[0]),
            $request->getLanguages(),
        );
    }
}
