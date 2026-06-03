<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomRecipeIngredient extends Model
{
    public $timestamps = false;

    protected $fillable = ['recipe_id', 'name', 'amount', 'unit', 'sort_order'];

    protected $casts = [
        'amount'     => 'float',
        'sort_order' => 'integer',
    ];
}
