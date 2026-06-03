<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExpiryRule extends Model
{
    use HasFactory;

    protected $fillable = ['category', 'subcategory', 'keyword', 'days_fresh', 'days_opened'];

    public static function findForProduct(string $name): ?self
    {
        $normalized = self::normalizeStr($name);

        return self::whereNotNull('keyword')
            ->get()
            ->first(fn($rule) => str_contains($normalized, self::normalizeStr($rule->keyword)));
    }

    private static function normalizeStr(string $text): string
    {
        $text = mb_strtolower($text, 'UTF-8');
        return strtr($text, [
            'ą'=>'a','ć'=>'c','ę'=>'e','ł'=>'l','ń'=>'n',
            'ó'=>'o','ś'=>'s','ź'=>'z','ż'=>'z',
        ]);
    }
}
