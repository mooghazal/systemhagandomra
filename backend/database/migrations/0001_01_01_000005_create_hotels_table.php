<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hotels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('name');
            $table->string('location')->nullable();
            $table->text('description')->nullable();

            // Walking distance in metres; a hotel in Makkah has no meaningful
            // distance to Masjid an-Nabawi and vice versa, so both are optional.
            $table->unsignedInteger('distance_from_haram')->nullable();
            $table->unsignedInteger('distance_from_masjid_nabawi')->nullable();

            $table->unsignedTinyInteger('rating')->nullable();   // 1-5 stars
            $table->string('room_type')->nullable();
            $table->json('features')->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'is_active']);
            $table->index(['company_id', 'rating']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hotels');
    }
};
