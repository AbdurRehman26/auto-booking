<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('editor_configurations', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->json('value');
        });
        $defaults = json_decode(file_get_contents(database_path('seeders/editor-configuration.json')), true, 512, JSON_THROW_ON_ERROR);
        foreach ($defaults as $key => $value) {
            DB::table('editor_configurations')->insert(['key' => $key, 'value' => json_encode($value, JSON_THROW_ON_ERROR)]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('editor_configurations');
    }
};
