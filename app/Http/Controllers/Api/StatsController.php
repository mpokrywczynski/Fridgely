<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FoodShare;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $familyId = $request->user()->family_id;

        $consumed = Product::where('family_id', $familyId)->where('is_consumed', true)->count();
        $wasted   = Product::where('family_id', $familyId)->where('is_wasted',   true)->count();
        $active   = Product::where('family_id', $familyId)->where('is_consumed', false)->where('is_wasted', false)->count();

        $familyUserIds = User::where('family_id', $familyId)->pluck('id');
        $shared = FoodShare::whereIn('user_id', $familyUserIds)->where('status', 'given')->count();

        // oddane sąsiadom = tak samo dobre jak zjedzone
        $total = $consumed + $shared + $wasted;
        $score = $total > 0 ? (int) round(($consumed + $shared) / $total * 100) : 100;
        $grade = $this->grade($score);

        $streakDays = $this->computeStreak($familyId);

        $moneySaved = (float) Product::where('family_id', $familyId)
            ->where('is_consumed', true)
            ->selectRaw('COALESCE(SUM(COALESCE(price, 0) * COALESCE(quantity, 1)), 0) as total')
            ->value('total');

        $moneyWasted = (float) Product::where('family_id', $familyId)
            ->where('is_wasted', true)
            ->selectRaw('COALESCE(SUM(COALESCE(price, 0) * COALESCE(quantity, 1)), 0) as total')
            ->value('total');

        return response()->json([
            'score'          => $score,
            'grade'          => $grade,
            'grade_color'    => $this->gradeColor($grade),
            'total_consumed' => $consumed,
            'total_wasted'   => $wasted,
            'total_shared'   => $shared,
            'total_active'   => $active,
            'streak_days'    => $streakDays,
            'money_saved'    => round($moneySaved, 2),
            'money_wasted'   => round($moneyWasted, 2),
            'co2'            => $this->co2Stats($consumed, $wasted, $shared),
            'top_wasted'     => $this->topWastedCategories($familyId),
            'mom'            => $this->monthOverMonth($familyId, $familyUserIds),
            'monthly'        => $this->monthlyBreakdown($familyId, $familyUserIds),
            'badges'         => $this->badges($consumed, $wasted, $score, $streakDays, $shared),
        ]);
    }

    private function grade(int $score): string
    {
        return match(true) {
            $score >= 90 => 'A',
            $score >= 75 => 'B',
            $score >= 60 => 'C',
            $score >= 40 => 'D',
            default      => 'F',
        };
    }

    private function gradeColor(string $grade): string
    {
        return match($grade) {
            'A' => '#2D6A4F',
            'B' => '#52B788',
            'C' => '#F4A261',
            'D' => '#E63946',
            default => '#9CA3AF',
        };
    }

    private function computeStreak(int $familyId): int
    {
        $lastWaste = Product::where('family_id', $familyId)
            ->where('is_wasted', true)
            ->max('wasted_at');

        if (!$lastWaste) {
            // Nigdy nic nie zmarnowano — streak od pierwszego produktu
            $firstProduct = Product::where('family_id', $familyId)->min('created_at');
            return $firstProduct ? (int) Carbon::parse($firstProduct)->diffInDays(now()) : 0;
        }

        return (int) Carbon::parse($lastWaste)->diffInDays(now());
    }

    private function co2Stats(int $consumed, int $wasted, int $shared): array
    {
        // ~0.5 kg CO2e per food item (FAO average across categories)
        $perItem = 0.5;
        return [
            'saved'  => round(($consumed + $shared) * $perItem, 1),
            'wasted' => round($wasted * $perItem, 1),
            'net'    => round(($consumed + $shared - $wasted) * $perItem, 1),
        ];
    }

    private function topWastedCategories(int $familyId): array
    {
        return Product::where('family_id', $familyId)
            ->where('is_wasted', true)
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->selectRaw('category, COUNT(*) as count')
            ->groupBy('category')
            ->orderByDesc('count')
            ->limit(6)
            ->get()
            ->map(fn($r) => ['category' => $r->category, 'count' => (int) $r->count])
            ->toArray();
    }

    private function monthOverMonth(int $familyId, $familyUserIds): array
    {
        $curStart  = now()->startOfMonth();
        $curEnd    = now();
        $prevStart = now()->subMonth()->startOfMonth();
        $prevEnd   = now()->subMonth()->endOfMonth();

        $cur  = $this->periodCounts($familyId, $familyUserIds, $curStart,  $curEnd);
        $prev = $this->periodCounts($familyId, $familyUserIds, $prevStart, $prevEnd);

        $change = fn(int $c, int $p) => $p > 0 ? (int) round(($c - $p) / $p * 100) : ($c > 0 ? 100 : 0);

        return [
            'consumed' => ['cur' => $cur['consumed'], 'prev' => $prev['consumed'], 'pct' => $change($cur['consumed'], $prev['consumed'])],
            'wasted'   => ['cur' => $cur['wasted'],   'prev' => $prev['wasted'],   'pct' => $change($cur['wasted'],   $prev['wasted'])],
            'shared'   => ['cur' => $cur['shared'],   'prev' => $prev['shared'],   'pct' => $change($cur['shared'],   $prev['shared'])],
        ];
    }

    private function periodCounts(int $familyId, $familyUserIds, $start, $end): array
    {
        return [
            'consumed' => Product::where('family_id', $familyId)->where('is_consumed', true)->whereBetween('consumed_at', [$start, $end])->count(),
            'wasted'   => Product::where('family_id', $familyId)->where('is_wasted',   true)->whereBetween('wasted_at',   [$start, $end])->count(),
            'shared'   => FoodShare::whereIn('user_id', $familyUserIds)->where('status', 'given')->whereBetween('updated_at', [$start, $end])->count(),
        ];
    }

    private function monthlyBreakdown(int $familyId, $familyUserIds): array
    {
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $date  = now()->subMonths($i);
            $start = $date->copy()->startOfMonth();
            $end   = $date->copy()->endOfMonth();

            $consumed = Product::where('family_id', $familyId)
                ->where('is_consumed', true)
                ->whereBetween('consumed_at', [$start, $end])
                ->count();

            $wasted = Product::where('family_id', $familyId)
                ->where('is_wasted', true)
                ->whereBetween('wasted_at', [$start, $end])
                ->count();

            $shared = FoodShare::whereIn('user_id', $familyUserIds)
                ->where('status', 'given')
                ->whereBetween('updated_at', [$start, $end])
                ->count();

            $months[] = [
                'month'    => $date->format('Y-m'),
                'label'    => $date->locale('pl')->isoFormat('MMM'),
                'consumed' => $consumed,
                'wasted'   => $wasted,
                'shared'   => $shared,
            ];
        }
        return $months;
    }

    private function badges(int $consumed, int $wasted, int $score, int $streak, int $shared = 0): array
    {
        return [
            // ── Pierwsze kroki ────────────────────────────────────
            [
                'id'     => 'first_step',
                'icon'   => '🌱',
                'name'   => 'Pierwszy krok',
                'desc'   => 'Zużyj swój pierwszy produkt',
                'earned' => $consumed >= 1,
            ],
            [
                'id'     => 'ten_products',
                'icon'   => '✅',
                'name'   => 'Aktywna rodzina',
                'desc'   => 'Zużyj 10 produktów',
                'earned' => $consumed >= 10,
            ],
            [
                'id'     => 'fifty_products',
                'icon'   => '🏆',
                'name'   => 'Ekspert lodówki',
                'desc'   => 'Zużyj 50 produktów',
                'earned' => $consumed >= 50,
            ],
            [
                'id'     => 'hundred_products',
                'icon'   => '🥇',
                'name'   => 'Mistrz kuchni',
                'desc'   => 'Zużyj 100 produktów',
                'earned' => $consumed >= 100,
            ],
            [
                'id'     => 'twohundred_products',
                'icon'   => '👑',
                'name'   => 'Legenda lodówki',
                'desc'   => 'Zużyj 200 produktów',
                'earned' => $consumed >= 200,
            ],
            // ── Seria bez marnowania ──────────────────────────────
            [
                'id'     => 'streak_3',
                'icon'   => '🔥',
                'name'   => 'Rozgrzewka',
                'desc'   => '3 dni bez wyrzucania',
                'earned' => $streak >= 3,
            ],
            [
                'id'     => 'no_waste_week',
                'icon'   => '🎯',
                'name'   => 'Tydzień bez marnowania',
                'desc'   => '7 dni bez wyrzucania',
                'earned' => $streak >= 7,
            ],
            [
                'id'     => 'no_waste_month',
                'icon'   => '🌍',
                'name'   => 'Miesiąc bez marnowania',
                'desc'   => '30 dni bez wyrzucania',
                'earned' => $streak >= 30,
            ],
            [
                'id'     => 'streak_90',
                'icon'   => '🌿',
                'name'   => 'Eko-wojownik',
                'desc'   => '90 dni bez wyrzucania',
                'earned' => $streak >= 90,
            ],
            // ── Zero-Waste Score ──────────────────────────────────
            [
                'id'     => 'grade_b',
                'icon'   => '📈',
                'name'   => 'Na dobrej drodze',
                'desc'   => 'Osiągnij ocenę B (75%+)',
                'earned' => $score >= 75,
            ],
            [
                'id'     => 'zero_waste_hero',
                'icon'   => '⭐',
                'name'   => 'Zero-Waste Hero',
                'desc'   => 'Osiągnij ocenę A (90%+)',
                'earned' => $score >= 90,
            ],
            [
                'id'     => 'no_waste',
                'icon'   => '✨',
                'name'   => 'Czyste konto',
                'desc'   => 'Ocena A i zero strat przy 20+ zużytych',
                'earned' => $score >= 90 && $wasted === 0 && $consumed >= 20,
            ],
            // ── Specjalne ─────────────────────────────────────────
            [
                'id'     => 'perfect_start',
                'icon'   => '💎',
                'name'   => 'Bezbłędny start',
                'desc'   => 'Zużyj 5 produktów bez żadnej straty',
                'earned' => $wasted === 0 && $consumed >= 5,
            ],
            // ── Foodsharing ───────────────────────────────────────
            [
                'id'     => 'first_share',
                'icon'   => '🤝',
                'name'   => 'Dobry sąsiad',
                'desc'   => 'Oddaj pierwszy produkt sąsiadom',
                'earned' => $shared >= 1,
            ],
            [
                'id'     => 'five_shares',
                'icon'   => '🌱',
                'name'   => 'Foodsharing Fan',
                'desc'   => 'Oddaj 5 produktów sąsiadom',
                'earned' => $shared >= 5,
            ],
            [
                'id'     => 'ten_shares',
                'icon'   => '🌍',
                'name'   => 'Eko-społeczność',
                'desc'   => 'Oddaj 10 produktów sąsiadom',
                'earned' => $shared >= 10,
            ],
        ];
    }
}
