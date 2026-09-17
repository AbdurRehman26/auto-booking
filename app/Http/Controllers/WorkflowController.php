<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkflowRequest;
use App\Models\Workflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WorkflowController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Workflow::with(['steps', 'notificationRules'])->latest()->get()->map(fn ($workflow) => $this->present($workflow)));
    }

    public function store(StoreWorkflowRequest $request): JsonResponse
    {
        $workflow = DB::transaction(function () use ($request) {
            $workflow = Workflow::create(['public_id' => Str::uuid(), ...$this->attributes($request->validated())]);
            $this->syncChildren($workflow, $request->validated());
            return $workflow;
        });
        return response()->json($this->present($workflow->load(['steps', 'notificationRules'])), 201);
    }

    public function update(StoreWorkflowRequest $request, Workflow $workflow): JsonResponse
    {
        DB::transaction(function () use ($request, $workflow) {
            $workflow->update($this->attributes($request->validated()));
            $this->syncChildren($workflow, $request->validated());
        });
        return response()->json($this->present($workflow->fresh(['steps', 'notificationRules'])));
    }

    public function destroy(Workflow $workflow): JsonResponse
    {
        $workflow->delete();
        return response()->json(null, 204);
    }

    private function attributes(array $data): array
    {
        return ['name' => $data['name'], 'status' => $data['status'] ?? 'Draft', 'start_url' => $data['url'] ?? null, 'check_interval' => $data['interval'], 'pause_on_error' => $data['pause']];
    }

    private function syncChildren(Workflow $workflow, array $data): void
    {
        $workflow->steps()->delete();
        foreach ($data['steps'] ?? [] as $position => $step) {
            $workflow->steps()->create(['position' => $position, 'type' => $step['type'], 'instruction' => $step['text']]);
        }
        $workflow->notificationRules()->delete();
        foreach ($data['notifications'] ?? [] as $rule) {
            $workflow->notificationRules()->create(['channel' => $rule['channel'], 'trigger' => $rule['trigger'], 'step_position' => $rule['step'] ?? null, 'destination' => $rule['destination'], 'message' => $rule['message'] ?? null]);
        }
    }

    private function present(Workflow $workflow): array
    {
        return [
            'id' => $workflow->id, 'publicId' => $workflow->public_id, 'name' => $workflow->name, 'status' => $workflow->status,
            'url' => $workflow->start_url ?? '', 'interval' => $workflow->check_interval, 'pause' => $workflow->pause_on_error,
            'steps' => $workflow->steps->map(fn ($step) => ['id' => $step->id, 'type' => $step->type, 'text' => $step->instruction])->values(),
            'notifications' => $workflow->notificationRules->map(fn ($rule) => ['id' => $rule->id, 'channel' => $rule->channel, 'trigger' => $rule->trigger, 'step' => $rule->step_position, 'destination' => $rule->destination, 'message' => $rule->message])->values(),
        ];
    }
}
