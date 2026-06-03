<?php

namespace App\Services;

/**
 * Translates Polish ingredient names to English before sending to Spoonacular.
 * Dictionary uses keyword matching (most-specific first) to handle
 * abbreviated or OCR-mangled names from Polish receipts.
 */
class IngredientTranslator
{
    // [Polish keyword (lowercase, no diacritics) => English ingredient name]
    // Ordered: more specific first so "ser zolty" wins over "ser"
    private const MAP = [
        // Mięso — Meat
        'mielone'       => 'ground beef',
        'pierc'         => 'chicken breast',
        'kurczak'       => 'chicken',
        'indyk'         => 'turkey',
        'schab'         => 'pork loin',
        'karkow'        => 'pork neck',
        'szynka'        => 'ham',
        'parowk'        => 'hot dogs',
        'parow.'        => 'hot dogs',
        'parow'         => 'hot dogs',
        'kielba'        => 'sausage',
        'kielb'         => 'sausage',
        'salami'        => 'salami',
        'boczek'        => 'bacon',
        'wolow'         => 'beef',

        // Ryby — Fish
        'losos'         => 'salmon',
        'dorsz'         => 'cod',
        'tunek'         => 'tuna',
        'makrela'       => 'mackerel',
        'karp'          => 'carp',
        'krewetk'       => 'shrimp',

        // Nabiał — Dairy
        'napoj owsiany' => 'oat milk',
        'mleko uht'     => 'milk',
        'mleko'         => 'milk',
        'smietanka'     => 'heavy cream',
        'smietana'      => 'sour cream',
        'jogurt'        => 'yogurt',
        'ser zolty'     => 'yellow cheese',
        'ser bial'      => 'cottage cheese',
        'ser hom'       => 'cottage cheese',
        'twarozek'      => 'cottage cheese',
        'twarog'        => 'cottage cheese',
        'mozzarella'    => 'mozzarella',
        'ser'           => 'cheese',
        'maslo'         => 'butter',
        'jaja'          => 'eggs',
        'jajka'         => 'eggs',
        'jajo'          => 'eggs',

        // Warzywa — Vegetables
        'szpinak'       => 'spinach',
        'salata'        => 'lettuce',
        'pomidor'       => 'tomatoes',
        'ogurek'        => 'cucumber',
        'ogorek'        => 'cucumber',
        'marchew'       => 'carrot',
        'ziemniak'      => 'potatoes',
        'cebul'         => 'onion',
        'czosnek'       => 'garlic',
        'broko'         => 'broccoli',
        'kalafior'      => 'cauliflower',
        'kapusta'       => 'cabbage',
        'papryka'       => 'bell pepper',
        'por'           => 'leek',
        'groszek'       => 'peas',
        'fasola'        => 'beans',
        'pieczark'      => 'mushrooms',
        'grzyb'         => 'mushrooms',
        'kukurydza'     => 'corn',

        // Owoce — Fruits
        'truskawk'      => 'strawberries',
        'maliny'        => 'raspberries',
        'borówk'        => 'blueberries',
        'banan'         => 'banana',
        'jablk'         => 'apples',
        'jablko'        => 'apple',
        'gruszk'        => 'pear',
        'pomaranc'      => 'orange',
        'cytryn'        => 'lemon',
        'winogrona'     => 'grapes',
        'mango'         => 'mango',
        'ananas'        => 'pineapple',
        'wisni'         => 'cherries',

        // Pieczywo — Bread
        'bulka'         => 'bread roll',
        'bulki'         => 'bread rolls',
        'chleb'         => 'bread',
        'bagietka'      => 'baguette',
        'tortilla'      => 'tortilla',

        // Suche / Produkty sypkie — Dry goods
        'makaron'       => 'pasta',
        'ryz'           => 'rice',
        'kasza'         => 'groats',
        'maka'          => 'flour',
        'platki owsiane'=> 'oatmeal',
        'platki'        => 'cereal',
        'musli'         => 'muesli',
        'cukier'        => 'sugar',
        'sol'           => 'salt',
        'pieprz czarny' => 'black pepper',
        'pieprz'        => 'black pepper',

        // Przetwory / Sosy — Condiments
        'ketchup'       => 'ketchup',
        'majonez'       => 'mayonnaise',
        'musztard'      => 'mustard',
        'dzem'          => 'jam',
        'miod'          => 'honey',
        'olej'          => 'oil',
        'oliwa'         => 'olive oil',
        'ocet'          => 'vinegar',
        'sos sojowy'    => 'soy sauce',
        'sos'           => 'sauce',

        // Napoje — Drinks
        'sok 100'       => 'fruit juice',
        'sok'           => 'juice',
        'woda'          => 'water',
        'napoj'         => 'juice',
        'herbata'       => 'tea',
        'kawa'          => 'coffee',
        'piwo'          => 'beer',

        // Gotowe — Ready meals
        'pizza'         => 'pizza',
        'zupa'          => 'soup',
        'pierogi'       => 'dumplings',
    ];

