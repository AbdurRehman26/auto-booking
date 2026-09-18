<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class PrimaryUserSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'sydabdrehman@gmail.com'],
            ['name' => 'sydabdrehman', 'password' => 'sydabdrehman@gmail.com'],
        );
    }
}
