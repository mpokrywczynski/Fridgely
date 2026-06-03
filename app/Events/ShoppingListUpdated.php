<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ShoppingListUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int    $familyId,
        public string $action,
        public mixed  $item,
    ) {}

    public function broadcastOn(): Channel
    {
        return new PrivateChannel('family.' . $this->familyId);
    }

    public function broadcastAs(): string
    {
        return 'shopping.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'item'   => is_object($this->item) ? $this->item->toArray() : $this->item,
        ];
    }
}