    // Imperial → metric conversions: unit => [multiplier, base_unit ('g' or 'ml')]
    // Result is promoted to kg/l if ≥ 1000.
    private const METRIC_CONVERSIONS = [
        'oz'          => [28.35,  'g'],
        'ounce'       => [28.35,  'g'],
        'ounces'      => [28.35,  'g'],
        'lb'          => [453.59, 'g'],
        'lbs'         => [453.59, 'g'],
        'pound'       => [453.59, 'g'],
        'pounds'      => [453.59, 'g'],
        'cup'         => [240.0,  'ml'],
        'cups'        => [240.0,  'ml'],
        'tablespoon'  => [15.0,   'ml'],
        'tablespoons' => [15.0,   'ml'],
        'tbsp'        => [15.0,   'ml'],
        'tbs'         => [15.0,   'ml'],
        'teaspoon'    => [5.0,    'ml'],
        'teaspoons'   => [5.0,    'ml'],
        'tsp'         => [5.0,    'ml'],
        'ts'          => [5.0,    'ml'],
        'fl oz'       => [29.57,  'ml'],
    ];

    // Full declension forms per unit: [singular, few(2-4), many(5+), genSingular(fractions)]
    // Polish rules: 1→singular, 2-4→few (but 12-14→many), 5+→many, decimals→genSingular
    private const UNIT_FORMS = [
        'tablespoon'  => ['łyżka stołowa',  'łyżki stołowe',  'łyżek stołowych', 'łyżki stołowej'],
        'tablespoons' => ['łyżka stołowa',  'łyżki stołowe',  'łyżek stołowych', 'łyżki stołowej'],
        'tbsp'        => ['łyżka stołowa',  'łyżki stołowe',  'łyżek stołowych', 'łyżki stołowej'],
        'tbs'         => ['łyżka stołowa',  'łyżki stołowe',  'łyżek stołowych', 'łyżki stołowej'],
        'teaspoon'    => ['łyżeczka',       'łyżeczki',       'łyżeczek',        'łyżeczki'],
        'teaspoons'   => ['łyżeczka',       'łyżeczki',       'łyżeczek',        'łyżeczki'],
        'tsp'         => ['łyżeczka',       'łyżeczki',       'łyżeczek',        'łyżeczki'],
        'ts'          => ['łyżeczka',       'łyżeczki',       'łyżeczek',        'łyżeczki'],
        'cup'         => ['szklanka',       'szklanki',       'szklanek',        'szklanki'],
        'cups'        => ['szklanka',       'szklanki',       'szklanek',        'szklanki'],
        'pound'       => ['funt',           'funty',          'funtów',          'funta'],
        'pounds'      => ['funt',           'funty',          'funtów',          'funta'],
        'lb'          => ['funt',           'funty',          'funtów',          'funta'],
        'lbs'         => ['funt',           'funty',          'funtów',          'funta'],
        'ounce'       => ['uncja',          'uncje',          'uncji',           'uncji'],
        'ounces'      => ['uncja',          'uncje',          'uncji',           'uncji'],
        'oz'          => ['uncja',          'uncje',          'uncji',           'uncji'],
        'can'         => ['puszka',         'puszki',         'puszek',          'puszki'],
        'cans'        => ['puszka',         'puszki',         'puszek',          'puszki'],
        'slice'       => ['plaster',        'plastry',        'plastrów',        'plastra'],
        'slices'      => ['plaster',        'plastry',        'plastrów',        'plastra'],
        'piece'       => ['kawałek',        'kawałki',        'kawałków',        'kawałka'],
        'pieces'      => ['kawałek',        'kawałki',        'kawałków',        'kawałka'],
        'clove'       => ['ząbek',          'ząbki',          'ząbków',          'ząbka'],
        'cloves'      => ['ząbek',          'ząbki',          'ząbków',          'ząbka'],
        'bunch'       => ['pęczek',         'pęczki',         'pęczków',         'pęczka'],
        'bunches'     => ['pęczek',         'pęczki',         'pęczków',         'pęczka'],
        'head'        => ['główka',         'główki',         'główek',          'główki'],
        'heads'       => ['główka',         'główki',         'główek',          'główki'],
        'package'     => ['opakowanie',     'opakowania',     'opakowań',        'opakowania'],
        'packages'    => ['opakowanie',     'opakowania',     'opakowań',        'opakowania'],
        'pkg'         => ['opakowanie',     'opakowania',     'opakowań',        'opakowania'],
        'pinch'       => ['szczypta',       'szczypty',       'szczypt',         'szczypty'],
        'pinches'     => ['szczypta',       'szczypty',       'szczypt',         'szczypty'],
        'stick'       => ['kostka',         'kostki',         'kostek',          'kostki'],
        'sticks'      => ['kostka',         'kostki',         'kostek',          'kostki'],
        'cube'        => ['kostka',         'kostki',         'kostek',          'kostki'],
        'cubes'       => ['kostka',         'kostki',         'kostek',          'kostki'],
        'jar'         => ['słoik',          'słoiki',         'słoików',         'słoika'],
        'jars'        => ['słoik',          'słoiki',         'słoików',         'słoika'],
        'bottle'      => ['butelka',        'butelki',        'butelek',         'butelki'],
        'bottles'     => ['butelka',        'butelki',        'butelek',         'butelki'],
        'serving'     => ['porcja',         'porcje',         'porcji',          'porcji'],
        'servings'    => ['porcja',         'porcje',         'porcji',          'porcji'],
        'bag'         => ['torebka',        'torebki',        'torebek',         'torebki'],
        'bags'        => ['torebka',        'torebki',        'torebek',         'torebki'],
        'box'         => ['pudełko',        'pudełka',        'pudełek',         'pudełka'],
        'boxes'       => ['pudełko',        'pudełka',        'pudełek',         'pudełka'],
        'fillet'      => ['filet',          'filety',         'filetów',         'fileta'],
        'fillets'     => ['filet',          'filety',         'filetów',         'fileta'],
        'strip'       => ['pasek',          'paski',          'pasków',          'paska'],
        'strips'      => ['pasek',          'paski',          'pasków',          'paska'],
        'scoop'       => ['łyżka',          'łyżki',          'łyżek',           'łyżki'],
        'scoops'      => ['łyżka',          'łyżki',          'łyżek',           'łyżki'],
        'sheet'       => ['arkusz',         'arkusze',        'arkuszy',         'arkusza'],
        'sheets'      => ['arkusz',         'arkusze',        'arkuszy',         'arkusza'],
        'sprig'       => ['gałązka',        'gałązki',        'gałązek',         'gałązki'],
        'sprigs'      => ['gałązka',        'gałązki',        'gałązek',         'gałązki'],
        'stalk'       => ['łodyga',         'łodygi',         'łodyg',           'łodygi'],
        'stalks'      => ['łodyga',         'łodygi',         'łodyg',           'łodygi'],
        'drop'        => ['kropla',         'krople',         'kropli',          'kropli'],
        'drops'       => ['kropla',         'krople',         'kropli',          'kropli'],
    ];

