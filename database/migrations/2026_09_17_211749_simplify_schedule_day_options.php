<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $fields = ['Manual only' => [], 'Every day' => ['time'], 'All weekdays' => ['time'], 'Only weekend' => ['time'], 'Specific days' => ['days', 'time'], 'On a specific date' => ['date', 'time']];
        $aliases = ['Weekdays' => 'All weekdays', 'Weekends' => 'Only weekend', 'Weekly on a day' => 'Specific days'];
        $minutes = ['Every minute' => 1, 'Every 5 minutes' => 5, 'Every 15 minutes' => 15, 'Every 30 minutes' => 30, 'Every hour' => 60];
        DB::table('workflows')->orderBy('id')->each(function ($flow) use ($aliases, $minutes) {
            $schedule = $flow->schedule ? json_decode($flow->schedule, true, 512, JSON_THROW_ON_ERROR) : null;
            $interval = $aliases[$flow->check_interval] ?? $flow->check_interval;
            if (isset($minutes[$interval])) {
                $schedule = ['repeat_minutes' => $minutes[$interval], 'timezone' => 'Europe/Berlin'];
                $interval = 'Every day';
            }
            if ($interval === 'Specific days') {
                $schedule['days'] = [(int) ($schedule['day'] ?? 1)];
                unset($schedule['day']);
            }
            DB::table('workflows')->where('id', $flow->id)->update(['check_interval' => $interval, 'schedule' => $schedule ? json_encode($schedule, JSON_THROW_ON_ERROR) : null]);
        });
        DB::table('editor_configurations')->where('key', 'intervals')->update(['value' => json_encode(array_keys($fields), JSON_THROW_ON_ERROR)]);
        DB::table('editor_configurations')->where('key', 'schedule_fields')->update(['value' => json_encode($fields, JSON_THROW_ON_ERROR)]);
        $row = DB::table('editor_configurations')->where('key', 'schedule_defaults');
        $defaults = json_decode($row->value('value'), true, 512, JSON_THROW_ON_ERROR);
        $defaults['days'] = [1];
        unset($defaults['day']);
        $row->update(['value' => json_encode($defaults, JSON_THROW_ON_ERROR)]);
    }

    public function down(): void
    {
        // Multiple selected days cannot be represented by the old single-day setting.
    }
};
