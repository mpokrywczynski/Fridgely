<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DeepLService;
use App\Services\IngredientTranslator;
use App\Services\SpoonacularService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class RecipeController extends Controller
{
    public function __construct(
        private SpoonacularService  $spoonacular,
        private IngredientTranslator $translator,
        private DeepLService         $deepl,
    ) {}

    // GET /api/recipes/suggest
    public function suggest(Request $request)
    {
        if (!$this->spoonacular->isConfigured()) {
            return response()->json(['message' => 'not_configured'], 503);
        }

        $user   = $request->user();
        $family = $user->family;

        $products = $family->products()
            ->where('is_consumed', false)
            ->pluck('name')
            ->toArray();

        if (empty($products)) {
            return response()->json(['recipes' => [], 'ingredients_count' => 0]);
        }

        // Dzienny limit odświeżeń: 1 dla free, 10 dla premium
        $refreshLimit = $family->is_premium ? 10 : 1;
        $refreshKey   = 'recipe_daily.' . $family->id . '.' . now()->toDateString();
        $refreshUsed  = Cache::get($refreshKey, 0);

        if ($refreshUsed >= $refreshLimit) {
            $customRecipes = $this->buildCustomRecipes($user, $products);
            return response()->json([
                'recipes'           => $customRecipes,
                'ingredients_count' => count($products),
                'daily_limit'       => true,
                'refreshes_used'    => $refreshUsed,
                'refreshes_limit'   => $refreshLimit,
                'is_premium'        => $family->is_premium,
            ]);
        }

        $englishIngredients = $this->translator->translateAll($products);

        try {
            $recipes = $this->spoonacular->findByIngredients($englishIngredients);
        } catch (\RuntimeException $e) {
            if ($e->getMessage() === 'quota_exceeded') {
                $customRecipes = $this->buildCustomRecipes($user, $products);
                return response()->json([
                    'recipes'           => $customRecipes,
                    'ingredients_count' => count($products),
                    'quota_exceeded'    => true,
                    'refreshes_used'    => $refreshUsed,
                    'refreshes_limit'   => $refreshLimit,
                    'is_premium'        => $family->is_premium,
                ]);
            }
            return response()->json(['message' => $e->getMessage()], 502);
        }

        // Inkrementuj licznik po udanym pobraniu
        $ttl = (int) now()->endOfDay()->diffInSeconds(now()) + 1;
        Cache::put($refreshKey, $refreshUsed + 1, $ttl);

        // Odfiltruj fałszywe "brakuje" — Spoonacular nie zawsze dopasowuje synonimów
        // (np. "pepper" vs "black pepper"). Sprawdzamy angielskie nazwy przed tłumaczeniem.
        $userIngLower = array_map('strtolower', $englishIngredients);
        $recipes = array_map(function (array $r) use ($userIngLower) {
            $filtered = array_values(array_filter(
                $r['missedIngredients'] ?? [],
                function (array $ing) use ($userIngLower) {
                    $missing = strtolower($ing['name'] ?? '');
                    foreach ($userIngLower as $have) {
                        if ($have !== '' && (str_contains($missing, $have) || str_contains($have, $missing))) {
                            return false;
                        }
                    }
                    return true;
                }
            ));
            $r['missedIngredients']     = $filtered;
            $r['missedIngredientCount'] = count($filtered);
            return $r;
        }, $recipes);

        // Zbierz wszystkie teksty do przetłumaczenia w jednym batch call
        $textsToTranslate = [];
        foreach ($recipes as $r) {
            $textsToTranslate[] = $r['title'] ?? '';
            foreach ($r['missedIngredients'] ?? [] as $ing) {
                $textsToTranslate[] = $ing['name'] ?? '';
            }
        }
        $translations = $this->deepl->translateBatch(array_filter(array_unique($textsToTranslate)));

        $enriched = collect($recipes)->map(function (array $r) use ($translations) {
            $used  = $r['usedIngredientCount'] ?? 0;
            $total = $used + ($r['missedIngredientCount'] ?? 0);
            $r['match_pct'] = $total > 0 ? (int) round($used / $total * 100) : 0;

            $r['title'] = $translations[$r['title']] ?? $r['title'];

            if (!empty($r['missedIngredients'])) {
                $r['missedIngredients'] = array_map(function (array $ing) use ($translations) {
                    $ing['name'] = $translations[$ing['name']] ?? $this->translator->translateBack($ing['name']);
                    return $ing;
                }, $r['missedIngredients']);
            }

            $r['source'] = 'spoonacular';
            return $r;
        })->sortByDesc('match_pct')->values()->toArray();

        // Własne przepisy rodziny — zawsze na górze listy
        $customRecipes = $this->buildCustomRecipes($user, $products);

        return response()->json([
            'recipes'           => array_merge($customRecipes, $enriched),
            'ingredients_count' => count($products),
            'refreshes_used'    => $refreshUsed + 1,
            'refreshes_limit'   => $refreshLimit,
            'is_premium'        => $family->is_premium,
        ]);
    }

    // Oblicz dopasowanie własnych przepisów do zawartości lodówki
    private function buildCustomRecipes(User $user, array $polishFridgeItems): array
    {
        $recipes = $user->family->customRecipes()->with('ingredients')->get();
        if ($recipes->isEmpty()) return [];

        $fridgeLower = array_map(fn($n) => mb_strtolower($n, 'UTF-8'), $polishFridgeItems);

        return $recipes->map(function ($cr) use ($fridgeLower) {
            $used   = 0;
            $missed = [];

            foreach ($cr->ingredients as $ing) {
                $ingLower = mb_strtolower($ing->name, 'UTF-8');
                $found = false;
                foreach ($fridgeLower as $f) {
                    if ($f !== '' && (str_contains($ingLower, $f) || str_contains($f, $ingLower))) {
                        $found = true;
                        break;
                    }
                }
                if ($found) {
                    $used++;
                } else {
                    $missed[] = [
                        'name'   => $ing->name,
                        'amount' => $ing->amount,
                        'unit'   => $ing->unit ?? '',
                    ];
                }
            }

            $total    = $used + count($missed);
            $matchPct = $total > 0 ? (int) round($used / $total * 100) : 100;

            return [
                'id'                   => $cr->id,
                'title'                => $cr->title,
                'image'                => $cr->image_url,
                'usedIngredientCount'  => $used,
                'missedIngredientCount'=> count($missed),
                'missedIngredients'    => $missed,
                'match_pct'            => $matchPct,
                'source'               => 'custom',
            ];
        })->sortByDesc('match_pct')->values()->toArray();
    }

    // GET /api/recipes/{id}
    public function show(Request $request, int $id)
    {
        if (!$this->spoonacular->isConfigured()) {
            return response()->json(['message' => 'not_configured'], 503);
        }

        try {
            $recipe = $this->spoonacular->getInfo($id);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        // Zbierz wszystkie teksty z detali przepisu do batch tłumaczenia
        $textsToTranslate = array_filter([
            $recipe['title'] ?? '',
        ]);
        foreach ($recipe['extendedIngredients'] ?? [] as $ing) {
            if (!empty($ing['name']))         $textsToTranslate[] = $ing['name'];
            if (!empty($ing['originalName'])) $textsToTranslate[] = $ing['originalName'];
            // Jednostki metryczne/konwertowalne i słownikowe nie trafiają do API.
            if (!empty($ing['unit'])) {
                $amt = (float)($ing['amount'] ?? 0);
                if (
                    $this->translator->convertToMetric($ing['unit'], $amt) === null &&
                    $this->translator->declineUnit($ing['unit'], $amt) === null
                ) {
                    $textsToTranslate[] = $ing['unit'];
                }
            }
        }
        foreach ($recipe['analyzedInstructions'][0]['steps'] ?? [] as $step) {
            if (!empty($step['step'])) $textsToTranslate[] = $step['step'];
        }
        if (!empty($recipe['instructions'])) {
            $textsToTranslate[] = strip_tags($recipe['instructions']);
        }

        $translations = $this->deepl->translateBatch(array_unique($textsToTranslate));

        // Podstaw tłumaczenia
        if (isset($recipe['title'])) {
            $recipe['title'] = $translations[$recipe['title']] ?? $recipe['title'];
        }

        if (!empty($recipe['extendedIngredients'])) {
            $recipe['extendedIngredients'] = array_map(function (array $ing) use ($translations) {
                if (!empty($ing['name'])) {
                    $ing['name'] = $translations[$ing['name']] ?? $ing['name'];
                }
                if (!empty($ing['originalName'])) {
                    $ing['originalName'] = $translations[$ing['originalName']] ?? $ing['originalName'];
                }
                if (!empty($ing['unit'])) {
                    $amt       = (float)($ing['amount'] ?? 0);
                    $converted = $this->translator->convertToMetric($ing['unit'], $amt);
                    if ($converted) {
                        $ing['amount'] = $converted['amount'];
                        $ing['unit']   = $converted['unit'];
                    } else {
                        $ing['unit'] = $this->translator->declineUnit($ing['unit'], $amt)
                            ?? ($translations[$ing['unit']] ?? $ing['unit']);
                    }
                }
                return $ing;
            }, $recipe['extendedIngredients']);
        }

        if (!empty($recipe['analyzedInstructions'][0]['steps'])) {
            $recipe['analyzedInstructions'][0]['steps'] = array_map(function (array $step) use ($translations) {
                if (!empty($step['step'])) {
                    $step['step'] = $translations[$step['step']] ?? $step['step'];
                }
                return $step;
            }, $recipe['analyzedInstructions'][0]['steps']);
        }

        if (!empty($recipe['instructions'])) {
            $plain = strip_tags($recipe['instructions']);
            $recipe['instructions'] = $translations[$plain] ?? $recipe['instructions'];
        }

        return response()->json($recipe);
    }
}
