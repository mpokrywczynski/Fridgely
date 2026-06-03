<?php

namespace App\Services;

use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class DeepLService
{
    private const ENDPOINT = 'https://api.mymemory.translated.net/get';
    private const EMAIL    = 'krywapo7@gmail.com';

    public function isConfigured(): bool
    {
        return true;
    }

    /**
     * Translate an array of English texts to Polish.
     * Returns map [original => translated].
     * Skips already-Polish strings. Caches each result 30 days.
     */
    public function translateBatch(array $texts): array
    {
        if (empty($texts)) {
            return [];
        }

        $result      = [];
        $toTranslate = [];

        foreach ($texts as $text) {
            $text = (string) $text;
            if (empty($text) || $this->looksPolish($text)) {
                $result[$text] = $text;
                continue;
            }
            $cached = Cache::get('mymemory.' . md5($text));
            if ($cached !== null) {
                $result[$text] = $cached;
            } else {
                $toTranslate[] = $text;
            }
        }

        if (!empty($toTranslate)) {
            try {
                $translations = $this->callApi($toTranslate);
                foreach ($translations as $i => $translated) {
                    $original = $toTranslate[$i];
                    Cache::put('mymemory.' . md5($original), $translated, now()->addDays(30));
                    $result[$original] = $translated;
                }
            } catch (\Throwable) {
                foreach ($toTranslate as $text) {
                    $result[$text] = $text;
                }
            }
        }

        return $result;
    }

    public function translate(string $text): string
    {
        return $this->translateBatch([$text])[$text] ?? $text;
    }

    private function callApi(array $texts): array
    {
        // Parallel GET requests (cURL multi) — one per text
        $responses = Http::pool(fn (Pool $pool) =>
            array_map(
                fn ($text) => $pool->timeout(10)->get(self::ENDPOINT, [
                    'q'        => $text,
                    'langpair' => 'en|pl',
                    'de'       => self::EMAIL,
                ]),
                $texts
            )
        );

        $result = [];
        foreach ($responses as $i => $response) {
            if ($response instanceof \Throwable || !$response->successful()) {
                $result[] = $texts[$i];
                continue;
            }
            $translated = $response->json('responseData.translatedText');
            // MyMemory returns the source text unchanged on failure
            $result[] = ($translated && $translated !== $texts[$i]) ? $translated : $texts[$i];
        }

        return $result;
    }

    private function looksPolish(string $text): bool
    {
        return (bool) preg_match('/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u', $text);
    }
}
