<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpiryRule;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::where('family_id', $request->user()->family_id)
            ->active()
            ->with(['storageZone', 'addedBy:id,name']);

        if ($request->filled('zone')) {
            $query->where('storage_zone_id', $request->zone);
        }

        if ($request->filled('expiring')) {
            $query->expiringSoon((int) $request->expiring);
        }

        $products = $query->orderBy('expiry_date')->get()
            ->map(fn($p) => array_merge($p->toArray(), [
                'days_until_expiry' => $p->days_until_expiry,
                'effective_expiry_date' => $p->effective_expiry_date?->toDateString(),
            ]));

        return response()->json($products);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'            => 'required|string|max:191',
            'storage_zone_id' => 'required|exists:storage_zones,id',
            'quantity'        => 'nullable|numeric|min:0.01',
            'unit'            => 'nullable|string|max:20',
            'price'           => 'nullable|numeric|min:0',
            'purchase_date'   => 'nullable|date',
            'expiry_date'     => 'nullable|date',
            'barcode'         => 'nullable|string|max:50',
            'category'        => 'nullable|string|max:80',
        ]);

        if (empty($data['expiry_date'])) {
            $rule = ExpiryRule::findForProduct($data['name']);
            if ($rule) {
                $from = $data['purchase_date'] ?? now()->toDateString();
                $data['expiry_date'] = Carbon::parse($from)->addDays($rule->days_fresh)->toDateString();
                $data['category'] = $data['category'] ?? $rule->category;
            }
        }

        $product = Product::create(array_merge($data, [
            'family_id'     => $request->user()->family_id,
            'added_by'      => $request->user()->id,
            'purchase_date' => $data['purchase_date'] ?? now()->toDateString(),
        ]));

        return response()->json($product->load('storageZone'), 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($request, $product);

        $data = $request->validate([
            'name'               => 'sometimes|string|max:191',
            'storage_zone_id'    => 'sometimes|exists:storage_zones,id',
            'quantity'           => 'sometimes|numeric|min:0',
            'unit'               => 'sometimes|string|max:20',
            'price'              => 'sometimes|nullable|numeric|min:0',
            'expiry_date'        => 'sometimes|nullable|date',
            'category'           => 'sometimes|nullable|string|max:80',
            'opened_at'          => 'sometimes|nullable|date',
            'opened_expiry_date' => 'sometimes|nullable|date',
        ]);

        $product->update($data);

        return response()->json($product->load('storageZone'));
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($request, $product);
        $product->delete();

        return response()->json(null, 204);
    }

    public function markOpened(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($request, $product);
        $product->markOpened();

        return response()->json([
            'opened_at'          => $product->opened_at,
            'opened_expiry_date' => $product->opened_expiry_date,
        ]);
    }

    public function markConsumed(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($request, $product);
        $product->markConsumed();

        return response()->json(['consumed_at' => $product->consumed_at]);
    }

    public function markWasted(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($request, $product);
        $product->markWasted();

        return response()->json(['wasted_at' => $product->wasted_at]);
    }

    public function findByBarcode(Request $request, string $barcode): JsonResponse
    {
        $product = Product::where('family_id', $request->user()->family_id)
            ->where('barcode', $barcode)
            ->active()
            ->first();

        if (!$product) {
            return response()->json(['message' => 'Produkt nie znaleziony w lodówce'], 404);
        }

        return response()->json($product->load('storageZone'));
    }

    private function authorizeProduct(Request $request, Product $product): void
    {
        abort_if($product->family_id !== $request->user()->family_id, 403);
    }
}
