<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $row = DB::table('editor_configurations')->where('key', 'step_types');
        $types = json_decode($row->value('value'), true, 512, JSON_THROW_ON_ERROR);
        $types['condition']['text'] = preg_replace('/^If "Expected text"(?: is visible)? then/', 'If "" then', $types['condition']['text']);
        $row->update(['value' => json_encode($types, JSON_THROW_ON_ERROR)]);
    }

    public function down(): void
    {
        // Keep new conditions empty rather than restoring example content.
    }
};
