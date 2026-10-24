<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailAccountController;
use App\Http\Controllers\EmailController;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Support\Facades\Route;

// Public Auth Routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
});

// Protected API Routes (Requires Sanctum Token)
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
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
        Route::post('/draft', [EmailController::class, 'saveDraft']);
        Route::post('/bulk-read', [EmailController::class, 'bulkRead']);
        Route::post('/bulk-delete', [EmailController::class, 'bulkDelete']);
        Route::post('/bulk-folder', [EmailController::class, 'bulkMoveToFolder']);
        Route::post('/bulk-star', [EmailController::class, 'bulkStar']);
        Route::get('/{id}', [EmailController::class, 'show']);
        Route::patch('/{id}/star', [EmailController::class, 'toggleStar']);
        Route::patch('/{id}/read', [EmailController::class, 'toggleRead']);
        Route::patch('/{id}/folder', [EmailController::class, 'moveToFolder']);
        Route::delete('/{id}', [EmailController::class, 'destroy']);
    });

    // Admin Management Routes
    Route::middleware(EnsureUserIsAdmin::class)->prefix('admin')->group(function () {
        Route::get('/metrics', [AdminController::class, 'metrics']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::put('/users/{id}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);
        Route::post('/impersonate/{id}', [AdminController::class, 'impersonate']);
        Route::post('/test-connection', [AdminController::class, 'testConnection']);
    });
});
