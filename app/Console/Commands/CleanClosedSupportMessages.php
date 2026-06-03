<?php

namespace App\Console\Commands;

use App\Models\SupportMessage;
use Illuminate\Console\Command;

class CleanClosedSupportMessages extends Command
{
    protected $signature   = 'support:clean';
    protected $description = 'Usuwa zamknięte zgłoszenia support starsze niż 7 dni';

    public function handle(): void
    {
        $deleted = SupportMessage::whereNotNull('closed_at')
            ->where('closed_at', '<=', now()->subDays(7))
            ->delete();

        $this->info("Usunięto {$deleted} zamkniętych zgłoszeń.");
    }
}
