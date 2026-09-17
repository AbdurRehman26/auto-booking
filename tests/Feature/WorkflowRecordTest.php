<?php

namespace Tests\Feature;

use App\Jobs\ExecuteTestRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class WorkflowRecordTest extends TestCase
{
    use RefreshDatabase;

    public function test_captured_records_are_saved_once_and_only_visible_to_the_owner(): void
    {
        Storage::fake('local');
        $owner = User::factory()->create();
        $id = (string) Str::uuid();
        Storage::disk('local')->put("test-runs/$id/input.json", json_encode(['user_id' => $owner->id]));
        Storage::disk('local')->put("test-runs/$id/records.jsonl", json_encode(['step_number' => 3, 'message' => 'No appointment available', 'page_url' => 'https://example.com', 'created_at' => '2026-09-17T12:00:00.000Z'])."\n");
        $job = new ExecuteTestRun($id);
        $job->saveRecords();
        $job->saveRecords();
        $this->assertDatabaseCount('workflow_records', 1);
        $this->getJson('/api/records')->assertUnauthorized();
        $this->actingAs($owner)->getJson('/api/records')->assertOk()->assertJsonPath('data.0.message', 'No appointment available')->assertJsonPath('data.0.step_number', 3);
        $this->actingAs(User::factory()->create())->getJson('/api/records')->assertJsonPath('data', []);
    }
}
