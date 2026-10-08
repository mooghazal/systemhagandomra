<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();

            // The actor is kept as a reference *and* as a snapshot, so the log
            // still reads correctly after the user or company is deleted.
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name')->nullable();
            $table->string('actor_email')->nullable();
            $table->string('actor_role', 32)->nullable();

            $table->foreignId('company_id')->nullable()->constrained('companies')->nullOnDelete();

            $table->string('action', 64);            // created, updated, deleted, login, ...
            $table->string('resource_type', 64);     // package, hotel, bus, employee, ...
            $table->unsignedBigInteger('resource_id')->nullable();

            // Which door the request came through. Never taken from an
            // unauthenticated client header.
            $table->enum('source', ['dashboard', 'api', 'mcp_agent'])->default('api');

            $table->string('ip_address', 45)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'created_at']);
            $table->index(['resource_type', 'resource_id']);
            $table->index(['user_id', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
