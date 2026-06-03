<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportReply extends Model
{
    protected $fillable = ['support_message_id', 'body', 'is_admin'];

    protected $casts = ['is_admin' => 'boolean'];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportMessage::class, 'support_message_id');
    }
}
