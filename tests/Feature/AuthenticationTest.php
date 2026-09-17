<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_must_sign_in_and_can_sign_out(): void
    {
        $user = User::factory()->create(['password' => 'test-password']);
        $this->get('/')->assertRedirect('/login');
        $this->getJson('/api/workflows')->assertUnauthorized();
        $this->getJson('/api/editor-configuration')->assertUnauthorized();
        $this->postJson('/api/test-runs', [])->assertUnauthorized();
        $this->post('/login', ['email' => $user->email, 'password' => 'incorrect'])->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->post('/login', ['email' => $user->email, 'password' => 'test-password'])->assertRedirect('/');
        $this->assertAuthenticatedAs($user);
        $this->get('/')->assertOk()->assertSee('Sign out');
        $this->post('/logout')->assertRedirect('/login');
        $this->assertGuest();
    }

    public function test_users_only_list_and_edit_their_own_workflows(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $payload = ['name' => 'Private flow', 'interval' => 'Manual only', 'pause' => true, 'steps' => []];
        $id = $this->actingAs($owner)->postJson('/api/workflows', [...$payload, 'user_id' => $other->id])->assertCreated()->json('id');
        $this->assertDatabaseHas('workflows', ['id' => $id, 'user_id' => $owner->id]);
        $this->actingAs($other)->getJson('/api/workflows')->assertExactJson([]);
        $this->putJson('/api/workflows/'.$id, $payload)->assertNotFound();
        $this->deleteJson('/api/workflows/'.$id)->assertNotFound();
        $this->assertDatabaseHas('workflows', ['id' => $id, 'user_id' => $owner->id]);
    }
}
