<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug');
            $table->string('domain')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('address')->nullable();
            $table->string('logo_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            /*
             * Slugs and domains must be unique among *live* companies only.
             *
             * MySQL has no partial indexes, so uniqueness is carried by stored
             * generated columns that go NULL the moment a row is soft-deleted.
             * Because MySQL treats NULLs in a unique index as distinct, any
             * number of deleted companies may share a slug while at most one
             * live company holds it — so deleting a company frees its slug
             * immediately.
             *
             * Declared here rather than in a later ALTER: adding a stored
             * generated column forces a table rebuild, which fails on a table
             * carrying foreign keys (MySQL error 1215).
             */
            $table->string('live_slug')->nullable()
                ->storedAs('IF(deleted_at IS NULL, slug, NULL)');
            $table->string('live_domain')->nullable()
                ->storedAs('IF(deleted_at IS NULL, domain, NULL)');

            $table->unique('live_slug');
            $table->unique('live_domain');

            $table->index('is_active');
            $table->index('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
