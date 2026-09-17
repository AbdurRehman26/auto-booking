<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class EditorConfigurationController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(DB::table('editor_configurations')->get()->mapWithKeys(
            fn ($setting) => [$setting->key => json_decode($setting->value, true, 512, JSON_THROW_ON_ERROR)]
        ));
    }
}
