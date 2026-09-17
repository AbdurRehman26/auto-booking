<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Workflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class WorkflowOwnershipTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigning_an_owner_preserves_steps_and_schedule_when_the_flow_is_edited(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $workflow = Workflow::create(['public_id' => Str::uuid(), 'name' => 'Driving licence', 'status' => 'Draft', 'check_interval' => 'Manual only', 'pause_on_error' => true]);
        $workflow->user()->associate($user);
        $workflow->save();
        $this->putJson('/api/workflows/'.$workflow->id, ['name' => 'Driving licence', 'interval' => 'Manual only', 'pause' => true, 'steps' => [['type' => 'wait', 'text' => 'Wait 3 seconds']]])->assertOk();
        $this->assertTrue($workflow->fresh()->user->is($user));
        $this->assertTrue($user->workflows()->first()->is($workflow));
        $this->assertSame('Wait 3 seconds', $workflow->steps()->first()->instruction);
    }
}
