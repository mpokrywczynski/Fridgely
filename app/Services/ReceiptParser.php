<?php

namespace App\Services;

class ReceiptParser
{
    // Linie które ignorujemy całkowicie
    private array $skipPatterns = [
        '/^(suma|razem|do zap[łl]aty|gotówka|karta|reszta|rabat|paragon|fiskalny|nip|numer|dziękujemy|zapraszamy)/i',
        '/^(ptu|vat|opakowania|torba|reklamówka|sprzed\.|kwota|zwrot)/i',
        '/^\*+/',
        '/^={3,}/',
        '/^-{3,}/',
        '/^\d{4}-\d{2}-\d{2}/',
        '/^\d{2}:\d{2}/',
        '/^płatno/i',
        '/^wpłacono/i',
        '/^rozliczenie/i',
        // OCR błędny odczyt: linia to tylko ilość+jednostka bez nazwy, np. "1SZT * 2,99" lub "lSZT * 2,99"
        '/^\d*[lLiI]+(szt\.?|kg|g|l|ml)\s*\*/i',
        '/^\d+\s*(szt\.?|kg|g|l|ml)\s*\*\s*\d/i',
        // OCR zamienia znaki: "Sprzed."→"Svrzed.", "Kwota"→"Kuota/Kvota" — łapiemy luźniej
        '/^s[pv][rz]/i',           // Sprzed. / Svrzed.
        '/^k[wu][ao]ta\b/i',       // Kwota / Kuota / Kvota
        '/^opak\b/i',              // Opak. zwrot. / Opakowania
        '/\bptu\b/i',              // Każda linia z PTU (podatek) — sumy VAT
        '/^do zap/i',              // Do zapłaty (czasem z błędem)
        '/^bdo\b/i',               // Numer BDO rejestracyjny
        '/^vst\b/i',               // VST numer fiskalny
        '/^nr wydr/i',             // Nr wydruku
    ];

    public function parse(string $rawText): array
    {
        $lines    = explode("\n", $rawText);
        $products = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if (strlen($line) < 4) continue;
            if ($this->shouldSkip($line)) continue;

            $product = $this->parseLine($line);
            if ($product) {
                $products[] = $product;
            }
        }

