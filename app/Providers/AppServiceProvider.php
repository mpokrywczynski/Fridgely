<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Schema::defaultStringLength(191);

        ResetPassword::createUrlUsing(function ($user, string $token) {
            return config('app.url') . '?reset_token=' . $token . '&email=' . urlencode($user->email);
        });

        // Workaround dla WAMP — tylko lokalnie, na serwerze PHP ma własne certyfikaty.
        if ($this->app->environment('local')) {
            $cert = dirname(PHP_BINARY) . '/cacert.pem';
            if (@file_exists($cert)) {
                Http::globalOptions(['verify' => $cert]);
            }
        }
    }
}
