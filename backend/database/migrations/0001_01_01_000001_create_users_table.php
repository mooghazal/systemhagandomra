<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();

            /*
             * NULL for super admins, who sit above every company. Owners and
             * employees always belong to exactly one company; the CHECK
             * constraint below makes that a database-level guarantee.
             *
             * RESTRICT rather than CASCADE for two reasons. MySQL forbids a
             * CASCADE action on a column that a stored generated column is
             * derived from, and `owner_of_company` below is derived from this
             * one. And it is not needed: companies are soft-deleted, which no
             * referential action ever sees, so CompanyService cascades to its
             * users itself. Should anything ever force-delete a company, this
             * refuses rather than silently destroying its people.
             */
            $table->foreignId('company_id')->nullable()
                ->constrained('companies')->restrictOnDelete();

            $table->string('name');
            $table->string('email');
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('role', ['super_admin', 'owner', 'employee']);
            $table->string('phone', 32)->nullable();
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            /*
             * Two uniqueness rules, both scoped to live rows only.
             *
             * `live_email` keeps one account per address while the account
             * exists, and releases the address as soon as it is soft-deleted —
             * so an employee who leaves and is re-hired keeps their own e-mail.
             *
             * `owner_of_company` enforces "exactly one owner per company"
             * (spec §3.2, §8) in the schema rather than in application code.
             *
             * Both rely on MySQL treating NULLs in a unique index as distinct.
             * They are declared here rather than in a later ALTER because
             * adding a stored generated column forces a table rebuild, which
             * fails on a table carrying foreign keys (MySQL error 1215).
             */
            $table->string('live_email')->nullable()
                ->storedAs('IF(deleted_at IS NULL, email, NULL)');
            $table->unsignedBigInteger('owner_of_company')->nullable()
                ->storedAs("IF(role = 'owner' AND deleted_at IS NULL, company_id, NULL)");

            $table->unique('live_email');
            $table->unique('owner_of_company');

            $table->index(['company_id', 'role']);
            $table->index('deleted_at');
        });

        // Defence in depth: even a direct SQL write cannot produce a super
        // admin attached to a company, or a company user with no company.
        // A CHECK adds no column, so it needs no table rebuild.
        DB::statement(<<<'SQL'
            ALTER TABLE `users` ADD CONSTRAINT `users_role_company_check` CHECK (
                (`role` = 'super_admin' AND `company_id` IS NULL)
                OR (`role` IN ('owner', 'employee') AND `company_id` IS NOT NULL)
            )
        SQL);

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
