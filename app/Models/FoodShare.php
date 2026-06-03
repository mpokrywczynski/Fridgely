<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FoodShare extends Model
{
    protected $fillable = [
        'user_id', 'product_id', 'name', 'description',
        'lat', 'lng', 'status', 'reserved_by', 'expires_at',
    ];

    protected $casts = [
        'lat'        => 'float',
        'lng'        => 'float',
        'expires_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function reservedBy()
    {
        return $this->belongsTo(User::class, 'reserved_by');
    }

    public function messages()
    {
        return $this->hasMany(FoodShareMessage::class)->orderBy('created_at');
    }

    public function scopeNearby($query, float $lat, float $lng, float $km = 5)
    {
        return $query->selectRaw(
            '*, (6371 * acos(LEAST(1.0, cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + sin(radians(?)) * sin(radians(lat))))) AS distance',
            [$lat, $lng, $lat]
        )->having('distance', '<=', $km)->orderBy('distance');
    }
}
