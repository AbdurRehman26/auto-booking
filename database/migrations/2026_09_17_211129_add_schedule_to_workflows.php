<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflows', function (Blueprint $table) {
            $table->json('schedule')->nullable();
        });
        $modes = [
            'Manual only' => [], 'Every minute' => [], 'Every 5 minutes' => [],
            'Every 15 minutes' => [], 'Every 30 minutes' => [], 'Every hour' => [],
            'Every day' => ['time'], 'Weekdays' => ['time'], 'Weekends' => ['time'],
            'Weekly on a day' => ['day', 'time'], 'On a specific date' => ['date', 'time'],
        ];
        $intervals = json_decode(DB::table('editor_configurations')->where('key', 'intervals')->value('value'), true, 512, JSON_THROW_ON_ERROR);
        DB::table('editor_configurations')->where('key', 'intervals')->update(['value' => json_encode(array_values(array_unique([...$intervals, ...array_keys($modes)])), JSON_THROW_ON_ERROR)]);
        DB::table('editor_configurations')->insert([
            ['key' => 'schedule_fields', 'value' => json_encode($modes, JSON_THROW_ON_ERROR)],
            ['key' => 'schedule_defaults', 'value' => json_encode(['time' => '09:00', 'timezone' => 'Europe/Berlin', 'day' => '1', 'date' => ''], JSON_THROW_ON_ERROR)],
            ['key' => 'schedule_days', 'value' => json_encode(['1' => 'Monday', '2' => 'Tuesday', '3' => 'Wednesday', '4' => 'Thursday', '5' => 'Friday', '6' => 'Saturday', '0' => 'Sunday'], JSON_THROW_ON_ERROR)],
            ['key' => 'timezones', 'value' => json_encode(DateTimeZone::listIdentifiers(), JSON_THROW_ON_ERROR)],
        ]);
    }

    public function down(): void
    {
        Schema::table('workflows', function (Blueprint $table) {
            $table->dropColumn('schedule');
        });
        DB::table('editor_configurations')->whereIn('key', ['schedule_fields', 'schedule_defaults', 'schedule_days', 'timezones'])->delete();
    }
};
