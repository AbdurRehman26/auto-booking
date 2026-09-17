<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreChannelRequest;
use App\Models\Channel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChannelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->channels()->orderBy('name')->get(['id', 'name', 'provider', 'destination']))->header('Cache-Control', 'no-store');
    }

    public function store(StoreChannelRequest $request): JsonResponse
    {
        return response()->json($request->user()->channels()->create($request->validated()), 201)->header('Cache-Control', 'no-store');
    }

    public function update(StoreChannelRequest $request, Channel $channel): JsonResponse
    {
        abort_unless($channel->user_id === $request->user()->id, 404);
        $channel->update($request->validated());

        return response()->json($channel)->header('Cache-Control', 'no-store');
    }

    public function destroy(Request $request, Channel $channel): JsonResponse
    {
        abort_unless($channel->user_id === $request->user()->id, 404);
        $channel->delete();

        return response()->json(null, 204);
    }
}
