<?php

use App\Http\Controllers\WorkflowController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'app');
Route::apiResource('api/workflows', WorkflowController::class)->except(['show']);
