<?php

namespace App\Console\Commands;

use App\Jobs\ExecuteTestRun;
use App\Models\Workflow;
use App\Services\WorkflowSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DispatchScheduledWorkflows extends Command
{
    protected $signature = 'workflows:dispatch-due';

    protected $description = 'Queue enabled workflows whose schedule is due';

    public function handle(WorkflowSchedule $schedule): int
    {
        $now = CarbonImmutable::now();
        Workflow::where('schedule_enabled', true)->orderBy('id')->each(function ($candidate) use ($now, $schedule) {
            DB::transaction(function () use ($candidate, $now, $schedule) {
                $workflow = Workflow::whereKey($candidate->id)->lockForUpdate()->first();
                if ($workflow && DB::table('scheduled_runs')->where('workflow_id', $workflow->id)->whereIn('status', ['queued', 'running'])->where('updated_at', '<', $now->subMinutes(5))->exists()) {
                    $workflow->update(['schedule_enabled' => false]);
                    DB::table('scheduled_runs')->where('workflow_id', $workflow->id)->whereIn('status', ['queued', 'running'])->update(['status' => 'failed', 'message' => 'Run became unresponsive. Scheduling paused; review before enabling again.', 'updated_at' => $now]);

                    return;
                }
                if (! $workflow || ! ($slot = $schedule->dueSlot($workflow, $now))) {
                    return;
                }
                $runs = DB::table('scheduled_runs')->where('workflow_id', $workflow->id);
                if ((clone $runs)->whereIn('status', ['queued', 'running'])->exists() || (clone $runs)->where('slot', $slot)->exists()) {
                    return;
                }
                $steps = $workflow->steps->map(fn ($step) => ['type' => $step->type, 'text' => $step->instruction])->all();
                if (! $steps) {
                    return;
                }
                $id = (string) Str::uuid();
                $data = ['user_id' => $workflow->user_id, 'url' => $workflow->start_url, 'steps' => $steps, 'send_notifications' => $workflow->scheduled_notifications, 'notification_providers' => json_decode(DB::table('editor_configurations')->where('key', 'notification_providers')->value('value'), true, 512, JSON_THROW_ON_ERROR)];
                $state = ['id' => $id, 'status' => 'queued', 'message' => 'Scheduled run queued.', 'url' => $data['url'], 'currentStep' => null, 'startedAt' => $now->getTimestampMs(), 'steps' => array_map(fn ($step) => [...$step, 'status' => 'pending'], $steps)];
                Storage::disk('local')->put("test-runs/$id/input.json", json_encode($data, JSON_THROW_ON_ERROR));
                Storage::disk('local')->put("test-runs/$id/state.json", json_encode($state, JSON_THROW_ON_ERROR));
                DB::table('scheduled_runs')->insert(['id' => $id, 'workflow_id' => $workflow->id, 'slot' => $slot, 'status' => 'queued', 'message' => 'Scheduled run queued.', 'created_at' => $now, 'updated_at' => $now]);
                ExecuteTestRun::dispatch($id, $workflow->id)->afterCommit();
            });
        });

        return self::SUCCESS;
    }
}
