<?php

namespace App\Jobs;

use App\Models\Workflow;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Throwable;

class ExecuteTestRun implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 65;

    public function __construct(public string $runId, public ?int $workflowId = null, public bool $manual = false) {}

    public function handle(): void
    {
        if ($this->workflowId) {
            $workflow = Workflow::find($this->workflowId);
            if (! $workflow || (! $this->manual && ! $workflow->schedule_enabled)) {
                DB::table('scheduled_runs')->where('id', $this->runId)->update(['status' => 'cancelled', 'message' => 'Schedule was disabled before this run started.', 'updated_at' => now()]);

                return;
            }
            DB::table('scheduled_runs')->where('id', $this->runId)->update(['status' => 'running', 'updated_at' => now()]);
        }
        $directory = Storage::disk('local')->path("test-runs/$this->runId");
        $process = new Process(['node', base_path('resources/js/browser-runner.mjs'), $directory], base_path(), env: [
            'TERMINPILOT_OPENAI_KEY' => config('services.condition_ai.key') ?? '',
            'TERMINPILOT_OPENAI_MODEL' => config('services.condition_ai.model'),
            'TERMINPILOT_RESEND_KEY' => config('services.resend.key') ?? '',
            'TERMINPILOT_EMAIL_FROM' => config('mail.from.address') ?? '',
            'TERMINPILOT_TELEGRAM_TOKEN' => config('services.step_notifications.telegram_token') ?? '',
            'TERMINPILOT_TWILIO_SID' => config('services.step_notifications.twilio_sid') ?? '',
            'TERMINPILOT_TWILIO_TOKEN' => config('services.step_notifications.twilio_token') ?? '',
            'TERMINPILOT_WHATSAPP_FROM' => config('services.step_notifications.whatsapp_from') ?? '',
        ], timeout: 60);
        try {
            $process->mustRun();
        } finally {
            $this->saveRecords();
            $this->finishSchedule();
        }
    }

    private function finishSchedule(?string $failure = null): void
    {
        if (! $this->workflowId) {
            return;
        }
        $path = "test-runs/$this->runId/state.json";
        $state = Storage::disk('local')->exists($path) ? json_decode(Storage::disk('local')->get($path), true) : [];
        $status = $failure ? 'failed' : ($state['status'] ?? 'failed');
        if (! in_array($status, ['completed', 'paused', 'failed', 'stopped'])) {
            $status = 'failed';
        }
        DB::table('scheduled_runs')->where('id', $this->runId)->update(['status' => $status, 'message' => $failure ?? ($state['message'] ?? 'Run stopped unexpectedly.'), 'updated_at' => now()]);
        $workflow = Workflow::find($this->workflowId);
        if (! $this->manual && $workflow && ($status === 'paused' || ($status === 'failed' && $workflow->pause_on_error))) {
            $workflow->update(['schedule_enabled' => false]);
        }
    }

    public function saveRecords(): void
    {
        $disk = Storage::disk('local');
        $path = "test-runs/$this->runId/records.jsonl";
        if (! $disk->exists($path)) {
            return;
        }
        $input = json_decode($disk->get("test-runs/$this->runId/input.json"), true, 512, JSON_THROW_ON_ERROR);
        foreach (array_filter(explode("\n", $disk->get($path))) as $sequence => $line) {
            $record = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
            DB::table('workflow_records')->insertOrIgnore([
                'user_id' => $input['user_id'], 'run_id' => $this->runId, 'sequence' => $sequence,
                'step_number' => $record['step_number'], 'message' => $record['message'],
                'page_url' => $record['page_url'], 'created_at' => Carbon::parse($record['created_at'])->utc(),
            ]);
        }
    }

    public function failed(?Throwable $exception): void
    {
        $this->finishSchedule('The scheduled runner stopped unexpectedly.');
        $path = Storage::disk('local')->path("test-runs/$this->runId/state.json");
        if (! File::exists($path)) {
            return;
        }
        $state = json_decode(File::get($path), true, flags: JSON_THROW_ON_ERROR);
        $state['status'] = 'failed';
        $state['message'] = 'The browser runner stopped unexpectedly. Check the application logs, then retry.';
        File::replace($path, json_encode($state, JSON_THROW_ON_ERROR));
    }
}
