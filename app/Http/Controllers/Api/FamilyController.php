<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\StorageZone;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FamilyController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $family = $request->user()->family()
            ->with(['members'])
            ->withCount(['storageZones'])
            ->firstOrFail();

        $family->setRelation(
            'storage_zones',
            $family->storageZones()->withCount(['products as active_products_count' => fn($q) => $q->where('is_consumed', false)])->get()
        );

        return response()->json($family);
    }

    public function update(Request $request): JsonResponse
    {
        $family = $request->user()->family;
        $this->authorizeOwner($request);

        $data = $request->validate([
            'name' => 'required|string|max:191',
        ]);

        $family->update($data);

        return response()->json($family);
    }

    public function join(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invite_code' => 'required|string|size:8',
        ]);

        $family = Family::where('invite_code', strtoupper($data['invite_code']))->firstOrFail();
        $user = $request->user();

        if ($user->family_id === $family->id) {
            return response()->json(['message' => 'Już należysz do tej rodziny.'], 422);
        }

        $user->update(['family_id' => $family->id, 'role' => 'member']);

        return response()->json($family->load(['members', 'storageZones']));
    }

    public function removeMember(Request $request, User $user): JsonResponse
    {
        $this->authorizeOwner($request);

        $owner = $request->user();

        if ($owner->id === $user->id) {
            return response()->json(['message' => 'Nie możesz usunąć samego siebie z rodziny.'], 422);
        }

        if ($user->family_id !== $owner->family_id) {
            return response()->json(['message' => 'Ten użytkownik nie należy do Twojej rodziny.'], 422);
        }

        $newFamily = Family::create([
            'name'        => $user->name . "'s Family",
            'invite_code' => Family::generateInviteCode(),
        ]);

        $user->update(['family_id' => $newFamily->id, 'role' => 'owner']);

        return response()->json(['message' => 'Użytkownik został usunięty z rodziny.']);
    }

    public function regenerateCode(Request $request): JsonResponse
    {
        $this->authorizeOwner($request);

        $family = $request->user()->family;
        $family->update(['invite_code' => Family::generateInviteCode()]);

        return response()->json(['invite_code' => $family->invite_code]);
    }

    private function authorizeOwner(Request $request): void
    {
        abort_if($request->user()->role !== 'owner', 403, 'Tylko właściciel może wykonać tę akcję.');
    }
}
