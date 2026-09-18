<?php

namespace App\Services;

use App\Models\Workflow;
use Carbon\CarbonImmutable;

class WorkflowSchedule
{
    public function dueSlot(Workflow $workflow, CarbonImmutable $now): ?string
    {
        if (! $workflow->schedule_enabled || ! $workflow->user_id || ! $workflow->start_url || $workflow->check_interval === 'Manual only') {
            return null;
        }
        $schedule = $workflow->schedule ?? [];
        $local = $now->setTimezone($schedule['timezone'] ?? 'UTC');
        $dayAllowed = match ($workflow->check_interval) {
            'Every day' => true,
            'All weekdays' => $local->isWeekday(),
            'Only weekend' => $local->isWeekend(),
            'Specific days' => in_array($local->dayOfWeek, array_map('intval', $schedule['days'] ?? []), true),
            'On a specific date' => $local->toDateString() === ($schedule['date'] ?? null),
            default => false,
        };
        if (! $dayAllowed) {
            return null;
        }
        $repeat = (int) ($schedule['repeat_minutes'] ?? 0);
        $due = $repeat > 0 ? ($local->hour * 60 + $local->minute) % $repeat === 0 : $local->format('H:i') === ($schedule['time'] ?? null);

        return $due ? $local->format('Y-m-d H:i') : null;
    }
}
