<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpiryRule;
use App\Models\Product;
use App\Models\StorageZone;
use App\Services\OcrService;
use App\Services\ReceiptParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ReceiptController extends Controller
{
    // Kategoria ExpiryRule → preferowane typy stref
    private const CATEGORY_ZONE_MAP = [
        'mięso'     => ['fridge'],
        'ryby'      => ['fridge'],
        'nabiał'    => ['fridge'],
        'warzywa'   => ['fridge'],
        'owoce'     => ['fridge'],
        'gotowe'    => ['fridge'],
        'pieczywo'  => ['pantry', 'custom'],
        'suche'     => ['pantry', 'custom'],
        'napoje'    => ['pantry', 'custom'],
        'przetwory' => ['pantry', 'custom', 'cellar'],
    ];

    // Słowa kluczowe bez polskich znaków (normalizujemy nazwę przed porównaniem)
    private const PANTRY_KEYWORDS = [
        'herbata', 'kawa', 'kakao', 'zupka', 'zupa', 'rosol', 'bulion',
        'makaron', 'ryz', 'kasza', 'maka', 'cukier', 'sol', 'pieprz', 'przyprawa',
        'chleb', 'bulka', 'buleczk', 'pieczywo', 'tost',
        'konserw', 'puszka',
        'olej', 'oliwa', 'ocet', 'ketchup', 'musztard', 'majonez', 'chrzan',
        'dzem', 'powidla', 'miod', 'nutella',
        'platki', 'musli', 'granola', 'owsianka',
        'chipsy', 'palusz', 'orzech', 'migdal', 'rodzynk',
        'ciastk', 'herbatnik', 'wafle', 'baton', 'czekolad', 'cukierek',
        'napoj', 'sok', 'woda', 'piwo', 'wino',
        'vifon', 'knorr', 'maggi',
    ];

    private const FRIDGE_KEYWORDS = [
        'mleko', 'smietan', 'jogurt', 'kefir', 'maslanka', 'maselko',
        'ser.', 'sery', 'serek', 'twarog', 'maslo', 'margar',
        'mies', 'wedlin', 'kielb', 'szynk', 'parow', 'parowk', 'boczek',
        'kurczak', 'wolowi', 'wieprzow', 'indyk', 'drob',
        'ryba', 'losos', 'tuncz', 'krewetk', 'karp',
        'jaj', 'jajk',
        'ogurek', 'pomidor', 'salat', 'marchew', 'kapust', 'brokul',
        'banan', 'jablk', 'gruszk', 'truskawk', 'malina', 'winogrono',
        'pizza', 'pierogi', 'nalesnik', 'lazania',
    ];

    public function __construct(
        private OcrService    $ocr,
        private ReceiptParser $parser,
    ) {}

    // POST /api/receipts/scan
    public function scan(Request $request)
    {
        $v = Validator::make($request->all(), [
            'image' => ['required', 'image', 'max:10240'],
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        try {
            $rawText  = $this->ocr->extractText($request->file('image'));
            $products = $this->parser->parse($rawText);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $zones       = $request->user()->family->storageZones()->get();
        $defaultZone = $zones->first();

        $enriched = array_map(function (array $p) use ($zones, $defaultZone) {
            $rule          = ExpiryRule::findForProduct($p['name']);
            $suggestedZone = $this->suggestZone($rule?->category, $p['name'], $zones, $defaultZone);

            return array_merge($p, [
                'category'          => $rule?->category,
                'expiry_date'       => $rule ? now()->addDays($rule->days_fresh)->toDateString() : null,
                'storage_zone_id'   => $suggestedZone?->id,
                'storage_zone_name' => $suggestedZone?->name,
                'selected'          => true,
            ]);
        }, $products);

        return response()->json([
            'products' => $enriched,
            'raw_text' => $rawText,
        ]);
    }

    private function suggestZone(?string $category, string $productName, $zones, ?StorageZone $fallback): ?StorageZone
    {
        // 1. Kategoria z ExpiryRule
        if ($category) {
            foreach (self::CATEGORY_ZONE_MAP[$category] ?? [] as $type) {
                if ($zone = $zones->firstWhere('type', $type)) return $zone;
            }
        }

        // 2. Słowa kluczowe — normalizujemy do ASCII żeby uniezależnić od diakrytyków
        $normalized = $this->normalizeForSearch($productName);

        foreach (self::PANTRY_KEYWORDS as $kw) {
            if (str_contains($normalized, $kw)) {
                return $zones->firstWhere('type', 'pantry')
                    ?? $zones->firstWhere('type', 'custom')
                    ?? $fallback;
            }
        }

        foreach (self::FRIDGE_KEYWORDS as $kw) {
            if (str_contains($normalized, $kw)) {
                return $zones->firstWhere('type', 'fridge') ?? $fallback;
            }
        }

        return $fallback;
    }

    private function normalizeForSearch(string $text): string
    {
        $text = mb_strtolower($text, 'UTF-8');
        return strtr($text, [
            'ą'=>'a','ć'=>'c','ę'=>'e','ł'=>'l','ń'=>'n',
            'ó'=>'o','ś'=>'s','ź'=>'z','ż'=>'z',
        ]);
    }

    // POST /api/receipts/confirm
    public function confirm(Request $request)
    {
        $v = Validator::make($request->all(), [
            'products'                    => ['required', 'array', 'min:1'],
            'products.*.name'             => ['required', 'string', 'max:191'],
            'products.*.quantity'         => ['required', 'numeric', 'min:0.01'],
            'products.*.unit'             => ['required', 'string', 'max:20'],
            'products.*.price'            => ['nullable', 'numeric', 'min:0'],
            'products.*.storage_zone_id'  => ['required', 'integer'],
            'products.*.expiry_date'      => ['nullable', 'date'],
            'products.*.category'         => ['nullable', 'string', 'max:191'],
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $user   = $request->user();
        $family = $user->family;

        $zoneIds    = collect($request->products)->pluck('storage_zone_id')->unique();
        $validZones = $family->storageZones()->whereIn('id', $zoneIds)->pluck('id');
        if ($validZones->count() !== $zoneIds->count()) {
            return response()->json(['message' => 'Nieprawidłowa strefa magazynowania'], 403);
        }

        $created = [];
        foreach ($request->products as $item) {
            $created[] = Product::create([
                'family_id'       => $family->id,
                'storage_zone_id' => $item['storage_zone_id'],
                'added_by'        => $user->id,
                'name'            => $item['name'],
                'name_raw'        => $item['name_raw'] ?? $item['name'],
                'category'        => $item['category'] ?? null,
                'quantity'        => $item['quantity'],
                'unit'            => $item['unit'],
                'price'           => $item['price'] ?? null,
                'purchase_date'   => now()->toDateString(),
                'expiry_date'     => $item['expiry_date'] ?? null,
            ]);
        }

        return response()->json([
            'added'   => count($created),
            'message' => 'Dodano ' . count($created) . ' produktów do lodówki',
        ], 201);
    }
}
