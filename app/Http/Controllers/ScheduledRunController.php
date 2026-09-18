<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScheduledRunController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json(DB::table('scheduled_runs')->join('workflows', 'workflows.id', '=', 'scheduled_runs.workflow_id')->where('workflows.user_id', $request->user()->id)->when($request->boolean('archived'), fn ($query) => $query->whereNotNull('scheduled_runs.archived_at'), fn ($query) => $query->whereNull('scheduled_runs.archived_at'))->select('scheduled_runs.*', 'workflows.name as workflow_name')->orderByDesc('scheduled_runs.created_at')->paginate(25));
    }

    public function archive(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'uuid', 'distinct'],
            'archived' => ['required', 'boolean'],
        ]);
        $runs = DB::table('scheduled_runs')->whereIn('id', $data['ids'])
            ->whereIn('workflow_id', DB::table('workflows')->select('id')->where('user_id', $request->user()->id));
        abort_unless((clone $runs)->count() === count($data['ids']), 404);
        $runs->update(['archived_at' => $data['archived'] ? now() : null]);

        return response()->json(['message' => $data['archived'] ? 'Selected runs archived.' : 'Selected runs restored.']);
    }
}
