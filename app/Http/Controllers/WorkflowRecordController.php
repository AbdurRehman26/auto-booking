<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkflowRecordController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json(DB::table('workflow_records')->where('user_id', $request->user()->id)->orderByDesc('id')->paginate(25))->header('Cache-Control', 'no-store');
    }
}
