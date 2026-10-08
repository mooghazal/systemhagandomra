<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();   // e.g. "packages.create"
            $table->string('group');            // e.g. "packages"
            $table->string('label');
            $table->timestamps();

            $table->index('group');
        });

        // Only employees carry explicit grants. Super admins are allowed
        // everything and owners are allowed everything inside their own
        // company, both resolved in code rather than stored as rows.
        Schema::create('employee_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'permission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_permissions');
        Schema::dropIfExists('permissions');
    }
};
