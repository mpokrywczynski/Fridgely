<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShoppingListItem extends Model
{
    protected $fillable = [
        'family_id', 'added_by', 'name', 'quantity', 'unit',
        'notes', 'is_bought', 'bought_by', 'bought_at', 'sort_order',
    ];

    protected $casts = [
        'is_bought' => 'boolean',
        'bought_at' => 'datetime',
        'quantity'  => 'float',
    ];

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function boughtBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'bought_by');
    }
}
