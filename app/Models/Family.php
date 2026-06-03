<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Family extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'invite_code', 'owner_id', 'is_premium'];

    protected $casts = ['is_premium' => 'boolean'];

    public static function generateInviteCode(): string
    {
        do {
            $code = strtoupper(Str::random(8));
        } while (self::where('invite_code', $code)->exists());

        return $code;
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function members()
    {
        return $this->hasMany(User::class);
    }

    public function storageZones()
    {
        return $this->hasMany(StorageZone::class)->orderBy('sort_order');
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function shoppingListItems()
    {
        return $this->hasMany(ShoppingListItem::class);
    }

    public function customRecipes()
    {
        return $this->hasMany(CustomRecipe::class)->orderByDesc('created_at');
    }
}
