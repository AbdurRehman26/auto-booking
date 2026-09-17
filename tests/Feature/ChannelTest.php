<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ChannelTest extends TestCase
{
    use RefreshDatabase;

    public function test_channels_are_private_editable_and_encrypted_in_storage(): void
    {
        $this->getJson('/api/channels')->assertUnauthorized();
        $owner = User::factory()->create();
        $payload = ['name' => 'Team alerts', 'provider' => 'slack', 'destination' => 'https://hooks.slack.com/services/example'];
        $id = $this->actingAs($owner)->postJson('/api/channels', $payload)->assertCreated()->json('id');
        $this->assertNotSame($payload['destination'], DB::table('channels')->where('id', $id)->value('destination'));
        $this->getJson('/api/channels')->assertJsonPath('0.destination', $payload['destination']);
        $this->putJson('/api/channels/'.$id, [...$payload, 'name' => 'Updated'])->assertOk()->assertJsonPath('name', 'Updated');
        $this->actingAs(User::factory()->create())->getJson('/api/channels')->assertExactJson([]);
        $this->putJson('/api/channels/'.$id, $payload)->assertNotFound();
        $this->deleteJson('/api/channels/'.$id)->assertNotFound();
        $this->actingAs($owner)->deleteJson('/api/channels/'.$id)->assertNoContent();
        $this->assertDatabaseCount('channels', 0);
    }

    public function test_invalid_destinations_cannot_be_saved(): void
    {
        $this->actingAs(User::factory()->create());
        foreach (['email', 'webhook', 'whatsapp', 'telegram'] as $provider) {
            $this->postJson('/api/channels', ['name' => 'Invalid', 'provider' => $provider, 'destination' => 'not-valid'])->assertUnprocessable()->assertJsonValidationErrors('destination');
        }
    }
}
