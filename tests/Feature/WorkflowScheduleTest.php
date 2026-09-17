<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkflowScheduleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create());
    }

    public function test_schedules_round_trip_through_the_database(): void
    {
        foreach ([
            ['Manual only', null],
            ['Only weekend', ['repeat_minutes' => 1, 'timezone' => 'Europe/Berlin']],
            ['Specific days', ['days' => [1], 'repeat_minutes' => 7, 'timezone' => 'Europe/Berlin']],
            ['All weekdays', ['repeat_minutes' => 60, 'timezone' => 'UTC']],
            ['Every day', ['time' => '08:30', 'timezone' => 'Europe/Berlin']],
            ['All weekdays', ['time' => '17:00', 'timezone' => 'America/New_York']],
            ['Only weekend', ['time' => '10:00', 'timezone' => 'UTC']],
            ['Specific days', ['days' => [1, 3, 5], 'time' => '09:15', 'timezone' => 'Europe/Berlin']],
            ['On a specific date', ['date' => '2027-04-12', 'time' => '14:30', 'timezone' => 'Europe/Berlin']],
        ] as [$interval, $schedule]) {
            $id = $this->postJson('/api/workflows', ['name' => 'Scheduled flow', 'interval' => $interval, 'pause' => true, 'steps' => [], 'schedule' => $schedule])->assertCreated()->assertJsonPath('schedule', $schedule)->json('id');
            $flow = collect($this->getJson('/api/workflows')->assertOk()->json())->firstWhere('id', $id);
            $this->assertEquals($schedule, $flow['schedule']);
        }
    }

    public function test_incomplete_or_invalid_calendar_schedules_are_rejected(): void
    {
        $payload = ['name' => 'Scheduled flow', 'interval' => 'Specific days', 'pause' => true, 'steps' => []];
        $this->postJson('/api/workflows', $payload)->assertUnprocessable()->assertJsonValidationErrors(['schedule.time', 'schedule.days', 'schedule.timezone']);
        $this->postJson('/api/workflows', [...$payload, 'schedule' => ['time' => '25:99', 'days' => [8], 'timezone' => 'invalid']])->assertUnprocessable()->assertJsonValidationErrors(['schedule.time', 'schedule.days.0', 'schedule.timezone']);
    }
}
