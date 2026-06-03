<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        if (!session('admin_auth')) {
            return redirect()->route('admin.login');
        }
        return $next($request);
    }
}
