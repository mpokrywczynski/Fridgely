<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FoodShare;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FoodShareController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (!$request->filled('lat') || !$request->filled('lng')) {
            return response()->json([]);
        }

        $lat    = (float) $request->lat;
        $lng    = (float) $request->lng;
        $userId = $request->user()->id;
        $radius = (float) ($request->radius ?? 5);
        $radius = in_array($radius, [1, 2, 5, 10]) ? $radius : 5;

        // Available shares within chosen radius
        $nearby = FoodShare::with(['user:id,name'])
            ->where('status', 'available')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->nearby($lat, $lng, $radius)
            ->get();

        // Reserved shares where the user is owner or reserved_by (no distance limit)
        $mine = FoodShare::with(['user:id,name'])
            ->where('status', 'reserved')
            ->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)->orWhere('reserved_by', $userId);
            })
            ->get()
            ->each(fn($s) => $s->distance = null);

        $all = $nearby->concat($mine)->unique('id')->values();

        return response()->json($all);
    }

    public function my(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $shares = FoodShare::with(['user:id,name', 'reservedBy:id,name'])
            ->where('status', '!=', 'cancelled')
            ->where(function ($q) use ($userId) {
                $q->where('user_id', $userId)->orWhere('reserved_by', $userId);
            })
            ->orderByDesc('created_at')
            ->get();

        return response()->json($shares);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id'  => 'nullable|integer|exists:products,id',
            'name'        => 'required|string|max:191',
            'description' => 'nullable|string|max:500',
            'lat'         => 'required|numeric|between:-90,90',
            'lng'         => 'required|numeric|between:-180,180',
        ]);

        if (!empty($data['product_id'])) {
            $product = Product::find($data['product_id']);
            abort_if($product->family_id !== $request->user()->family_id, 403);
        }

        $share = FoodShare::create(array_merge($data, [
            'user_id'    => $request->user()->id,
            'expires_at' => now()->addDays(7),
        ]));

        return response()->json($share->load('user:id,name'), 201);
    }

    public function show(Request $request, FoodShare $foodShare): JsonResponse
    {
        $userId = $request->user()->id;
        $isOwner = $foodShare->user_id === $userId;

        $foodShare->load(['user:id,name', 'reservedBy:id,name', 'messages.user:id,name']);

        // Non-owner sees only their own thread (thread_user_id = their id)
        if (!$isOwner) {
            $filtered = $foodShare->messages->filter(
                fn($m) => $m->thread_user_id === $userId
            );
            $foodShare->setRelation('messages', $filtered->values());
        }

        $data = $foodShare->toArray();
        $data['is_reserved_by_me'] = $foodShare->reserved_by === $userId;

        return response()->json($data);
    }

    public function reserve(Request $request, FoodShare $foodShare): JsonResponse
    {
        $userId = $request->user()->id;
        abort_if($foodShare->user_id === $userId, 422, 'Nie możesz zarezerwować własnego ogłoszenia.');
        abort_if($foodShare->status !== 'available', 422, 'To ogłoszenie jest już niedostępne.');

        $foodShare->update(['status' => 'reserved', 'reserved_by' => $userId]);

        return response()->json(
            $foodShare->fresh()->load(['user:id,name', 'reservedBy:id,name', 'messages.user:id,name'])
        );
    }

    public function cancelReserve(Request $request, FoodShare $foodShare): JsonResponse
    {
        $userId = $request->user()->id;
        abort_if(
            $foodShare->reserved_by !== $userId && $foodShare->user_id !== $userId,
            403
        );

        $foodShare->update(['status' => 'available', 'reserved_by' => null]);

        return response()->json(
            $foodShare->fresh()->load(['user:id,name', 'messages.user:id,name'])
        );
    }

    public function give(Request $request, FoodShare $foodShare): JsonResponse
    {
        abort_if($foodShare->user_id !== $request->user()->id, 403);

        $foodShare->update(['status' => 'given']);

        if ($foodShare->product_id) {
            Product::find($foodShare->product_id)?->markConsumed();
        }

        return response()->json(['ok' => true]);
    }

    public function cancel(Request $request, FoodShare $foodShare): JsonResponse
    {
        abort_if($foodShare->user_id !== $request->user()->id, 403);
        $foodShare->update(['status' => 'cancelled']);

        return response()->json(null, 204);
    }

    public function purge(Request $request, FoodShare $foodShare): JsonResponse
    {
        abort_if($foodShare->user_id !== $request->user()->id, 403);
        abort_if(!in_array($foodShare->status, ['given', 'cancelled']), 422, 'Można usunąć tylko zakończone ogłoszenia.');

        $foodShare->delete();

        return response()->json(null, 204);
    }

    public function sendMessage(Request $request, FoodShare $foodShare): JsonResponse
    {
        $userId = $request->user()->id;
        abort_if(
            in_array($foodShare->status, ['given', 'cancelled']),
            422,
            'Ogłoszenie jest zamknięte.'
        );

        $data = $request->validate(['body' => 'required|string|max:1000']);

        $isOwner = $foodShare->user_id === $userId;

        // non-owner: thread belongs to sender; owner: thread_user_id from request
        $threadUserId = $isOwner
            ? (int) $request->input('thread_user_id')
            : $userId;

        $message = $foodShare->messages()->create([
            'user_id'        => $userId,
            'thread_user_id' => $threadUserId ?: null,
            'body'           => $data['body'],
        ]);

        return response()->json($message->load('user:id,name'), 201);
    }
}
