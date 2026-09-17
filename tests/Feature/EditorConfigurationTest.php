<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class EditorConfigurationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create());
    }

    public function test_editor_uses_database_configuration_and_does_not_create_sample_workflows(): void
    {
        $types = json_decode(DB::table('editor_configurations')->where('key', 'step_types')->value('value'), true);
        $types['click']['label'] = 'Choose a control';
        unset($types['wait']);
        DB::table('editor_configurations')->where('key', 'step_types')->update(['value' => json_encode($types)]);
        $this->getJson('/api/editor-configuration')->assertOk()->assertJsonPath('step_types.click.label', 'Choose a control')->assertJsonMissingPath('step_types.wait');
        $this->getJson('/api/workflows')->assertOk()->assertExactJson([]);
        $this->postJson('/api/workflows', ['name' => 'Invalid type', 'interval' => 'Manual only', 'pause' => true, 'steps' => [['type' => 'wait', 'text' => 'Wait 3 seconds']]])->assertUnprocessable()->assertJsonValidationErrors('steps.0.type');
        $this->postJson('/api/test-runs', ['url' => 'https://example.com', 'steps' => [['type' => 'wait', 'text' => 'Wait 3 seconds']]])->assertUnprocessable()->assertJsonValidationErrors('steps.0.type');
        $this->assertDatabaseCount('workflows', 0);
    }
}
