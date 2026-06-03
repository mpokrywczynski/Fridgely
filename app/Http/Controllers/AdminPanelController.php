<?php

namespace App\Http\Controllers;

use App\Models\CustomRecipe;
use App\Models\Family;
use App\Models\Product;
use App\Models\ShoppingListItem;
use App\Models\SupportMessage;
use App\Models\SupportReply;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class AdminPanelController extends Controller
{
    public function loginForm()
    {
        if (session('admin_auth')) return redirect()->route('admin.dashboard');
        return view('admin.login');
    }

    public function loginSubmit(Request $request)
    {
        $request->validate(['password' => 'required']);

        if ($request->password !== config('app.admin_password')) {
            return back()->withErrors(['password' => 'Nieprawidłowe hasło.']);
        }

        session(['admin_auth' => true]);
        return redirect()->route('admin.dashboard');
    }

    public function logout()
    {
        session()->forget('admin_auth');
        return redirect()->route('admin.login');
    }

    public function dashboard()
    {
        $now   = now();
        $week  = $now->copy()->subDays(7);
        $month = $now->copy()->subDays(30);

        $stats = [
            'users_total'        => User::count(),
            'users_today'        => User::whereDate('created_at', today())->count(),
            'users_week'         => User::where('created_at', '>=', $week)->count(),
            'users_month'        => User::where('created_at', '>=', $month)->count(),
            'active_7d'          => User::where('last_login_at', '>=', $week)->count(),
            'active_30d'         => User::where('last_login_at', '>=', $month)->count(),
            'premium_families'   => Family::where('is_premium', true)->count(),
            'total_families'     => Family::count(),
            'multi_families'     => Family::has('members', '>=', 2)->count(),
            'products_total'     => Product::count(),
            'recipes_total'      => CustomRecipe::count(),
            'shopping_total'     => ShoppingListItem::count(),
            'messages_unread'    => SupportMessage::where('is_read', false)->count(),
            'messages_total'     => SupportMessage::count(),
        ];

        // Chart: rejestracje per dzień przez ostatnie 30 dni
        $chartData = collect(range(29, 0))->map(function ($daysAgo) {
            $date = now()->subDays($daysAgo);
            return [
                'label' => $date->format('d.m'),
                'count' => User::whereDate('created_at', $date->format('Y-m-d'))->count(),
            ];
        });

        $recentUsers = User::with('family')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        $messages = SupportMessage::with(['user', 'replies'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return view('admin.dashboard', compact('stats', 'chartData', 'recentUsers', 'messages'));
    }

    public function users(Request $request)
    {
        $q = $request->get('q');

        $users = User::with('family')
            ->when($q, fn($query) => $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%");
            }))
            ->orderByDesc('created_at')
            ->paginate(20)
            ->withQueryString();

        return view('admin.users', compact('users', 'q'));
    }

    public function togglePremium(User $user)
    {
        $family = $user->family;
        if ($family) {
            $family->update(['is_premium' => !$family->is_premium]);
        }
        return back()->with('flash', 'Premium zaktualizowane dla: ' . $user->name);
    }

    public function markRead(SupportMessage $message)
    {
        $message->update(['is_read' => true]);
        return back();
    }

    public function reply(Request $request, SupportMessage $message)
    {
        $request->validate(['reply' => 'required|string|max:5000']);

        SupportReply::create([
            'support_message_id' => $message->id,
            'body'               => $request->reply,
            'is_admin'           => true,
        ]);

        $message->update(['is_read' => true, 'admin_reply' => $request->reply]);

        try {
            $user    = $message->user;
            $subject = $message->subject;
            $reply   = $request->reply;
            $body    = "Czesc {$user->name},\n\nOtrzymales/as odpowiedz na zgloszenie: {$subject}\n\nOdpowiedz:\n{$reply}\n\nMozesz odpowiedziec w zakladce Pomoc w aplikacji.\n\nZespol GetFridgely";
            Mail::raw(
                $body,
                fn($mail) => $mail
                    ->to($user->email, $user->name)
                    ->subject('Odpowiedz na Twoje zgloszenie - GetFridgely')
                    ->from(config('mail.from.address'), 'GetFridgely Support')
            );
        } catch (\Throwable $e) {}

        return back()->with('reply_sent', $message->id);
    }

    public function closeMessage(SupportMessage $message)
    {
        $message->update(['closed_at' => now(), 'is_read' => true]);
        return back()->with('flash', 'Zgłoszenie zamknięte.');
    }
}
