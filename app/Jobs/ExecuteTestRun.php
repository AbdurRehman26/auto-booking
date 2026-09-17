<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Throwable;

class ExecuteTestRun implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 65;

    public function __construct(public string $runId) {}

    public function handle(): void
    {
        $directory = Storage::disk('local')->path("test-runs/$this->runId");
        $process = new Process(['node', base_path('resources/js/browser-runner.mjs'), $directory], base_path(), env: [
            'TERMINPILOT_TELEGRAM_TOKEN' => config('services.step_notifications.telegram_token') ?? '',
            'TERMINPILOT_TWILIO_SID' => config('services.step_notifications.twilio_sid') ?? '',
            'TERMINPILOT_TWILIO_TOKEN' => config('services.step_notifications.twilio_token') ?? '',
            'TERMINPILOT_WHATSAPP_FROM' => config('services.step_notifications.whatsapp_from') ?? '',
        ], timeout: 60);
        $process->mustRun();
    }

    public function failed(?Throwable $exception): void
    {
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
