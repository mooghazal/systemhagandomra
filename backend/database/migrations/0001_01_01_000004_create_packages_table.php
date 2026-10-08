<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('name');
            $table->text('description')->nullable();

            // Every descriptive field below is optional on purpose: a package
            // may be priced without a duration, dated without a price, and so
            // on. Only the name and the owning company are required.
            $table->decimal('price', 12, 2)->nullable();
            $table->string('currency', 3)->nullable();
            $table->unsignedSmallInteger('days')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            // Free text, not an enum: a company may sell "Ramadan Umrah",
            // "Family Umrah", "VIP" or "Economy" (spec §13), and adding one
            // more must not require a migration.
            $table->string('trip_type')->nullable();
            $table->string('location')->nullable();
            $table->json('features')->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'is_active']);
            $table->index(['company_id', 'trip_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packages');
    }
};
