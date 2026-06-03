<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomRecipe extends Model
{
    protected $fillable = [
        'family_id', 'created_by', 'title',
        'instructions', 'servings', 'ready_in_minutes', 'image_url',
    ];

    public function ingredients()
    {
        return $this->hasMany(CustomRecipeIngredient::class, 'recipe_id')
                    ->orderBy('sort_order');
    }

    public function family()
    {
        return $this->belongsTo(Family::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