        return $this->deduplicate($products);
    }

    private function shouldSkip(string $line): bool
    {
        foreach ($this->skipPatterns as $pattern) {
            if (preg_match($pattern, $line)) return true;
        }
        return false;
    }

    private function parseLine(string $line): ?array
    {
        // ================================================================
        // Strategia 1: Format ALDI/Lidl/Biedronka
        // "NAZWA [VAT]   QTY(SZT|kg|g) * CENA_JEDN [CENA_ŁĄCZ] [VAT]"
        // np. "MLEKO SWIEZE 2%1L C 1SZT * 2,99 2,99 C"
        //     "BANANY - KG C 0,48kg * 6,99 3,36 C"
        // ================================================================
        // ZACHŁANNY (.+) — bierze OSTATNIE wystąpienie bloku qty*unit, nie pierwsze.
        // Dzięki temu "HERBATA PIRAMID.20X2G B  1SZT * 3,99" → name="HERBATA PIRAMID.20X2G B", nie "HERBATA PIRAMID."
        $aldRx = '/^(.+)\s+(\d+[,.]?\d*)\s*(szt\.?|kg|g|l|ml)\s*\*\s*(\d+[,.]\d{2})(?:\s+(\d+[,.]\d{2}))?\s*[A-E]?\s*$/i';

        if (preg_match($aldRx, $line, $m)) {
            // Cena końcowa (łączna) jest ważniejsza niż jednostkowa
            $price = isset($m[5]) && $m[5]
                ? (float) str_replace(',', '.', $m[5])
                : (float) str_replace(',', '.', $m[4]);

            if ($price < 0.05 || $price > 999) return null;

            $qty  = (float) str_replace(',', '.', $m[2]);
            $unit = strtolower(rtrim($m[3], '.'));

            // Nazwa: wszystko przed blokiem qty, usuń trailing znak VAT (" C", " A" itp.)
            $nameRaw = preg_replace('/\s+[A-E]\s*$/', '', trim($m[1]));
            $name    = $this->normalizeName($nameRaw);

            if (!$this->isValidName($name)) return null;

            return ['name' => $name, 'name_raw' => $nameRaw,
                    'quantity' => $qty, 'unit' => $unit, 'price' => $price];
        }

        // ================================================================
        // Strategia 2: Fallback — cena na końcu linii (inne formaty)
        // ================================================================
        if (!preg_match('/(\d+[,.]\d{2})\s*[A-E]?\s*$/', $line, $pm)) {
            // Brak ceny — próbuj Strategię 3 (Engine 1: tylko lewa kolumna)
            return $this->parseNameOnlyLine($line);
        }

        $price = (float) str_replace(',', '.', $pm[1]);
        if ($price < 0.05 || $price > 999) return null;

        // Usuń cenę z końca
        $nameRaw = trim(preg_replace('/\s*\d+[,.]\d{2}\s*[A-E]?\s*$/', '', $line));

        // Usuń fragment "* cena" który mógł pozostać
        $nameRaw = preg_replace('/\s*\*\s*\d+[,.]\d{2}/', '', $nameRaw);

        // Wyciągnij qty
        $qty = 1.0; $unit = 'szt';
        $qtyPat = '/(\d+[,.]?\d*)\s*(szt\.?|kg|g|l|ml)\b/i';
        if (preg_match($qtyPat, $nameRaw, $qm)) {
            $qty  = (float) str_replace(',', '.', $qm[1]);
            $unit = strtolower(rtrim($qm[2], '.'));
            $nameRaw = trim(preg_replace($qtyPat, '', $nameRaw));
        }

        // Usuń znaki specjalne
        $nameRaw = preg_replace('/\s*[*×]\s*/', ' ', $nameRaw);

        $name = $this->normalizeName($nameRaw);
        if (!$this->isValidName($name)) return null;

        return ['name' => $name, 'name_raw' => $nameRaw,
                'quantity' => $qty, 'unit' => $unit, 'price' => $price];
    }

    // ================================================================
    // Strategia 3: Format bez ceny — OCR Engine 1 zwraca tylko nazwy
    // "MAKARON MIE 250G C", "OGÀREK SZKLARNIOWY KG C"
    // ================================================================
    private function parseNameOnlyLine(string $line): ?array
    {
        // 3a: z rozmiarem — "MAKARON MIE 250G C", "SOK HIX 200 ML C"
        $rx3a = '/^(.+)\s+(\d+[,.]?\d*)\s*(szt\.?|kg|g|l|ml)\s*[A-E]?\s*$/i';
        if (preg_match($rx3a, $line, $m)) {
            $qty  = (float) str_replace(',', '.', $m[2]);
            $unit = strtolower(rtrim($m[3], '.'));

            if ($qty < 0.01 || $qty > 9999) return null;

            $nameRaw = preg_replace('/\s+[A-E]\s*$/', '', trim($m[1]));
            $name    = $this->normalizeName($nameRaw);
            if (!$this->isValidName($name)) return null;

            return ['name' => $name, 'name_raw' => $nameRaw,
                    'quantity' => $qty, 'unit' => $unit, 'price' => null];
        }

        // 3b: sprzedawane na wagę bez liczby — "OGÀREK SZKLARNIOWY KG C"
        $rx3b = '/^(.+)\s+(kg|g|l|ml|szt\.?)\s+[A-E]\s*$/i';
        if (preg_match($rx3b, $line, $m)) {
            $unit    = strtolower(rtrim($m[2], '.'));
            $nameRaw = trim($m[1]);
            $name    = $this->normalizeName($nameRaw);
            if (!$this->isValidName($name)) return null;

            return ['name' => $name, 'name_raw' => $nameRaw,
                    'quantity' => 1.0, 'unit' => $unit, 'price' => null];
        }

        return null;
    }

    // Przynajmniej 3 litery → to jest produkt, nie cena ani garbled qty token
    private function isValidName(string $name): bool
    {
        if (strlen($name) < 2) return false;
        if (preg_match_all('/\p{L}/u', $name) < 3) return false;
        // Odrzuć "lSZT", "1szt", "0,48kg" — OCR garbled qty+unit
        if (preg_match('/^[\d.,lLiI]+\s*(szt\.?|kg|g|l|ml)$/i', $name)) return false;
        return true;
    }

    private function normalizeName(string $raw): string
    {
        $name = preg_replace('/[^\p{L}\p{N}\s\.\-\/\%]/u', ' ', $raw);
        $name = preg_replace('/\s{2,}/', ' ', $name);
        // Usuń izolowane oznaczenia wagowe na końcu: "Marchew Kg" → "Marchew"
        $name = preg_replace('/\s+\b(kg|g|l|ml|szt)\s*$/iu', '', $name);
        // Usuń " - " na końcu
        $name = preg_replace('/[\s\-]+$/', '', $name);
        $name = trim($name);

        if (mb_strtoupper($name, 'UTF-8') === $name) {
            $name = mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
        }

        return $name;
    }

    private function deduplicate(array $products): array
    {
        $seen = []; $result = [];
        foreach ($products as $p) {
            $key = mb_strtolower($p['name'], 'UTF-8');
            if (!isset($seen[$key])) {
                $seen[$key] = true;
                $result[]   = $p;
            }
        }
        return $result;
    }
}
