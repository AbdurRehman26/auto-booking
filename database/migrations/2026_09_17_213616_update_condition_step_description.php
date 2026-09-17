<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->describe('Choose a branch using a condition, such as a visible button, error, dialog, or text.');
    }

    public function down(): void
    {
        $this->describe('Choose an action based on visible page text.');
    }

    private function describe(string $description): void
    {
        $row = DB::table('editor_configurations')->where('key', 'step_types');
        $types = json_decode($row->value('value'), true, 512, JSON_THROW_ON_ERROR);
        $types['condition']['description'] = $description;
        $row->update(['value' => json_encode($types, JSON_THROW_ON_ERROR)]);
    }
};
