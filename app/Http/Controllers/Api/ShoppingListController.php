<?php

namespace App\Http\Controllers\Api;

use App\Events\ShoppingListUpdated;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ShoppingListItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ShoppingListController extends Controller
{
    // GET /api/shopping-list
    public function index(Request $request)
    {
        $items = $request->user()->family
            ->shoppingListItems()
            ->with('addedBy:id,name', 'boughtBy:id,name')
            ->orderBy('is_bought')
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return response()->json($items);
    }

    // POST /api/shopping-list
    public function store(Request $request)
    {
        $v = Validator::make($request->all(), [
            'name'     => ['required', 'string', 'max:191'],
            'quantity' => ['nullable', 'numeric', 'min:0.01'],
            'unit'     => ['nullable', 'string', 'max:20'],
            'notes'    => ['nullable', 'string', 'max:191'],
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $user = $request->user();
        $item = ShoppingListItem::create([
            'family_id' => $user->family_id,
            'added_by'  => $user->id,
            'name'      => $request->name,
            'quantity'  => $request->quantity,
            'unit'      => $request->unit ?? 'szt.',
            'notes'     => $request->notes,
        ]);

        $item->load('addedBy:id,name');
        $this->broadcastIfConfigured(new ShoppingListUpdated($user->family_id, 'added', $item));

        return response()->json($item, 201);
    }

    // PUT /api/shopping-list/{item}
    public function update(Request $request, ShoppingListItem $item)
    {
        $user = $request->user();
        if ($item->family_id !== $user->family_id) {
            return response()->json(['message' => 'Brak dostępu'], 403);
        }

        $v = Validator::make($request->all(), [
            'name'      => ['sometimes', 'string', 'max:191'],
            'quantity'  => ['nullable', 'numeric', 'min:0.01'],
            'unit'      => ['nullable', 'string', 'max:20'],
            'notes'     => ['nullable', 'string', 'max:191'],
            'is_bought' => ['sometimes', 'boolean'],
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $changes = $request->only(['name', 'quantity', 'unit', 'notes']);

        if ($request->has('is_bought')) {
            $changes['is_bought'] = $request->boolean('is_bought');
            $changes['bought_by'] = $changes['is_bought'] ? $user->id : null;
            $changes['bought_at'] = $changes['is_bought'] ? now()     : null;
        }

        $item->update($changes);
        $item->load('addedBy:id,name', 'boughtBy:id,name');
        $this->broadcastIfConfigured(new ShoppingListUpdated($user->family_id, 'updated', $item));

        return response()->json($item);
    }

    // DELETE /api/shopping-list/{item}
    public function destroy(Request $request, ShoppingListItem $item)
    {
        $user = $request->user();
        if ($item->family_id !== $user->family_id) {
            return response()->json(['message' => 'Brak dostępu'], 403);
        }

        $itemId = $item->id;
        $item->delete();
        $this->broadcastIfConfigured(new ShoppingListUpdated($user->family_id, 'deleted', ['id' => $itemId]));

        return response()->json(null, 204);
    }

    // DELETE /api/shopping-list/clear-bought
    public function clearBought(Request $request)
    {
        $user = $request->user();
        $user->family->shoppingListItems()->where('is_bought', true)->delete();
        $this->broadcastIfConfigured(new ShoppingListUpdated($user->family_id, 'cleared', []));

        return response()->json(['message' => 'Kupione produkty zostały usunięte']);
    }

    // POST /api/shopping-list/move-to-fridge
    public function moveToFridge(Request $request)
    {
        $user = $request->user();

        $v = Validator::make($request->all(), [
            'storage_zone_id' => ['required', 'integer'],
            'item_ids'        => ['nullable', 'array'],
            'item_ids.*'      => ['integer'],
        ]);

        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $zone = $user->family->storageZones()->find($request->storage_zone_id);
        if (!$zone) {
            return response()->json(['message' => 'Strefa nie należy do Twojej rodziny'], 403);
        }

        $query = $user->family->shoppingListItems()->where('is_bought', true);
        if (!empty($request->item_ids)) {
            $query->whereIn('id', $request->item_ids);
        }
        $items = $query->get();

        $added = 0;
        foreach ($items as $item) {
            Product::create([
                'family_id'       => $user->family_id,
                'added_by'        => $user->id,
                'storage_zone_id' => $zone->id,
                'name'            => $item->name,
                'quantity'        => $item->quantity ?? 1,
                'unit'            => rtrim($item->unit ?? 'szt', '.'),
                'purchase_date'   => now()->toDateString(),
            ]);
            $added++;
        }

        return response()->json(['added' => $added, 'zone' => $zone->name]);
    }

    private function broadcastIfConfigured(ShoppingListUpdated $event): void
    {
        if (!config('broadcasting.connections.pusher.key')) {
            return;
        }

        try {
            broadcast($event)->toOthers();
        } catch (\Throwable) {
            // Nie przerywaj żądania z powodu błędu broadcastu
        }
    }
}
