<?php

namespace App\Console\Commands;

use App\Models\FoodShare;
use Illuminate\Console\Command;

class CleanFoodShares extends Command
{
    protected $signature = 'food-shares:clean';
    protected $description = 'Delete given/cancelled food shares older than 7 days';

    public function handle(): void
    {
        $deleted = FoodShare::whereIn('status', ['given', 'cancelled'])
            ->where('updated_at', '<=', now()->subDays(7))
            ->delete();

        $this->info("Deleted {$deleted} food share(s).");
    }
}
