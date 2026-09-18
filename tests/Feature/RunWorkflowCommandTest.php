<?php

namespace Tests\Feature;

use App\Jobs\ExecuteTestRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class RunWorkflowCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_command_executes_paused_workflow_synchronously_without_a_due_time(): void
    {
        Storage::fake('local');
        $flow = User::factory()->create()->workflows()->create(['public_id' => Str::uuid(), 'name' => 'Manual', 'start_url' => 'https://example.com', 'check_interval' => 'Manual only', 'schedule_enabled' => false]);
        $flow->steps()->create(['position' => 0, 'type' => 'record', 'instruction' => 'Manual result']);
        Bus::shouldReceive('dispatchSync')->twice()->andReturnUsing(function (ExecuteTestRun $job) use ($flow) {
            $this->assertTrue($job->manual);
            $this->assertSame($flow->id, $job->workflowId);
            $input = json_decode(Storage::disk('local')->get("test-runs/{$job->runId}/input.json"), true);
            $this->assertSame($flow->user_id, $input['user_id']);
            $this->assertSame([['type' => 'record', 'text' => 'Manual result']], $input['steps']);
            DB::table('scheduled_runs')->where('id', $job->runId)->update(['status' => 'completed', 'message' => 'Done']);
        });
        $this->artisan('workflows:run', ['workflow' => $flow->id])->assertSuccessful();
        $this->artisan('workflows:run', ['workflow' => $flow->public_id, '--send-notifications' => true])->assertSuccessful();
        $this->assertFalse($flow->fresh()->schedule_enabled);
        $this->assertDatabaseCount('scheduled_runs', 2);
        $inputs = DB::table('scheduled_runs')->get()->map(fn ($run) => json_decode(Storage::disk('local')->get("test-runs/{$run->id}/input.json"), true)['send_notifications'])->all();
        $this->assertEqualsCanonicalizing([false, true], $inputs);
    }

    public function test_unknown_and_incomplete_workflows_are_rejected(): void
    {
        Bus::fake();
        $this->artisan('workflows:run', ['workflow' => 999])->assertFailed();
        $flow = User::factory()->create()->workflows()->create(['public_id' => Str::uuid(), 'name' => 'Empty', 'check_interval' => 'Manual only']);
        $this->artisan('workflows:run', ['workflow' => $flow->id])->assertFailed();
        Bus::assertNothingDispatched();
        $this->assertDatabaseCount('scheduled_runs', 0);
    }

    public function test_manual_failure_does_not_disable_the_schedule(): void
    {
        Storage::fake('local');
        $flow = User::factory()->create()->workflows()->create(['public_id' => Str::uuid(), 'name' => 'Active', 'check_interval' => 'Every day', 'schedule_enabled' => true, 'pause_on_error' => true]);
        $id = (string) Str::uuid();
        DB::table('scheduled_runs')->insert(['id' => $id, 'workflow_id' => $flow->id, 'slot' => "manual:$id", 'status' => 'running']);
        (new ExecuteTestRun($id, $flow->id, manual: true))->failed(new \RuntimeException('Failed'));
        $this->assertDatabaseHas('scheduled_runs', ['id' => $id, 'status' => 'failed']);
        $this->assertTrue($flow->fresh()->schedule_enabled);
    }
}
