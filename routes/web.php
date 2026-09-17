<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChannelController;
use App\Http\Controllers\EditorConfigurationController;
use App\Http\Controllers\TestRunController;
use App\Http\Controllers\WorkflowController;
use App\Http\Controllers\WorkflowRecordController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::view('/login', 'auth.login')->name('login');
    Route::post('/login', [AuthController::class, 'store'])->middleware('throttle:5,1');
});
Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
    Route::view('/', 'app');
    Route::get('api/records', WorkflowRecordController::class);
    Route::apiResource('api/channels', ChannelController::class)->except(['show']);
    Route::get('api/editor-configuration', EditorConfigurationController::class);
    Route::apiResource('api/workflows', WorkflowController::class)->except(['show']);

    Route::post('api/test-runs', [TestRunController::class, 'store'])->middleware('throttle:10,1');
    Route::get('api/test-runs/{run}', [TestRunController::class, 'show'])->whereUuid('run');
    Route::delete('api/test-runs/{run}', [TestRunController::class, 'destroy'])->whereUuid('run');

});
