<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('run_id');
            $table->unsignedInteger('sequence');
            $table->unsignedInteger('step_number');
            $table->text('message');
            $table->text('page_url')->nullable();
            $table->timestamp('created_at');
            $table->unique(['run_id', 'sequence']);
        });
        $row = DB::table('editor_configurations')->where('key', 'step_types');
        $types = json_decode($row->value('value'), true, 512, JSON_THROW_ON_ERROR);
        $types['record'] = ['label' => 'Save to database', 'icon' => '▤', 'description' => 'Save a note from this run to view later.', 'text' => ''];
        $row->update(['value' => json_encode($types, JSON_THROW_ON_ERROR)]);
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_records');
        $row = DB::table('editor_configurations')->where('key', 'step_types');
        $types = json_decode($row->value('value'), true, 512, JSON_THROW_ON_ERROR);
        unset($types['record']);
        $row->update(['value' => json_encode($types, JSON_THROW_ON_ERROR)]);
    }
};