    // Culinary unit translations (English → Polish), including abbreviations.
    // Used instead of MyMemory to avoid mistranslations ("can"→"może", "slices"→"przekroje").
    private const UNIT_MAP = [
        // Skróty
        'tbs'         => 'łyżki stołowe',
        'tbsp'        => 'łyżki stołowe',
        'tsp'         => 'łyżeczki',
        'ts'          => 'łyżeczki',
        'lb'          => 'funty',
        'lbs'         => 'funty',
        'oz'          => 'uncje',
        'fl oz'       => 'uncje płynne',
        'pkg'         => 'opak.',
        // Pełne nazwy
        'tablespoon'  => 'łyżka stołowa',
        'tablespoons' => 'łyżki stołowe',
        'teaspoon'    => 'łyżeczka',
        'teaspoons'   => 'łyżeczki',
        'cup'         => 'szklanka',
        'cups'        => 'szklanki',
        'pound'       => 'funt',
        'pounds'      => 'funty',
        'ounce'       => 'uncja',
        'ounces'      => 'uncje',
        'can'         => 'puszka',
        'cans'        => 'puszki',
        'slice'       => 'plaster',
        'slices'      => 'plastry',
        'piece'       => 'kawałek',
        'pieces'      => 'kawałki',
        'clove'       => 'ząbek',
        'cloves'      => 'ząbki',
        'bunch'       => 'pęczek',
        'bunches'     => 'pęczki',
        'head'        => 'główka',
        'heads'       => 'główki',
        'package'     => 'opakowanie',
        'packages'    => 'opakowania',
        'pinch'       => 'szczypta',
        'pinches'     => 'szczypty',
        'dash'        => 'odrobina',
        'handful'     => 'garść',
        'large'       => 'duże',
        'medium'      => 'średnie',
        'small'       => 'małe',
        'extra large' => 'bardzo duże',
        'serving'     => 'porcja',
        'servings'    => 'porcje',
        'stick'       => 'kostka',
        'sticks'      => 'kostki',
        'block'       => 'blok',
        'jar'         => 'słoik',
        'jars'        => 'słoiki',
        'bottle'      => 'butelka',
        'bottles'     => 'butelki',
        'drop'        => 'kropla',
        'drops'       => 'krople',
        'sheet'       => 'arkusz',
        'sheets'      => 'arkusze',
        'sprig'       => 'gałązka',
        'sprigs'      => 'gałązki',
        'stalk'       => 'łodyga',
        'stalks'      => 'łodygi',
        'fillet'      => 'filet',
        'fillets'     => 'filety',
        'strip'       => 'pasek',
        'strips'      => 'paski',
        'cube'        => 'kostka',
        'cubes'       => 'kostki',
        'scoop'       => 'łyżka',
        'scoops'      => 'łyżki',
        'bag'         => 'torebka',
        'bags'        => 'torebki',
        'box'         => 'pudełko',
        'boxes'       => 'pudełka',
        // Metryczne (bez zmian)
        'g'           => 'g',
        'kg'          => 'kg',
        'ml'          => 'ml',
        'l'           => 'l',
    ];

