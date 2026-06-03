<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Użytkownicy — Admin GetFridgely</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f3f4f6; color: #111; font-size: 14px; }

.nav { background: #16a34a; color: #fff; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 10; }
.nav__logo { font-weight: 700; font-size: 16px; }
.nav__links { display: flex; gap: 4px; }
.nav__links a { color: rgba(255,255,255,.8); padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; }
.nav__links a:hover, .nav__links a.active { background: rgba(255,255,255,.2); color: #fff; }
.nav__right form button { background: rgba(255,255,255,.2); border: none; color: #fff; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }

.wrap { max-width: 1280px; margin: 0 auto; padding: 24px 16px; }

.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.toolbar h1 { font-size: 18px; font-weight: 700; }
.search-form { display: flex; gap: 8px; margin-left: auto; }
.search-form input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; width: 240px; outline: none; }
.search-form input:focus { border-color: #4ade80; }
.search-form button { padding: 8px 16px; background: #16a34a; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }

.flash { background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }

.section { background: #fff; border-radius: 10px; border: 1px solid #e5e7eb; overflow: hidden; }

table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
th { font-weight: 600; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; background: #fafafa; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #f9fafb; }

.btn { display: inline-block; padding: 5px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; }
.btn-read    { background: #f3f4f6; color: #374151; }
.btn-read:hover { background: #e5e7eb; }
.btn-primary { background: #16a34a; color: #fff; }
.btn-primary:hover { background: #15803d; }

.pagination { display: flex; gap: 4px; margin-top: 16px; justify-content: center; flex-wrap: wrap; }
.pagination a, .pagination span { padding: 6px 12px; border-radius: 6px; font-size: 13px; border: 1px solid #e5e7eb; background: #fff; color: #374151; text-decoration: none; }
.pagination a:hover { background: #f3f4f6; }
.pagination .active-page { background: #16a34a; color: #fff; border-color: #16a34a; font-weight: 600; }
.pagination .dots { border: none; background: none; color: #9ca3af; }

.empty { padding: 40px; text-align: center; color: #9ca3af; font-size: 13px; }
.count-info { font-size: 13px; color: #6b7280; margin-bottom: 12px; }
</style>
</head>
<body>

<nav class="nav">
    <div style="display:flex;align-items:center;gap:20px">
        <div class="nav__logo">🧊 GetFridgely</div>
        <div class="nav__links">
            <a href="{{ route('admin.dashboard') }}">Dashboard</a>
            <a href="{{ route('admin.users') }}" class="active">Użytkownicy</a>
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

<div class="toolbar">
    <h1>👤 Użytkownicy <span style="color:#9ca3af;font-weight:400;font-size:15px">({{ $users->total() }})</span></h1>
    <form class="search-form" method="GET" action="{{ route('admin.users') }}">
        <input type="text" name="q" value="{{ $q }}" placeholder="Szukaj po nazwie lub emailu…" />
        <button type="submit">Szukaj</button>
        @if($q) <a href="{{ route('admin.users') }}" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;color:#374151;text-decoration:none">✕ Wyczyść</a> @endif
    </form>
</div>

<div class="section">
    @if($users->isEmpty())
        <div class="empty">Brak użytkowników{{ $q ? ' pasujących do „'.$q.'"' : '' }}.</div>
    @else
    <table>
        <thead><tr>
            <th>#</th>
            <th>Imię / Email</th>
            <th>Rodzina</th>
            <th>Rola</th>
            <th>Premium</th>
            <th>Ostatnie logowanie</th>
            <th>Rejestracja</th>
            <th>Akcje</th>
        </tr></thead>
        <tbody>
        @foreach($users as $u)
        <tr>
            <td style="color:#9ca3af">{{ $u->id }}</td>
            <td>
                <div style="font-weight:600">{{ $u->name }}</div>
                <div style="color:#6b7280;font-size:12px">{{ $u->email }}</div>
            </td>
            <td>
                @if($u->family)
                    <div>{{ $u->family->name }}</div>
                    <div style="font-size:11px;color:#9ca3af">kod: {{ $u->family->invite_code }}</div>
                @else
                    <span style="color:#9ca3af">—</span>
                @endif
            </td>
            <td>
                <span style="font-size:11px;background:#f3f4f6;padding:2px 8px;border-radius:99px;font-weight:600">
                    {{ $u->role ?? 'member' }}
                </span>
            </td>
            <td>
                @if($u->family?->is_premium)
                    <span style="color:#16a34a;font-weight:700">⭐ Premium</span>
                @else
                    <span style="color:#9ca3af">Darmowy</span>
                @endif
            </td>
            <td style="font-size:12px">
                {{ $u->last_login_at ? $u->last_login_at->diffForHumans() : '—' }}
            </td>
            <td style="font-size:12px;white-space:nowrap">
                {{ $u->created_at->format('d.m.Y') }}
            </td>
            <td>
                @if($u->family)
                <form method="POST" action="{{ route('admin.users.toggle-premium', $u) }}">
                    @csrf
                    <button class="btn {{ $u->family->is_premium ? 'btn-read' : 'btn-primary' }}" title="{{ $u->family->is_premium ? 'Wyłącz Premium dla rodziny' : 'Włącz Premium dla rodziny' }}">
                        {{ $u->family->is_premium ? '✕ Wyłącz' : '⭐ Włącz' }}
                    </button>
                </form>
                @endif
            </td>
        </tr>
        @endforeach
        </tbody>
    </table>

    {{-- Pagination --}}
    @if($users->hasPages())
    <div style="padding:16px 20px;border-top:1px solid #f3f4f6">
        <div class="pagination">
            @if($users->onFirstPage())
                <span style="opacity:.4">‹ Poprzednia</span>
            @else
                <a href="{{ $users->previousPageUrl() }}">‹ Poprzednia</a>
            @endif

            @foreach($users->getUrlRange(1, $users->lastPage()) as $page => $url)
                @if($page == $users->currentPage())
                    <span class="active-page">{{ $page }}</span>
                @elseif(abs($page - $users->currentPage()) <= 2 || $page == 1 || $page == $users->lastPage())
                    <a href="{{ $url }}">{{ $page }}</a>
                @elseif(abs($page - $users->currentPage()) == 3)
                    <span class="dots">…</span>
                @endif
            @endforeach

            @if($users->hasMorePages())
                <a href="{{ $users->nextPageUrl() }}">Następna ›</a>
            @else
                <span style="opacity:.4">Następna ›</span>
            @endif
        </div>
    </div>
    @endif

    @endif
</div>

</div>
</body>
</html>
