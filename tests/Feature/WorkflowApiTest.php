<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkflowApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create());
    }

    public function test_conditional_steps_and_instructions_keep_their_types_and_content(): void
    {
        $steps = [
            ['type' => 'condition', 'text' => 'If "Available" is visible then click: "Continue" else review: "Pause"'],
            ['type' => 'instruction', 'text' => 'Review the service requirements'],
        ];

        $created = $this->postJson('/api/workflows', [
            'name' => 'Conditional flow', 'url' => 'https://example.com',
            'interval' => 'Manual only', 'pause' => true, 'steps' => $steps,
        ])->assertCreated()->assertJsonPath('steps.0.text', $steps[0]['text'])->json();

        $this->getJson('/api/workflows')->assertJsonPath('0.steps.0.type', 'condition')->assertJsonPath('0.steps.1.type', 'instruction');
        $this->assertDatabaseHas('workflow_steps', ['workflow_id' => $created['id'], 'type' => 'condition', 'instruction' => $steps[0]['text']]);
    }

    public function test_workflow_with_steps_and_notifications_can_be_persisted_updated_and_deleted(): void
    {
        $payload = [
            'name' => 'Düsseldorf driving licence', 'status' => 'Draft',
            'url' => 'https://termine.duesseldorf.de/select2?md=3', 'interval' => 'Every day', 'schedule' => ['repeat_minutes' => 5, 'timezone' => 'Europe/Berlin'], 'pause' => true,
            'steps' => [['type' => 'navigate', 'text' => 'Open the booking page'], ['type' => 'check', 'text' => 'Check availability']],
            'notifications' => [['channel' => 'slack', 'trigger' => 'failure', 'step' => null, 'destination' => 'https://hooks.slack.com/services/test', 'message' => 'Flow failed']],
        ];

        $created = $this->postJson('/api/workflows', $payload)->assertCreated()->assertJsonPath('steps.1.type', 'check')->assertJsonPath('notifications.0.channel', 'slack')->json();
        $payload['name'] = 'Updated flow';
        $this->putJson('/api/workflows/'.$created['id'], $payload)->assertOk()->assertJsonPath('name', 'Updated flow');
        $this->getJson('/api/workflows')->assertOk()->assertJsonCount(1)->assertJsonPath('0.notifications.0.trigger', 'failure');
        $this->deleteJson('/api/workflows/'.$created['id'])->assertNoContent();
        $this->assertDatabaseCount('workflows', 0);
        $this->assertDatabaseCount('workflow_steps', 0);
        $this->assertDatabaseCount('notification_rules', 0);
    }
}
