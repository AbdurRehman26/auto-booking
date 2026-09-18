<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ScheduledRunArchiveTest extends TestCase
{
    use RefreshDatabase;

    public function test_runs_can_be_archived_in_bulk_and_restored_without_deletion(): void
    {
        $user = User::factory()->create();
        $ids = [$this->createRun($user), $this->createRun($user)];
        $this->actingAs($user)->patchJson('/api/scheduled-runs/archive', ['ids' => $ids, 'archived' => true])->assertOk();
        $this->getJson('/api/scheduled-runs')->assertJsonCount(0, 'data');
        $this->getJson('/api/scheduled-runs?archived=1')->assertJsonCount(2, 'data');
        $this->patchJson('/api/scheduled-runs/archive', ['ids' => [$ids[0]], 'archived' => false])->assertOk();
        $this->getJson('/api/scheduled-runs')->assertJsonPath('data.0.id', $ids[0]);
        $this->getJson('/api/scheduled-runs?archived=1')->assertJsonPath('data.0.id', $ids[1]);
        $this->assertDatabaseCount('scheduled_runs', 2);
    }

    public function test_bulk_actions_reject_foreign_runs_and_invalid_selections(): void
    {
        $user = User::factory()->create();
        $own = $this->createRun($user);
        $foreign = $this->createRun(User::factory()->create());
        $this->patchJson('/api/scheduled-runs/archive', ['ids' => [$own], 'archived' => true])->assertUnauthorized();
        $this->actingAs($user)->patchJson('/api/scheduled-runs/archive', ['ids' => [$own, $foreign], 'archived' => true])->assertNotFound();
        $this->assertDatabaseHas('scheduled_runs', ['id' => $own, 'archived_at' => null]);
        $this->assertDatabaseHas('scheduled_runs', ['id' => $foreign, 'archived_at' => null]);
        $this->patchJson('/api/scheduled-runs/archive', ['ids' => [], 'archived' => true])->assertUnprocessable();
        $this->getJson('/api/scheduled-runs')->assertJsonCount(1, 'data');
    }

    private function createRun(User $user): string
    {
        $flow = $user->workflows()->create(['public_id' => Str::uuid(), 'name' => 'History', 'check_interval' => 'Manual only']);
        $id = (string) Str::uuid();
        DB::table('scheduled_runs')->insert(['id' => $id, 'workflow_id' => $flow->id, 'slot' => '2026-09-18 12:00', 'status' => 'completed', 'created_at' => now(), 'updated_at' => now()]);

        return $id;
    }
}
