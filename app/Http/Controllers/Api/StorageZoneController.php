<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StorageZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StorageZoneController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $zones = $request->user()->family
            ->storageZones()
            ->withCount(['products as active_products_count' => fn($q) => $q->where('is_consumed', false)])
            ->get();

        return response()->json($zones);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:191',
            'type' => 'required|in:fridge,freezer,pantry,cellar,custom',
            'icon' => 'nullable|string|max:10',
        ]);

        $zone = StorageZone::create(array_merge($data, [
            'family_id'  => $request->user()->family_id,
            'sort_order' => StorageZone::where('family_id', $request->user()->family_id)->max('sort_order') + 1,
        ]));

        return response()->json($zone, 201);
    }

    public function update(Request $request, StorageZone $storageZone): JsonResponse
    {
        $this->authorizeZone($request, $storageZone);

        $data = $request->validate([
            'name' => 'sometimes|string|max:191',
            'icon' => 'sometimes|string|max:10',
        ]);

        $storageZone->update($data);

        return response()->json($storageZone);
    }

    public function destroy(Request $request, StorageZone $storageZone): JsonResponse
    {
        $this->authorizeZone($request, $storageZone);
        $storageZone->delete();

        return response()->json(null, 204);
    }

    private function authorizeZone(Request $request, StorageZone $zone): void
    {
        abort_if($zone->family_id !== $request->user()->family_id, 403);
    }
}
