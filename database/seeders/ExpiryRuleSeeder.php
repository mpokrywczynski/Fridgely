<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ExpiryRuleSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('expiry_rules')->truncate();

        $rules = [
            // Mięso i ryby
            ['category' => 'mięso',      'subcategory' => 'mielone',     'keyword' => 'mielone',      'days_fresh' => 2,   'days_opened' => 2],
            ['category' => 'mięso',      'subcategory' => 'drób',        'keyword' => 'kurczak',      'days_fresh' => 3,   'days_opened' => 2],
            ['category' => 'mięso',      'subcategory' => 'drób',        'keyword' => 'pierś',        'days_fresh' => 3,   'days_opened' => 2],
            ['category' => 'mięso',      'subcategory' => 'drób',        'keyword' => 'indyk',        'days_fresh' => 3,   'days_opened' => 2],
            ['category' => 'mięso',      'subcategory' => 'wieprzowina', 'keyword' => 'schab',        'days_fresh' => 4,   'days_opened' => 3],
            ['category' => 'mięso',      'subcategory' => 'wędlina',     'keyword' => 'szynka',       'days_fresh' => 5,   'days_opened' => 3],
            ['category' => 'mięso',      'subcategory' => 'wędlina',     'keyword' => 'parówki',      'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'mięso',      'subcategory' => 'wędlina',     'keyword' => 'kiełbasa',     'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'ryby',       'subcategory' => 'świeże',      'keyword' => 'łosoś',        'days_fresh' => 2,   'days_opened' => 1],
            ['category' => 'ryby',       'subcategory' => 'świeże',      'keyword' => 'dorsz',        'days_fresh' => 2,   'days_opened' => 1],

            // Nabiał
            ['category' => 'nabiał',     'subcategory' => 'mleko',       'keyword' => 'mleko',        'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'nabiał',     'subcategory' => 'mleko',       'keyword' => 'mleko uht',    'days_fresh' => 90,  'days_opened' => 4],
            ['category' => 'nabiał',     'subcategory' => 'mleko',       'keyword' => 'napój owsiany','days_fresh' => 180, 'days_opened' => 4],
            ['category' => 'nabiał',     'subcategory' => 'jogurt',      'keyword' => 'jogurt',       'days_fresh' => 14,  'days_opened' => 2],
            ['category' => 'nabiał',     'subcategory' => 'ser',         'keyword' => 'ser żółty',    'days_fresh' => 14,  'days_opened' => 7],
            ['category' => 'nabiał',     'subcategory' => 'ser',         'keyword' => 'ser biały',    'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'nabiał',     'subcategory' => 'ser',         'keyword' => 'mozzarella',   'days_fresh' => 5,   'days_opened' => 2],
            ['category' => 'nabiał',     'subcategory' => 'twaróg',      'keyword' => 'twaróg',       'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'nabiał',     'subcategory' => 'śmietana',    'keyword' => 'śmietana',     'days_fresh' => 14,  'days_opened' => 3],
            ['category' => 'nabiał',     'subcategory' => 'masło',       'keyword' => 'masło',        'days_fresh' => 30,  'days_opened' => 14],
            ['category' => 'nabiał',     'subcategory' => 'jaja',        'keyword' => 'jaja',         'days_fresh' => 28,  'days_opened' => null],
            ['category' => 'nabiał',     'subcategory' => 'śmietanka',   'keyword' => 'śmietanka',    'days_fresh' => 7,   'days_opened' => 3],

            // Warzywa i owoce
            ['category' => 'warzywa',    'subcategory' => 'liściaste',   'keyword' => 'sałata',       'days_fresh' => 5,   'days_opened' => 3],
            ['category' => 'warzywa',    'subcategory' => 'liściaste',   'keyword' => 'szpinak',      'days_fresh' => 3,   'days_opened' => 2],
            ['category' => 'warzywa',    'subcategory' => null,          'keyword' => 'pomidory',     'days_fresh' => 5,   'days_opened' => null],
            ['category' => 'warzywa',    'subcategory' => null,          'keyword' => 'ogórek',       'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'warzywa',    'subcategory' => null,          'keyword' => 'marchew',      'days_fresh' => 14,  'days_opened' => null],
            ['category' => 'warzywa',    'subcategory' => null,          'keyword' => 'ziemniaki',    'days_fresh' => 30,  'days_opened' => null],
            ['category' => 'owoce',      'subcategory' => null,          'keyword' => 'truskawki',    'days_fresh' => 3,   'days_opened' => null],
            ['category' => 'owoce',      'subcategory' => null,          'keyword' => 'maliny',       'days_fresh' => 2,   'days_opened' => null],
            ['category' => 'owoce',      'subcategory' => null,          'keyword' => 'banany',       'days_fresh' => 5,   'days_opened' => null],
            ['category' => 'owoce',      'subcategory' => null,          'keyword' => 'jabłka',       'days_fresh' => 14,  'days_opened' => null],

            // Pieczywo
            ['category' => 'pieczywo',   'subcategory' => 'chleb',       'keyword' => 'chleb',        'days_fresh' => 5,   'days_opened' => 3],
            ['category' => 'pieczywo',   'subcategory' => 'bułki',       'keyword' => 'bułki',        'days_fresh' => 2,   'days_opened' => 1],

            // Gotowe dania i produkty przetworzone
            ['category' => 'gotowe',     'subcategory' => null,          'keyword' => 'zupa',         'days_fresh' => 3,   'days_opened' => 2],
            ['category' => 'gotowe',     'subcategory' => null,          'keyword' => 'obiad',        'days_fresh' => 3,   'days_opened' => 2],
            ['category' => 'gotowe',     'subcategory' => null,          'keyword' => 'pizza',        'days_fresh' => 3,   'days_opened' => 2],

            // Przetwory i długotrwałe
            ['category' => 'przetwory',  'subcategory' => 'dżem',        'keyword' => 'dżem',         'days_fresh' => 365, 'days_opened' => 30],
            ['category' => 'przetwory',  'subcategory' => 'sos',         'keyword' => 'ketchup',      'days_fresh' => 365, 'days_opened' => 30],
            ['category' => 'przetwory',  'subcategory' => 'sos',         'keyword' => 'majonez',      'days_fresh' => 180, 'days_opened' => 30],

            // Suche produkty
            ['category' => 'suche',      'subcategory' => 'kasze',       'keyword' => 'ryż',          'days_fresh' => 730, 'days_opened' => 180],
            ['category' => 'suche',      'subcategory' => 'kasze',       'keyword' => 'kasza',        'days_fresh' => 365, 'days_opened' => 180],
            ['category' => 'suche',      'subcategory' => 'makaron',     'keyword' => 'makaron',      'days_fresh' => 730, 'days_opened' => 180],
            ['category' => 'suche',      'subcategory' => 'mąka',        'keyword' => 'mąka',         'days_fresh' => 365, 'days_opened' => 90],

            // Napoje
            ['category' => 'napoje',     'subcategory' => 'sok',         'keyword' => 'sok',          'days_fresh' => 180, 'days_opened' => 3],
            ['category' => 'napoje',     'subcategory' => 'woda',        'keyword' => 'woda',         'days_fresh' => 730, 'days_opened' => 1],

            // Skróty ALDI / OCR — bez polskich znaków, pasują do nazw z paragonów
            ['category' => 'mięso',      'subcategory' => 'wędlina',     'keyword' => 'parow',        'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'mięso',      'subcategory' => 'wędlina',     'keyword' => 'kielb',        'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'pieczywo',   'subcategory' => 'bułki',       'keyword' => 'bułka',        'days_fresh' => 2,   'days_opened' => 1],
            ['category' => 'pieczywo',   'subcategory' => 'bułki',       'keyword' => 'bulka',        'days_fresh' => 2,   'days_opened' => 1],
            ['category' => 'gotowe',     'subcategory' => null,          'keyword' => 'pizz',         'days_fresh' => 3,   'days_opened' => 2],
            ['category' => 'nabiał',     'subcategory' => 'ser',         'keyword' => 'ser.hom',      'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'nabiał',     'subcategory' => 'ser',         'keyword' => 'twaróżek',     'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'owoce',      'subcategory' => null,          'keyword' => 'banan',        'days_fresh' => 5,   'days_opened' => null],
            ['category' => 'warzywa',    'subcategory' => null,          'keyword' => 'ogurek',       'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'warzywa',    'subcategory' => null,          'keyword' => 'ogórek',       'days_fresh' => 7,   'days_opened' => 3],
            ['category' => 'suche',      'subcategory' => 'herbata',     'keyword' => 'herbata',      'days_fresh' => 730, 'days_opened' => 365],
            ['category' => 'suche',      'subcategory' => 'herbata',     'keyword' => 'herbat',       'days_fresh' => 730, 'days_opened' => 365],
            ['category' => 'napoje',     'subcategory' => 'napój',       'keyword' => 'napoj',        'days_fresh' => 365, 'days_opened' => 3],
            ['category' => 'napoje',     'subcategory' => 'sok',         'keyword' => 'sok 100',      'days_fresh' => 180, 'days_opened' => 3],
        ];

        DB::table('expiry_rules')->insert(
            array_map(fn($r) => array_merge($r, [
                'created_at' => now(),
                'updated_at' => now(),
            ]), $rules)
        );
    }
}
