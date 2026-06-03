<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportMessage extends Model
{
    protected $fillable = ['user_id', 'subject', 'message', 'is_read', 'admin_reply', 'closed_at'];

    protected $casts = [
        'is_read'   => 'boolean',
        'closed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function replies(): HasMany
    {
        return $this->hasMany(SupportReply::class)->orderBy('created_at');
    }

    public function isClosed(): bool
    {
        return $this->closed_at !== null;
    }
}
