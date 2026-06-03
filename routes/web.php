<?php

use App\Http\Controllers\AdminPanelController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/deploy-run', function (\Illuminate\Http\Request $request) {
    $token = config('app.deploy_token');
    if (!$token || $request->query('token') !== $token) {
        abort(403, 'Forbidden');
    }

    $out = [];

    Artisan::call('migrate', ['--force' => true]);
    $out[] = 'migrate: ' . trim(Artisan::output());

    Artisan::call('config:cache');
    $out[] = 'config:cache: OK';

    Artisan::call('route:cache');
    $out[] = 'route:cache: OK';

    Artisan::call('view:cache');
    $out[] = 'view:cache: OK';

    return response(implode("\n", $out), 200)->header('Content-Type', 'text/plain');
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
