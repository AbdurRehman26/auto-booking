<?php

namespace Tests\Feature;

use App\Jobs\ExecuteTestRun;
use App\Models\User;
use App\Models\Workflow;
use App\Services\WorkflowSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ScheduledWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_due_work_is_queued_once_with_its_owner_and_notifications_off(): void
    {
        Queue::fake();
        Storage::fake('local');
        $this->travelTo(CarbonImmutable::parse('2026-09-19 08:00:00', 'UTC'));
        $owner = User::factory()->create();
        $workflow = $owner->workflows()->create(['public_id' => Str::uuid(), 'name' => 'Scheduled', 'start_url' => 'https://example.com', 'check_interval' => 'Only weekend', 'schedule' => ['repeat_minutes' => 1, 'timezone' => 'Europe/Berlin'], 'schedule_enabled' => true]);
        $workflow->steps()->create(['position' => 0, 'type' => 'record', 'instruction' => 'Run completed']);
        $this->artisan('workflows:dispatch-due')->assertSuccessful();
        $this->artisan('workflows:dispatch-due')->assertSuccessful();
        Queue::assertPushed(ExecuteTestRun::class, 1);
        $run = DB::table('scheduled_runs')->first();
        $input = json_decode(Storage::disk('local')->get("test-runs/$run->id/input.json"), true);
        $this->assertSame($owner->id, $input['user_id']);
        $this->assertFalse($input['send_notifications']);
        $this->travel(1)->minutes();
        $this->artisan('workflows:dispatch-due')->assertSuccessful();
        Queue::assertPushed(ExecuteTestRun::class, 1);
        $this->actingAs($owner)->getJson('/api/scheduled-runs')->assertJsonPath('data.0.id', $run->id);
        $this->actingAs(User::factory()->create())->getJson('/api/scheduled-runs')->assertJsonPath('data', []);
        $workflow->update(['schedule_enabled' => false]);
        (new ExecuteTestRun($run->id, $workflow->id))->handle();
        $this->assertDatabaseHas('scheduled_runs', ['id' => $run->id, 'status' => 'cancelled']);
    }

    public function test_day_filters_intervals_and_timezone_are_respected(): void
    {
        $flow = new Workflow(['start_url' => 'https://example.com', 'schedule_enabled' => true]);
        $flow->user_id = 1;
        $schedule = new WorkflowSchedule;
        $now = CarbonImmutable::parse('2026-09-18 22:14:00', 'UTC');
        $flow->check_interval = 'Only weekend';
        $flow->schedule = ['timezone' => 'Europe/Berlin', 'repeat_minutes' => 7];
        $this->assertSame('2026-09-19 00:14', $schedule->dueSlot($flow, $now));
        $this->assertNull($schedule->dueSlot($flow, $now->addMinute()));
        $flow->check_interval = 'All weekdays';
        $this->assertNull($schedule->dueSlot($flow, $now));
        $flow->check_interval = 'Specific days';
        $flow->schedule = ['timezone' => 'Europe/Berlin', 'days' => [6], 'time' => '00:14'];
        $this->assertNotNull($schedule->dueSlot($flow, $now));
        $flow->check_interval = 'On a specific date';
        $flow->schedule = ['timezone' => 'Europe/Berlin', 'date' => '2026-09-19', 'time' => '00:14'];
        $this->assertNotNull($schedule->dueSlot($flow, $now));
        $this->assertNull($schedule->dueSlot($flow, $now->addDay()));
        $flow->schedule_enabled = false;
        $this->assertNull($schedule->dueSlot($flow, $now));
    }
}
