<?php

namespace App\Providers;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rules\Password;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->assertProductionIsNotInDebugMode();
        $this->configureDevelopmentServer();
        $this->configureModels();
        $this->configurePasswords();
        $this->configureRateLimiting();
        $this->configureRouteBindings();

        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }

    /**
     * Refuses to boot a production environment with debug mode on.
     *
     * `.env.example` ships APP_DEBUG=true because it is a template for local
     * work, and that file is what someone copies to build a production .env.
     * Forgetting the one line turns every API error into a stack trace with
     * file paths and query fragments — a slow leak that nothing else here
     * would catch.
     *
     * Failing at boot is deliberate. It surfaces on the deploy, where it is
     * cheap to fix, rather than in a response someone else reads.
     */
    private function assertProductionIsNotInDebugMode(): void
    {
        if ($this->app->isProduction() && config('app.debug')) {
            throw new RuntimeException(
                'APP_DEBUG is true while APP_ENV is production. Set APP_DEBUG=false — '
                .'debug mode exposes stack traces, file paths and configuration to clients.'
            );
        }
    }

    /**
     * Lets `php artisan serve` accept file uploads on Windows.
     *
     * ServeCommand passes only an allowlist of environment variables to the
     * PHP server it spawns and strips everything else. TMP and TEMP are not on
     * that list, and on Windows they are where PHP gets its temporary
     * directory from — so without them every upload fails with
     * "unable to create a temporary file" before the request reaches Laravel.
     *
     * The list is a public static array precisely so an application can extend
     * it. Development only: production serves through a real web server, which
     * has its own environment.
     */
    private function configureDevelopmentServer(): void
    {
        if ($this->app->isProduction()) {
            return;
        }

        foreach (['TMP', 'TEMP', 'TMPDIR'] as $variable) {
            if (! in_array($variable, ServeCommand::$passthroughVariables, true)) {
                ServeCommand::$passthroughVariables[] = $variable;
            }
        }
    }

    private function configureModels(): void
    {
        /*
         * Fail loudly instead of silently dropping an attribute that is not in
         * $fillable. Without this, a payload carrying `role` or `company_id`
         * would be ignored quietly; with it, any code path that tries to
         * mass-assign a protected attribute surfaces during development and
         * testing rather than looking like it worked.
         */
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        Model::preventLazyLoading(! $this->app->isProduction());
    }

    /**
     * One password policy for every endpoint that sets one (owners, employees,
     * the seeded super admin), applied through Password::defaults().
     *
     * Deliberately no `uncompromised()` check: it would send a hash prefix of
     * every new password to an external service, which is not something this
     * system should do without the operator asking for it.
     */
    private function configurePasswords(): void
    {
        Password::defaults(fn () => $this->app->isProduction()
            ? Password::min(12)->letters()->mixedCase()->numbers()->symbols()
            : Password::min(10)->letters()->numbers()
        );
    }

    /**
     * Scoped bindings for the two routes whose model is a User.
     *
     * Packages, hotels and buses get this for free from CompanyScope, but the
     * users table is shared across every tenant and every role, so the
     * narrowing has to be explicit here. Resolving to "not found" rather than
     * letting a policy return 403 means an id from another company is
     * indistinguishable from an id that does not exist.
     */
    private function configureRouteBindings(): void
    {
        Route::bind('employee', function (string $value) {
            $query = User::query()->employees()->whereKey($value);

            $actor = request()->user();

            if ($actor instanceof User && $actor->role->belongsToCompany()) {
                $query->ofCompany($actor->company_id);
            }

            return $query->firstOrFail();
        });

        /*
         * Narrowed the same way, and for the same reason as the company
         * binding below.
         *
         * The note that used to stand here said owner routes are super-admin
         * only, so there was no tenant to narrow to. That is true of the
         * *controller*, which runs after this — the binding itself answered to
         * anyone. An employee with no permissions could walk
         * `/api/companies/{their own}/owners/{id}` and read 403 for an id that
         * belongs to an owner against 404 for one that does not, counting the
         * platform's owners across every tenant without being allowed to see
         * any of them.
         */
        Route::bind('owner', function (string $value) {
            $query = User::query()->owners()->whereKey($value);

            $actor = request()->user();

            if ($actor instanceof User && $actor->role->belongsToCompany()) {
                $query->ofCompany($actor->company_id);
            }

            return $query->firstOrFail();
        });

        /*
         * A company a caller may not see is "not found", not "forbidden".
         *
         * Without this the two are distinguishable: an existing company they
         * cannot read answers 403 while a made-up id answers 404, which lets
         * any company user walk the id space and count the platform's tenants.
         * That is the same leak the package and hotel bindings were written to
         * avoid, and it had been left open here.
         */
        Route::bind('company', function (string $value) {
            $query = Company::query()->whereKey($value);

            $actor = request()->user();

            if ($actor instanceof User && $actor->role->belongsToCompany()) {
                $query->whereKey($actor->company_id);
            }

            return $query->firstOrFail();
        });
    }

    private function configureRateLimiting(): void
    {
        /*
         * Authentication is limited per account *and* per client, so neither a
         * single address nor a single machine can be used to grind passwords.
         *
         * The bucket is keyed on the account the address resolves to, not on
         * the address as typed. Those are not the same thing: the users table
         * collates utf8mb4_unicode_ci, which is accent-insensitive, so
         * `möhamed@…` finds the row belonging to `mohamed@…` — while
         * mb_strtolower leaves the two as different strings and therefore
         * different buckets. Five guesses, switch an accent, five more, and so
         * on without limit. Resolving to the id first makes the bucket exactly
         * as wide as the thing being protected.
         *
         * Query builder rather than Eloquent: no global scope should be able to
         * change which row a throttle key is derived from.
         */
        RateLimiter::for('login', function (Request $request) {
            $email = mb_strtolower(trim((string) $request->input('email')));

            $id = $email === '' ? null : DB::table('users')
                ->whereNull('deleted_at')
                ->where('email', $email)
                ->value('id');

            // An address that matches nothing is still worth bucketing, so a
            // sweep over invented addresses cannot run free.
            $account = $id === null ? 'email:'.hash('xxh128', $email) : 'id:'.$id;

            return [
                Limit::perMinute(5)->by('login:'.$account.'|'.$request->ip()),
                /*
                 * The same account from anywhere. Without this, the per-client
                 * limit above is no limit at all against someone with more
                 * than one address to come from — which is the ordinary shape
                 * of a credential-stuffing run.
                 */
                Limit::perMinute(15)->by('login-account:'.$account),
                Limit::perMinute(20)->by('login-ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('api', function (Request $request) {
            $user = $request->user();

            return $user instanceof User
                ? Limit::perMinute(120)->by('user:'.$user->id)
                : Limit::perMinute(30)->by('ip:'.$request->ip());
        });

        // Writes are rarer than reads and far more expensive to get wrong.
        RateLimiter::for('writes', function (Request $request) {
            $user = $request->user();

            return $user instanceof User
                ? Limit::perMinute(40)->by('write-user:'.$user->id)
                : Limit::perMinute(10)->by('write-ip:'.$request->ip());
        });
    }
}
