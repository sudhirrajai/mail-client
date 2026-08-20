<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailAccountController;
use App\Http\Controllers\EmailController;
use Illuminate\Support\Facades\Route;

// Public Auth Routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Protected API Routes (Requires Sanctum Token)
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });

    // Email Accounts Management
    Route::prefix('accounts')->group(function () {
        Route::get('/', [EmailAccountController::class, 'index']);
        Route::post('/', [EmailAccountController::class, 'store']);
        Route::post('/test-connection', [EmailAccountController::class, 'testConnection']);
        Route::delete('/{id}', [EmailAccountController::class, 'destroy']);
        Route::post('/{id}/sync', [EmailAccountController::class, 'sync']);
    });

    // Emails Management
    Route::prefix('emails')->group(function () {
        Route::get('/', [EmailController::class, 'index']);
        Route::post('/send', [EmailController::class, 'send']);
        Route::get('/{id}', [EmailController::class, 'show']);
        Route::patch('/{id}/star', [EmailController::class, 'toggleStar']);
        Route::patch('/{id}/read', [EmailController::class, 'toggleRead']);
        Route::patch('/{id}/folder', [EmailController::class, 'moveToFolder']);
        Route::delete('/{id}', [EmailController::class, 'destroy']);
    });
});
