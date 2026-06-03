<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'family_id', 'storage_zone_id', 'added_by',
        'name', 'name_raw', 'category',
        'quantity', 'unit', 'price', 'barcode',
        'purchase_date', 'expiry_date',
        'opened_at', 'opened_expiry_date',
        'is_consumed', 'consumed_at',
        'is_wasted',  'wasted_at',
    ];

    protected $casts = [
        'purchase_date'      => 'date',
        'expiry_date'        => 'date',
        'opened_at'          => 'datetime',
        'opened_expiry_date' => 'date',
        'consumed_at'        => 'datetime',
        'is_consumed'        => 'boolean',
        'wasted_at'          => 'datetime',
        'is_wasted'          => 'boolean',
        'quantity'           => 'float',
        'price'              => 'float',
    ];

    public function family()
    {
        return $this->belongsTo(Family::class);
    }

    public function storageZone()
    {
        return $this->belongsTo(StorageZone::class);
    }

    public function addedBy()
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function markOpened(): void
    {
        $rule = ExpiryRule::findForProduct($this->name);
        $daysOpened = $rule?->days_opened ?? 3;

        $this->update([
            'opened_at'          => now(),
            'opened_expiry_date' => now()->addDays($daysOpened)->toDateString(),
        ]);
    }

    public function markConsumed(): void
    {
        $this->update([
            'is_consumed'  => true,
            'consumed_at'  => now(),
        ]);
    }

    public function markWasted(): void
    {
        $this->update([
            'is_wasted' => true,
            'wasted_at' => now(),
        ]);
    }

    public function getEffectiveExpiryDateAttribute(): ?Carbon
    {
        if ($this->opened_expiry_date) {
            return $this->opened_expiry_date;
        }
        return $this->expiry_date;
    }

    public function getDaysUntilExpiryAttribute(): ?int
    {
        $date = $this->effective_expiry_date;
        return $date ? (int) now()->startOfDay()->diffInDays($date, false) : null;
    }

    public function scopeActive($query)
    {
        return $query->where('is_consumed', false)->where('is_wasted', false);
    }

    public function scopeExpiringSoon($query, int $days = 3)
    {
        return $query->active()
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<=', now()->addDays($days)->toDateString());
    }
}
