<?php

use App\Http\Controllers\TestRunController;
use App\Http\Controllers\WorkflowController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'app');
Route::apiResource('api/workflows', WorkflowController::class)->except(['show']);

Route::post('api/test-runs', [TestRunController::class, 'store'])->middleware('throttle:10,1');
Route::get('api/test-runs/{run}', [TestRunController::class, 'show'])->whereUuid('run');
Route::delete('api/test-runs/{run}', [TestRunController::class, 'destroy'])->whereUuid('run');
