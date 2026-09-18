<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScheduledRunController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json(DB::table('scheduled_runs')->join('workflows', 'workflows.id', '=', 'scheduled_runs.workflow_id')->where('workflows.user_id', $request->user()->id)->select('scheduled_runs.*', 'workflows.name as workflow_name')->orderByDesc('scheduled_runs.created_at')->paginate(25));
    }
}
