<?php

namespace Tests\Feature;

use App\Jobs\ExecuteTestRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class TestRunTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create());
    }

    public function test_run_queues_the_current_instructions_and_allows_its_session_to_view_it(): void
    {
        Queue::fake();
        Storage::fake('local');
        $payload = ['url' => 'https://example.com', 'steps' => [['type' => 'navigate', 'text' => 'Open the page']]];

        $response = $this->postJson('/api/test-runs', $payload)->assertAccepted()->assertJsonPath('status', 'queued')->assertJsonPath('steps.0.status', 'pending');
        $id = $response->json('id');

        Queue::assertPushed(ExecuteTestRun::class, fn (ExecuteTestRun $job): bool => $job->runId === $id);
        $input = json_decode(Storage::disk('local')->get("test-runs/$id/input.json"), true);
        $this->assertArrayHasKey('webhook', $input['notification_providers']);
        unset($input['notification_providers'], $input['user_id']);
        $this->assertSame($payload, $input);
        $this->getJson("/api/test-runs/$id")->assertOk()->assertJsonPath('id', $id);
    }

    public function test_instruction_and_conditional_steps_can_be_queued(): void
    {
        Queue::fake();
        Storage::fake('local');
        $steps = [
            ['type' => 'instruction', 'text' => 'Review the appointment requirements'],
            ['type' => 'scroll', 'text' => 'Scroll down 600 pixels'],
            ['type' => 'condition', 'text' => 'If "Available" is visible then click: "Continue" else review: "Pause"'],
        ];

        $this->postJson('/api/test-runs', ['url' => 'https://example.com', 'steps' => $steps])
            ->assertAccepted()->assertJsonPath('steps.0.type', 'instruction')->assertJsonPath('steps.1.type', 'scroll')->assertJsonPath('steps.2.type', 'condition');

        Queue::assertPushed(ExecuteTestRun::class);
    }

    public function test_notification_delivery_requires_an_explicit_run_option(): void
    {
        Queue::fake();
        Storage::fake('local');
        $payload = ['url' => 'https://example.com', 'steps' => [['type' => 'notify', 'text' => 'Notify {"provider":"webhook","destination":"https://example.com/hook","message":"Hello"}']]];

        $preview = $this->postJson('/api/test-runs', $payload)->assertAccepted()->json('id');
        $this->assertArrayNotHasKey('send_notifications', json_decode(Storage::disk('local')->get("test-runs/$preview/input.json"), true));
        $live = $this->postJson('/api/test-runs', [...$payload, 'send_notifications' => true])->assertAccepted()->json('id');
        $this->assertTrue(json_decode(Storage::disk('local')->get("test-runs/$live/input.json"), true)['send_notifications']);

        Queue::assertPushed(ExecuteTestRun::class, 2);
    }

    public function test_run_rejects_invalid_instructions_without_starting_a_browser(): void
    {
        Queue::fake();

        $this->postJson('/api/test-runs', ['url' => 'file:///etc/passwd', 'steps' => [['type' => 'execute', 'text' => 'arbitrary code']]])
            ->assertUnprocessable()->assertJsonValidationErrors(['url', 'steps.0.type']);

        Queue::assertNothingPushed();
    }

    public function test_empty_steps_cannot_start_a_browser(): void
    {
        Queue::fake();

        $this->postJson('/api/test-runs', ['url' => 'https://example.com', 'steps' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('steps');

        Queue::assertNothingPushed();
    }

    public function test_other_sessions_cannot_view_screenshots_or_stop_a_run(): void
    {
        Storage::fake('local');
        $id = (string) Str::uuid();
        Storage::disk('local')->put("test-runs/$id/state.json", json_encode(['status' => 'running']));

        $this->getJson("/api/test-runs/$id")->assertNotFound();
        $this->deleteJson("/api/test-runs/$id")->assertNotFound();

        Storage::disk('local')->assertMissing("test-runs/$id/stop");
    }

    public function test_stop_signals_the_browser_and_preserves_the_last_preview(): void
    {
        Storage::fake('local');
        $id = (string) Str::uuid();
        Storage::disk('local')->put("test-runs/$id/state.json", json_encode(['status' => 'running']));
        Storage::disk('local')->put("test-runs/$id/frame.jpg", 'last screenshot');

        $this->withSession(['test_runs' => [$id => auth()->id()]])->deleteJson("/api/test-runs/$id")
            ->assertOk()->assertJsonPath('status', 'stopping');

        Storage::disk('local')->assertExists(["test-runs/$id/stop", "test-runs/$id/frame.jpg"]);
    }

    public function test_stale_runs_report_failure_instead_of_polling_forever(): void
    {
        Storage::fake('local');
        $id = (string) Str::uuid();
        Storage::disk('local')->put("test-runs/$id/state.json", json_encode(['status' => 'queued', 'startedAt' => now()->subMinutes(2)->getTimestampMs()]));

        $this->withSession(['test_runs' => [$id => auth()->id()]])->getJson("/api/test-runs/$id")
            ->assertOk()->assertJsonPath('status', 'failed');

        Storage::disk('local')->assertExists("test-runs/$id/stop");
    }
}