    /**
     * Convert an imperial unit + amount to metric {amount, unit}.
     * Returns null if the unit is not in the conversion table (e.g. already metric, or countable).
     */
    public function convertToMetric(string $unit, float $amount): ?array
    {
        $key  = strtolower(trim($unit));
        $conv = self::METRIC_CONVERSIONS[$key] ?? null;
        if ($conv === null) return null;

        [$factor, $baseUnit] = $conv;
        $value = $amount * $factor;

        if ($baseUnit === 'g') {
            if ($value >= 1000) {
                return ['amount' => round($value / 1000, 1), 'unit' => 'kg'];
            }
            return ['amount' => self::roundNice($value), 'unit' => 'g'];
        }

        // ml
        if ($value >= 1000) {
            return ['amount' => round($value / 1000, 1), 'unit' => 'l'];
        }
        return ['amount' => self::roundNice($value), 'unit' => 'ml'];
    }

    /**
     * Translate a culinary unit string to Polish using the dictionary.
     * Returns null if no match (caller can then fall back to API translation).
     */
    public function translateUnit(string $unit): ?string
    {
        return self::UNIT_MAP[strtolower(trim($unit))] ?? null;
    }

    /**
     * Translate and grammatically decline a unit based on the accompanying quantity.
     * Polish rules: 1→mianownik l.poj., 2-4→mianownik l.mn. (but 12-14→dopełniacz l.mn.),
     * 5+→dopełniacz l.mn., decimals→dopełniacz l.poj.
     * Returns null if unit is unknown (caller falls back to API translation).
     */
    public function declineUnit(string $unit, float $amount): ?string
    {
        $key   = strtolower(trim($unit));
        $forms = self::UNIT_FORMS[$key] ?? null;

        if ($forms === null) {
            return self::UNIT_MAP[$key] ?? null;
        }

        [$singular, $few, $many, $genSingular] = $forms;

        // Ułamek dziesiętny → dopełniacz l.poj. (0.5 łyżki, 1.5 funta)
        if ($amount != floor($amount)) {
            return $genSingular;
        }

        $n      = (int) abs($amount);
        $mod10  = $n % 10;
        $mod100 = $n % 100;

        if ($n === 1)                               return $singular;
        if ($mod100 >= 11 && $mod100 <= 19)         return $many;
        if ($mod10 >= 2 && $mod10 <= 4)             return $few;
        return $many;
    }

