<?php

use App\Http\Controllers\AdminPanelController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/admin/login',  [AdminPanelController::class, 'loginForm'])->name('admin.login');
Route::post('/admin/login', [AdminPanelController::class, 'loginSubmit'])->name('admin.login.submit');

Route::middleware('admin')->group(function () {
    Route::get('/admin',                                    [AdminPanelController::class, 'dashboard'])->name('admin.dashboard');
    Route::post('/admin/logout',                            [AdminPanelController::class, 'logout'])->name('admin.logout');
    Route::get('/admin/users',                              [AdminPanelController::class, 'users'])->name('admin.users');
    Route::post('/admin/users/{user}/toggle-premium',       [AdminPanelController::class, 'togglePremium'])->name('admin.users.toggle-premium');
    Route::post('/admin/messages/{message}/read',           [AdminPanelController::class, 'markRead'])->name('admin.messages.read');
    Route::post('/admin/messages/{message}/reply',          [AdminPanelController::class, 'reply'])->name('admin.messages.reply');
    Route::post('/admin/messages/{message}/close',          [AdminPanelController::class, 'closeMessage'])->name('admin.messages.close');
});
