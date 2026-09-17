<?php

namespace App\Http\Controllers;

use App\Http\Requests\StartTestRunRequest;
use App\Jobs\ExecuteTestRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TestRunController extends Controller
{
    public function store(StartTestRunRequest $request): JsonResponse
    {
        $id = (string) Str::uuid();
        $data = $request->safe()->only(['url', 'steps', 'send_notifications']);
        $state = ['id' => $id, 'status' => 'queued', 'message' => 'Starting a fresh browser…', 'url' => $data['url'], 'currentStep' => null, 'startedAt' => now()->getTimestampMs(), 'steps' => array_map(fn (array $step): array => [...$step, 'status' => 'pending'], $data['steps'])];
        Storage::disk('local')->put("test-runs/$id/input.json", json_encode($data, JSON_THROW_ON_ERROR));
        Storage::disk('local')->put("test-runs/$id/state.json", json_encode($state, JSON_THROW_ON_ERROR));
        $request->session()->put("test_runs.$id", true);
        ExecuteTestRun::dispatch($id);

        return response()->json($state, 202)->header('Cache-Control', 'no-store');
    }

    public function show(Request $request, string $run): JsonResponse
    {
        $state = $this->state($request, $run);
        if (in_array($state['status'], ['queued', 'running']) && now()->getTimestampMs() - $state['startedAt'] > 75000) {
            Storage::disk('local')->put("test-runs/$run/stop", '1');
            $state['status'] = 'failed';
            $state['message'] = 'The browser did not respond in time. Check that the development queue is running, then retry.';
        }
        if (Storage::disk('local')->exists("test-runs/$run/frame.jpg")) {
            $state['frame'] = 'data:image/jpeg;base64,'.base64_encode(Storage::disk('local')->get("test-runs/$run/frame.jpg"));
        }

        return response()->json($state)->header('Cache-Control', 'no-store');
    }

    public function destroy(Request $request, string $run): JsonResponse
    {
        $state = $this->state($request, $run);
        Storage::disk('local')->put("test-runs/$run/stop", '1');

        return response()->json(['status' => in_array($state['status'], ['queued', 'running']) ? 'stopping' : $state['status']]);
    }

    private function state(Request $request, string $run): array
    {
        abort_unless(app()->environment('local', 'testing') && $request->session()->get("test_runs.$run"), 404);
        abort_unless(Storage::disk('local')->exists("test-runs/$run/state.json"), 404);

        return json_decode(Storage::disk('local')->get("test-runs/$run/state.json"), true, flags: JSON_THROW_ON_ERROR);
    }
}