    // English → Polish (for displaying Spoonacular's missedIngredients in Polish)
    private const REVERSE_MAP = [
        'milk'           => 'mleko',
        'oat milk'       => 'napój owsiany',
        'heavy cream'    => 'śmietanka',
        'sour cream'     => 'śmietana',
        'butter'         => 'masło',
        'eggs'           => 'jaja',
        'egg'            => 'jajka',
        'yogurt'         => 'jogurt',
        'cheese'         => 'ser',
        'yellow cheese'  => 'ser żółty',
        'cottage cheese' => 'twaróg',
        'mozzarella'     => 'mozzarella',
        'chicken'        => 'kurczak',
        'chicken breast' => 'pierś kurczaka',
        'turkey'         => 'indyk',
        'pork loin'      => 'schab',
        'ham'            => 'szynka',
        'hot dogs'       => 'parówki',
        'sausage'        => 'kiełbasa',
        'bacon'          => 'boczek',
        'ground beef'    => 'mięso mielone',
        'beef'           => 'wołowina',
        'salmon'         => 'łosoś',
        'cod'            => 'dorsz',
        'tuna'           => 'tuńczyk',
        'shrimp'         => 'krewetki',
        'tomatoes'       => 'pomidory',
        'tomato'         => 'pomidor',
        'cucumber'       => 'ogórek',
        'carrot'         => 'marchew',
        'potatoes'       => 'ziemniaki',
        'potato'         => 'ziemniak',
        'onion'          => 'cebula',
        'garlic'         => 'czosnek',
        'lettuce'        => 'sałata',
        'spinach'        => 'szpinak',
        'broccoli'       => 'brokuł',
        'cauliflower'    => 'kalafior',
        'cabbage'        => 'kapusta',
        'bell pepper'    => 'papryka',
        'leek'           => 'por',
        'peas'           => 'groszek',
        'beans'          => 'fasola',
        'mushrooms'      => 'pieczarki',
        'corn'           => 'kukurydza',
        'banana'         => 'banan',
        'apple'          => 'jabłko',
        'apples'         => 'jabłka',
        'strawberries'   => 'truskawki',
        'raspberries'    => 'maliny',
        'blueberries'    => 'borówki',
        'pear'           => 'gruszka',
        'orange'         => 'pomarańcza',
        'lemon'          => 'cytryna',
        'grapes'         => 'winogrona',
        'bread'          => 'chleb',
        'bread roll'     => 'bułka',
        'bread rolls'    => 'bułki',
        'baguette'       => 'bagietka',
        'tortilla'       => 'tortilla',
        'pasta'          => 'makaron',
        'rice'           => 'ryż',
        'flour'          => 'mąka',
        'oatmeal'        => 'płatki owsiane',
        'cereal'         => 'płatki śniadaniowe',
        'sugar'          => 'cukier',
        'salt'           => 'sól',
        'pepper'         => 'pieprz',
        'black pepper'   => 'pieprz',
        'ground pepper'  => 'pieprz mielony',
        'oil'            => 'olej',
        'olive oil'      => 'oliwa z oliwek',
        'vegetable oil'  => 'olej roślinny',
        'vinegar'        => 'ocet',
        'ketchup'        => 'ketchup',
        'mayonnaise'     => 'majonez',
        'mustard'        => 'musztarda',
        'honey'          => 'miód',
        'jam'            => 'dżem',
        'sauce'          => 'sos',
        'soy sauce'      => 'sos sojowy',
        'juice'          => 'sok',
        'fruit juice'    => 'sok owocowy',
        'water'          => 'woda',
        'tea'            => 'herbata',
        'coffee'         => 'kawa',
        'pizza'          => 'pizza',
        'soup'           => 'zupa',
        'dumplings'      => 'pierogi',
    ];

    public function translate(string $polishName): string
    {
        $norm = $this->normalize($polishName);

        foreach (self::MAP as $keyword => $english) {
            if (str_contains($norm, $keyword)) {
                return $english;
            }
        }

        // No match — return original (works for international names like "mozzarella")
        return $polishName;
    }

    /**
     * Translates a list of Polish names, deduplicates English results.
     * Returns English names only (no nulls, no duplicates).
     */
    public function translateAll(array $polishNames): array
    {
        $seen   = [];
        $result = [];

        foreach ($polishNames as $name) {
            $en = $this->translate($name);
            $key = strtolower($en);
            if (!isset($seen[$key])) {
                $seen[$key] = true;
                $result[]   = $en;
            }
        }

        return $result;
    }

    /**
     * Translates an English ingredient name back to Polish for display.
     * Falls back to the original if no entry in REVERSE_MAP.
     */
    public function translateBack(string $englishName): string
    {
        $key = strtolower(trim($englishName));
        return self::REVERSE_MAP[$key] ?? $englishName;
    }

    private static function roundNice(float $value): int
    {
        if ($value < 50) {
            return (int) round($value / 5) * 5;
        }
        return (int) round($value / 10) * 10;
    }

    private function normalize(string $text): string
    {
        $text = mb_strtolower($text, 'UTF-8');
        $text = strtr($text, [
            'ą'=>'a','ć'=>'c','ę'=>'e','ł'=>'l','ń'=>'n',
            'ó'=>'o','ś'=>'s','ź'=>'z','ż'=>'z',
        ]);
        return $text;
    }
}
