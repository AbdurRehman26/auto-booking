<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PrimaryUserSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_seeder_creates_primary_user_and_preserves_existing_passwords(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::where('email', 'sydabdrehman@gmail.com')->firstOrFail();
        $this->assertTrue(Hash::check('sydabdrehman@gmail.com', $user->password));
        $this->assertNotSame('sydabdrehman@gmail.com', $user->password);
        $user->update(['password' => 'changed-password']);
        $this->seed(DatabaseSeeder::class);
        $this->assertDatabaseCount('users', 1);
        $this->assertTrue(Hash::check('changed-password', $user->fresh()->password));
    }
}
