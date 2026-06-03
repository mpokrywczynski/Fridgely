<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Panel — GetFridgely</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f3f4f6; color: #111; font-size: 14px; }

.nav { background: #16a34a; color: #fff; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 10; }
.nav__logo { font-weight: 700; font-size: 16px; }
.nav__links { display: flex; gap: 4px; }
.nav__links a { color: rgba(255,255,255,.8); padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; }
.nav__links a:hover, .nav__links a.active { background: rgba(255,255,255,.2); color: #fff; }
.nav__right { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.nav__right form button { background: rgba(255,255,255,.2); border: none; color: #fff; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.nav__right form button:hover { background: rgba(255,255,255,.35); }

.wrap { max-width: 1280px; margin: 0 auto; padding: 24px 16px; }

.flash { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; padding: 10px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }

.section-title { font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; margin: 28px 0 12px; }

/* Stats grid */
.stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.stat { background: #fff; border-radius: 10px; padding: 14px 18px; border: 1px solid #e5e7eb; }
.stat__val { font-size: 26px; font-weight: 800; line-height: 1.1; margin-bottom: 3px; }
.stat__lbl { font-size: 11px; color: #6b7280; }
.stat--green .stat__val { color: #16a34a; }
.stat--amber .stat__val { color: #d97706; }
.stat--blue  .stat__val { color: #2563eb; }
.stat--red   .stat__val { color: #dc2626; }

/* Chart */
.chart-wrap { background: #fff; border-radius: 10px; border: 1px solid #e5e7eb; padding: 20px 20px 12px; }
.chart-bars { display: flex; align-items: flex-end; height: 80px; gap: 3px; }
.chart-bar { flex: 1; background: #bbf7d0; border-radius: 3px 3px 0 0; min-height: 2px; position: relative; transition: background .15s; }
.chart-bar:hover { background: #16a34a; }
.chart-bar:hover .chart-bar__tip { display: block; }
.chart-bar__tip { display: none; position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); background: #111; color: #fff; font-size: 11px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; z-index: 5; }
.chart-labels { display: flex; gap: 3px; margin-top: 4px; }
.chart-label { flex: 1; font-size: 9px; color: #9ca3af; text-align: center; overflow: hidden; }

/* Section card */
.section { background: #fff; border-radius: 10px; border: 1px solid #e5e7eb; overflow: hidden; }
.section__hdr { padding: 14px 20px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.section__hdr a { font-size: 12px; font-weight: 500; color: #2563eb; }
.badge-count { background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 99px; }

table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
th { font-weight: 600; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; background: #fafafa; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #f9fafb; }

.msg-row--unread td { background: #f0fdf4; }
.msg-body { color: #4b5563; white-space: pre-wrap; word-break: break-word; }
.msg-reply { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 8px 12px; margin-top: 6px; border-radius: 0 6px 6px 0; font-size: 12px; color: #1e40af; }

.btn { display: inline-block; padding: 5px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; }
.btn-read    { background: #f3f4f6; color: #374151; }
.btn-read:hover { background: #e5e7eb; }
.btn-primary { background: #16a34a; color: #fff; }
.btn-primary:hover { background: #15803d; }

.reply-form { padding: 12px 16px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
.reply-form textarea { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; resize: vertical; min-height: 80px; font-family: inherit; }
.reply-form textarea:focus { outline: none; border-color: #4ade80; }
.reply-form .row { display: flex; gap: 8px; margin-top: 8px; }

.empty { padding: 32px; text-align: center; color: #9ca3af; font-size: 13px; }
</style>
</head>
<body>

<nav class="nav">
    <div style="display:flex;align-items:center;gap:20px">
        <div class="nav__logo">🧊 GetFridgely</div>
        <div class="nav__links">
            <a href="{{ route('admin.dashboard') }}" class="active">Dashboard</a>
            <a href="{{ route('admin.users') }}">Użytkownicy</a>
        </div>
    </div>
    <div class="nav__right">
        <form method="POST" action="{{ route('admin.logout') }}">@csrf <button>Wyloguj</button></form>
    </div>
</nav>

<div class="wrap">

@if(session('flash'))
    <div class="flash">{{ session('flash') }}</div>
@endif

{{-- ── Użytkownicy ── --}}
<div class="section-title">👤 Użytkownicy</div>
<div class="stats">
    <div class="stat stat--blue">
        <div class="stat__val">{{ $stats['users_total'] }}</div>
        <div class="stat__lbl">Łącznie</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['users_today'] }}</div>
        <div class="stat__lbl">Dziś</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['users_week'] }}</div>
        <div class="stat__lbl">Ostatnie 7 dni</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['users_month'] }}</div>
        <div class="stat__lbl">Ostatnie 30 dni</div>
    </div>
    <div class="stat stat--green">
        <div class="stat__val">{{ $stats['active_7d'] }}</div>
        <div class="stat__lbl">Aktywni 7 dni</div>
    </div>
    <div class="stat stat--green">
        <div class="stat__val">{{ $stats['active_30d'] }}</div>
        <div class="stat__lbl">Aktywni 30 dni</div>
    </div>
</div>

{{-- ── Wykres rejestracji ── --}}
<div class="section-title">📈 Rejestracje — ostatnie 30 dni</div>
<div class="chart-wrap">
    @php $maxCount = $chartData->max('count') ?: 1; @endphp
    <div class="chart-bars">
        @foreach($chartData as $day)
        @php $h = max(2, round(($day['count'] / $maxCount) * 80)); @endphp
        <div class="chart-bar" style="height:{{ $h }}px">
            <span class="chart-bar__tip">{{ $day['label'] }}: {{ $day['count'] }}</span>
        </div>
        @endforeach
    </div>
    <div class="chart-labels">
        @foreach($chartData as $i => $day)
        <div class="chart-label">{{ $i % 5 === 0 ? $day['label'] : '' }}</div>
        @endforeach
    </div>
</div>

{{-- ── Rodziny i użycie ── --}}
<div class="section-title">🏠 Rodziny &amp; użycie</div>
<div class="stats">
    <div class="stat stat--amber">
        <div class="stat__val">{{ $stats['premium_families'] }}</div>
        <div class="stat__lbl">Rodziny Premium</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['total_families'] }}</div>
        <div class="stat__lbl">Rodziny łącznie</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['multi_families'] }}</div>
        <div class="stat__lbl">Rodziny wieloosobowe</div>
    </div>
    <div class="stat stat--blue">
        <div class="stat__val">{{ $stats['products_total'] }}</div>
        <div class="stat__lbl">Produkty w lodówkach</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['recipes_total'] }}</div>
        <div class="stat__lbl">Własne przepisy</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['shopping_total'] }}</div>
        <div class="stat__lbl">Pozycje na listach zakupów</div>
    </div>
    <div class="stat {{ $stats['messages_unread'] > 0 ? 'stat--red' : '' }}">
        <div class="stat__val">{{ $stats['messages_unread'] }}</div>
        <div class="stat__lbl">Support nieodpowiedziany</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['messages_total'] }}</div>
        <div class="stat__lbl">Support łącznie</div>
    </div>
</div>

{{-- ── Foodsharing ── --}}
<div class="section-title">🤝 Foodsharing — Oddam Jedzenie</div>
<div class="stats">
    <div class="stat stat--green">
        <div class="stat__val">{{ $stats['shares_given'] }}</div>
        <div class="stat__lbl">Produkty oddane łącznie</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['shares_week'] }}</div>
        <div class="stat__lbl">Oddane w ostatnich 7 dniach</div>
    </div>
    <div class="stat stat--blue">
        <div class="stat__val">{{ $stats['shares_active'] }}</div>
        <div class="stat__lbl">Aktywne ogłoszenia</div>
    </div>
    <div class="stat">
        <div class="stat__val">{{ $stats['shares_total'] }}</div>
        <div class="stat__lbl">Ogłoszenia łącznie</div>
    </div>
</div>

<div class="section" style="margin-top:12px">
    <div class="section__hdr">Ostatnie ogłoszenia</div>
    @if($recentShares->isEmpty())
        <div class="empty">Brak ogłoszeń.</div>
    @else
    <table>
        <thead><tr>
            <th>Produkt</th><th>Użytkownik</th><th>Status</th><th>Data</th>
        </tr></thead>
        <tbody>
        @foreach($recentShares as $share)
        @php
            $statusLabel = ['available' => '✅ Dostępne', 'reserved' => '⏳ Zarezerwowane', 'given' => '✓ Oddano', 'cancelled' => '✗ Anulowane'][$share->status] ?? $share->status;
            $statusColor = ['available' => '#16a34a', 'reserved' => '#d97706', 'given' => '#6b7280', 'cancelled' => '#dc2626'][$share->status] ?? '#6b7280';
        @endphp
        <tr>
            <td style="font-weight:600">{{ $share->name }}</td>
            <td>{{ $share->user->name ?? '—' }}</td>
            <td><span style="color:{{ $statusColor }};font-weight:600;font-size:12px">{{ $statusLabel }}</span></td>
            <td style="color:#6b7280;font-size:12px">{{ $share->created_at->format('d.m.Y H:i') }}</td>
        </tr>
        @endforeach
        </tbody>
    </table>
    @endif
</div>

{{-- ── Ostatnio zarejestrowani ── --}}
<div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
    <span>👤 Ostatnio zarejestrowani</span>
    <a href="{{ route('admin.users') }}" style="font-size:12px;color:#2563eb">Zobacz wszystkich →</a>
</div>
<div class="section">
    @if($recentUsers->isEmpty())
        <div class="empty">Brak użytkowników.</div>
    @else
    <table>
        <thead><tr>
            <th>Imię / Email</th><th>Rodzina</th><th>Premium</th><th>Ostatnie logowanie</th><th>Rejestracja</th><th></th>
        </tr></thead>
        <tbody>
        @foreach($recentUsers as $u)
        <tr>
            <td>
                <div style="font-weight:600">{{ $u->name }}</div>
                <div style="color:#6b7280;font-size:12px">{{ $u->email }}</div>
            </td>
            <td>{{ $u->family?->name ?? '—' }}</td>
            <td>
                @if($u->family?->is_premium)
                    <span style="color:#16a34a;font-weight:600">⭐ Tak</span>
                @else
                    <span style="color:#9ca3af">Nie</span>
                @endif
            </td>
            <td>{{ $u->last_login_at ? $u->last_login_at->diffForHumans() : '—' }}</td>
            <td>{{ $u->created_at->format('d.m.Y H:i') }}</td>
            <td>
                @if($u->family)
                <form method="POST" action="{{ route('admin.users.toggle-premium', $u) }}">
                    @csrf
                    <button class="btn {{ $u->family->is_premium ? 'btn-read' : 'btn-primary' }}">
                        {{ $u->family->is_premium ? '✕ Wyłącz Premium' : '⭐ Włącz Premium' }}
                    </button>
                </form>
                @endif
            </td>
        </tr>
        @endforeach
        </tbody>
    </table>
    @endif
</div>

{{-- ── Support ── --}}
<div class="section-title">
    💬 Zgłoszenia support
    @if($stats['messages_unread'] > 0)
        <span class="badge-count">{{ $stats['messages_unread'] }}</span>
    @endif
</div>

@if($messages->isEmpty())
    <div class="section"><div class="empty">Brak zgłoszeń.</div></div>
@else
@foreach($messages as $msg)
@php
    $allReplies = collect();
    if ($msg->admin_reply && $msg->replies->where('is_admin', true)->isEmpty()) {
        $allReplies->push((object)['body' => $msg->admin_reply, 'is_admin' => true, 'created_at' => $msg->updated_at]);
    }
    $allReplies = $allReplies->concat($msg->replies)->sortBy('created_at');
    $isClosed = !!$msg->closed_at;
@endphp
<div class="section" style="margin-bottom:12px;{{ !$msg->is_read && !$isClosed ? 'border-color:#4ade80' : '' }}">

    {{-- Header --}}
    <div style="padding:12px 16px;background:#fafafa;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-bottom:1px solid #f3f4f6">
        <div>
            <span style="font-weight:700">{{ $msg->subject }}</span>
            <span style="color:#9ca3af;font-size:12px;margin-left:8px">{{ $msg->user->name }} &lt;{{ $msg->user->email }}&gt;</span>
            <span style="color:#9ca3af;font-size:12px;margin-left:8px">{{ $msg->created_at->format('d.m.Y H:i') }}</span>
        </div>
        @if($isClosed)
            <span style="font-size:11px;background:#f3f4f6;color:#6b7280;padding:2px 9px;border-radius:99px;font-weight:600">✓ Zamknięte {{ $msg->closed_at->format('d.m.Y') }}</span>
        @elseif(!$msg->is_read)
            <span style="font-size:11px;background:#fef3c7;color:#d97706;padding:2px 9px;border-radius:99px;font-weight:600">● Nowe</span>
        @endif
    </div>

    {{-- Oryginalna wiadomość --}}
    <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6">
        <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">👤 {{ $msg->user->name }}</div>
        <div class="msg-body">{{ $msg->message }}</div>
    </div>

    {{-- Wątek --}}
    @foreach($allReplies as $r)
    <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;background:{{ $r->is_admin ? '#f0fdf4' : '#f8fafc' }};border-left:3px solid {{ $r->is_admin ? '#16a34a' : '#94a3b8' }}">
        <div style="font-size:11px;font-weight:600;color:{{ $r->is_admin ? '#16a34a' : '#64748b' }};margin-bottom:4px">
            {{ $r->is_admin ? '💬 GetFridgely Support' : '👤 '.$msg->user->name }}
            · {{ \Carbon\Carbon::parse($r->created_at)->format('d.m.Y H:i') }}
        </div>
        <div class="msg-body">{{ $r->body }}</div>
    </div>
    @endforeach

    {{-- Akcje --}}
    @if(!$isClosed)
    <div style="padding:10px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        @if(!$msg->is_read)
        <form method="POST" action="{{ route('admin.messages.read', $msg) }}">
            @csrf <button class="btn btn-read">✓ Przeczytane</button>
        </form>
        @endif
        <button class="btn btn-primary" onclick="toggleReply({{ $msg->id }})">✉️ Odpowiedz</button>
        <form method="POST" action="{{ route('admin.messages.close', $msg) }}" style="display:inline"
              onsubmit="return confirm('Zamknąć tę sprawę?')">
            @csrf <button class="btn btn-read">✓ Zamknij sprawę</button>
        </form>
    </div>
    <div id="reply-row-{{ $msg->id }}" style="display:none;padding:0 16px 14px">
        <form method="POST" action="{{ route('admin.messages.reply', $msg) }}">
            @csrf
            <textarea name="reply" placeholder="Wpisz odpowiedź…"
                style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;resize:vertical;min-height:80px;font-family:inherit;margin-bottom:8px"></textarea>
            <div style="display:flex;gap:8px">
                <button type="submit" class="btn btn-primary">Wyślij odpowiedź</button>
                <button type="button" class="btn btn-read" onclick="toggleReply({{ $msg->id }})">Anuluj</button>
            </div>
        </form>
    </div>
    @else
    <div style="padding:10px 16px;font-size:12px;color:#9ca3af">
        Zostanie automatycznie usunięte po 7 dniach od zamknięcia.
    </div>
    @endif

</div>
@endforeach
@endif

</div>

<script>
function toggleReply(id) {
    const row = document.getElementById('reply-row-' + id);
    row.style.display = row.style.display === 'none' ? '' : 'none';
}
</script>
</body>
</html>
