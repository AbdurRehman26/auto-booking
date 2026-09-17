<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('editor_configurations')->insert(['key' => 'schedule_repeat_options', 'value' => json_encode([
            '0' => 'Once at a specific time', '1' => 'Every minute', '5' => 'Every 5 minutes',
            '15' => 'Every 15 minutes', '30' => 'Every 30 minutes', '60' => 'Every hour', 'custom' => 'Custom interval',
        ], JSON_THROW_ON_ERROR)]);
    }

    public function down(): void
    {
        DB::table('editor_configurations')->where('key', 'schedule_repeat_options')->delete();
    }
};
