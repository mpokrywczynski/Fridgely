<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StorageZone extends Model
{
    use HasFactory;

    protected $fillable = ['family_id', 'name', 'type', 'icon', 'sort_order'];

    public function family()
    {
        return $this->belongsTo(Family::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class)->where('is_consumed', false);
    }
}
