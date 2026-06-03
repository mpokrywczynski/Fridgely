<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SpoonacularService
{
    private const BASE = 'https://api.spoonacular.com';

    private string $key;

    public function __construct()
    {
        $this->key = config('services.spoonacular.key', '');
    }

    public function isConfigured(): bool
    {
        return !empty($this->key);
    }

    /**
     * Find recipes by available ingredients.
     * Results cached 6 h per unique ingredient set.
     */
    public function findByIngredients(array $ingredientNames, int $number = 24): array
    {
        $cacheKey = 'spoon.find.v2.' . md5(implode(',', $ingredientNames));

        return Cache::remember($cacheKey, now()->addHours(24), function () use ($ingredientNames, $number) {
            $res = Http::get(self::BASE . '/recipes/findByIngredients', [
                'apiKey'       => $this->key,
                'ingredients'  => implode(',+', $ingredientNames),
                'number'       => $number,
                'ranking'      => 2,   // minimize missing ingredients
                'ignorePantry' => true,
            ]);

            if ($res->status() === 402) {
                throw new \RuntimeException('quota_exceeded');
            }
            if (!$res->successful()) {
                throw new \RuntimeException('Spoonacular error ' . $res->status());
            }

            return $res->json();
        });
    }

    /**
     * Full recipe info (ingredients list + step-by-step instructions).
     * Cached 24 h — recipe content rarely changes.
     */
    public function getInfo(int $id): array
    {
        return Cache::remember("spoon.info.{$id}", now()->addHours(24), function () use ($id) {
            $res = Http::get(self::BASE . "/recipes/{$id}/information", [
                'apiKey'            => $this->key,
                'includeNutrition'  => false,
            ]);

            if (!$res->successful()) {
                throw new \RuntimeException('Spoonacular error ' . $res->status());
            }

            return $res->json();
        });
    }
}
