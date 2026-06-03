<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FoodShareMessage extends Model
{
    protected $fillable = ['food_share_id', 'user_id', 'thread_user_id', 'body'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function foodShare()
    {
        return $this->belongsTo(FoodShare::class);
    }
}
