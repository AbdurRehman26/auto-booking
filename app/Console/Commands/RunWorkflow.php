<?php

namespace App\Console\Commands;

use App\Jobs\ExecuteTestRun;
use App\Models\Workflow;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class RunWorkflow extends Command
{
    protected $signature = 'workflows:run {workflow : Workflow database ID or public UUID} {--send-notifications : Deliver notifications instead of previewing them}';

    protected $description = 'Run a workflow immediately, ignoring its schedule and active status';

    public function handle(): int
    {
        $identifier = (string) $this->argument('workflow');
        $workflow = ctype_digit($identifier) ? Workflow::find($identifier) : Workflow::where('public_id', $identifier)->first();
        if (! $workflow) {
            $this->error('Workflow not found. Use its database ID or public UUID.');

            return self::FAILURE;
        }
        $steps = $workflow->steps->map(fn ($step) => ['type' => $step->type, 'text' => $step->instruction])->all();
        if (! $workflow->user_id || ! $workflow->start_url || ! $steps) {
            $this->error('The workflow needs an owner, start URL, and at least one step.');

            return self::FAILURE;
        }
        $id = (string) Str::uuid();
        $created = DB::transaction(function () use ($workflow, $steps, $id) {
            Workflow::whereKey($workflow->id)->lockForUpdate()->first();
            if (DB::table('scheduled_runs')->where('workflow_id', $workflow->id)->whereIn('status', ['queued', 'running'])->exists()) {
                return false;
            }
            $data = ['user_id' => $workflow->user_id, 'url' => $workflow->start_url, 'steps' => $steps, 'send_notifications' => (bool) $this->option('send-notifications'), 'notification_providers' => json_decode(DB::table('editor_configurations')->where('key', 'notification_providers')->value('value'), true, 512, JSON_THROW_ON_ERROR)];
            $state = ['id' => $id, 'status' => 'queued', 'message' => 'Manual run starting.', 'url' => $data['url'], 'currentStep' => null, 'startedAt' => now()->getTimestampMs(), 'steps' => array_map(fn ($step) => [...$step, 'status' => 'pending'], $steps)];
            Storage::disk('local')->put("test-runs/$id/input.json", json_encode($data, JSON_THROW_ON_ERROR));
            Storage::disk('local')->put("test-runs/$id/state.json", json_encode($state, JSON_THROW_ON_ERROR));
            DB::table('scheduled_runs')->insert(['id' => $id, 'workflow_id' => $workflow->id, 'slot' => "manual:$id", 'status' => 'queued', 'message' => 'Manual run starting.', 'created_at' => now(), 'updated_at' => now()]);

            return true;
        });
        if (! $created) {
            $this->error('This workflow already has a queued or running execution.');

            return self::FAILURE;
        }
        $this->info("Running {$workflow->name}. Run ID: $id");
        $job = new ExecuteTestRun($id, $workflow->id, manual: true);
        try {
            Bus::dispatchSync($job);
        } catch (Throwable $exception) {
            $job->failed($exception);
            report($exception);
            $this->error('Browser execution failed. Check storage/logs/laravel.log.');

            return self::FAILURE;
        }
        $run = DB::table('scheduled_runs')->where('id', $id)->first();
        $this->line("{$run->status}: {$run->message}");

        return $run->status === 'completed' ? self::SUCCESS : self::FAILURE;
    }
}
