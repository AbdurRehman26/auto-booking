<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflows', function (Blueprint $table) {
            $table->boolean('schedule_enabled')->default(false);
            $table->boolean('scheduled_notifications')->default(false);
        });
        Schema::create('scheduled_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('workflow_id')->constrained()->cascadeOnDelete();
            $table->string('slot');
            $table->string('status')->default('queued');
            $table->text('message')->nullable();
            $table->timestamps();
            $table->unique(['workflow_id', 'slot']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_runs');
        Schema::table('workflows', fn (Blueprint $table) => $table->dropColumn(['schedule_enabled', 'scheduled_notifications']));
    }
};
