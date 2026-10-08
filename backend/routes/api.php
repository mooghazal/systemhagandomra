<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BusController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\HotelController;
use App\Http\Controllers\Api\OwnerController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\StatsController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
|
| Every route below except login is behind auth:sanctum. The admin panel, the
| company dashboard and the MCP server all call these same endpoints — there is
| no separate surface for any client, so authorisation, validation and tenant
| isolation cannot differ between them.
|
| Write routes carry an extra `throttle:writes` limiter on top of the global
| api limiter.
|
*/

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('auth.login');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::post('logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::post('logout-all', [AuthController::class, 'logoutAll'])->name('auth.logout-all');
        Route::get('me', [AuthController::class, 'me'])->name('auth.me');

        // Anyone may change their own, and only their own. The throttle is the
        // login one: the request carries the current password, so it is a
        // place to guess one.
        Route::post('password', [AuthController::class, 'changePassword'])
            ->middleware('throttle:login')
            ->name('auth.password');
    });
});

/*
 * `active` runs right after authentication, so a suspended account or one
 * belonging to a suspended company is turned away on every route here —
 * including the ones that read without asking a policy anything.
 */
Route::middleware(['auth:sanctum', 'active'])->group(function () {

    Route::get('permissions', [PermissionController::class, 'index'])->name('permissions.index');
    Route::get('audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');

    // Dashboard counters. Scoped to the caller's company unless they are a
    // super admin; see StatsController.
    Route::get('stats', [StatsController::class, 'index'])->name('stats.index');

    // Flat owner listing for the admin panel. Owner writes stay nested under
    // their company, below, so a create always names the company explicitly.
    Route::get('owners', [OwnerController::class, 'all'])->name('owners.index');

    // -- Company-owned resources ------------------------------------------
    // Readable by anyone holding the matching *.view permission; writes need
    // the matching create/update/delete permission. Both are scoped to the
    // caller's own company unless they are a super admin.

    $writes = ['store', 'update', 'destroy'];

    Route::apiResource('packages', PackageController::class)
        ->middlewareFor($writes, 'throttle:writes');
    Route::apiResource('hotels', HotelController::class)
        ->middlewareFor($writes, 'throttle:writes');
    Route::apiResource('buses', BusController::class)
        ->middlewareFor($writes, 'throttle:writes');

    // -- Employees ---------------------------------------------------------

    Route::apiResource('employees', EmployeeController::class)
        ->middlewareFor($writes, 'throttle:writes');

    Route::get('employees/{employee}/permissions', [EmployeeController::class, 'permissions'])
        ->name('employees.permissions.index');
    Route::put('employees/{employee}/permissions', [EmployeeController::class, 'syncPermissions'])
        ->middleware('throttle:writes')
        ->name('employees.permissions.sync');

    // -- System level (super admin) ---------------------------------------

    Route::apiResource('companies', CompanyController::class)
        ->middlewareFor($writes, 'throttle:writes');

    Route::prefix('companies/{company}')->group(function () {
        Route::get('owners', [OwnerController::class, 'index'])->name('companies.owners.index');

        Route::middleware('throttle:writes')->group(function () {
            Route::post('owners', [OwnerController::class, 'store'])->name('companies.owners.store');
            Route::match(['put', 'patch'], 'owners/{owner}', [OwnerController::class, 'update'])
                ->name('companies.owners.update');
            Route::delete('owners/{owner}', [OwnerController::class, 'destroy'])
                ->name('companies.owners.destroy');
        });
    });
});
