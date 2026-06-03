<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomRecipe;
use App\Models\CustomRecipeIngredient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CustomRecipeController extends Controller
{
    // GET /api/recipes/custom
    public function index(Request $request)
    {
        $recipes = $request->user()->family
            ->customRecipes()
            ->with('ingredients')
            ->get()
            ->map(fn($r) => $this->toSummary($r));

        return response()->json($recipes);
    }

    // POST /api/recipes/custom
    public function store(Request $request)
    {
        $v = Validator::make($request->all(), [
            'title'            => ['required', 'string', 'max:255'],
            'instructions'     => ['nullable', 'string'],
            'servings'         => ['nullable', 'integer', 'min:1', 'max:100'],
            'ready_in_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'image_url'        => ['nullable', 'url', 'max:500'],
            'ingredients'      => ['nullable', 'array'],
            'ingredients.*.name'   => ['required', 'string', 'max:100'],
            'ingredients.*.amount' => ['nullable', 'numeric', 'min:0'],
            'ingredients.*.unit'   => ['nullable', 'string', 'max:50'],
        ]);

        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        $user = $request->user();
        $recipe = CustomRecipe::create([
            'family_id'        => $user->family_id,
            'created_by'       => $user->id,
            'title'            => $request->title,
            'instructions'     => $request->instructions,
            'servings'         => $request->servings,
            'ready_in_minutes' => $request->ready_in_minutes,
            'image_url'        => $request->image_url,
        ]);

        $this->syncIngredients($recipe, $request->ingredients ?? []);

        return response()->json($this->toDetail($recipe->fresh(['ingredients'])), 201);
    }

    // GET /api/recipes/custom/{id}
    public function show(Request $request, int $id)
    {
        $recipe = $request->user()->family->customRecipes()->with('ingredients')->find($id);
        if (!$recipe) return response()->json(['message' => 'Nie znaleziono przepisu'], 404);

        return response()->json($this->toDetail($recipe));
    }

    // PUT /api/recipes/custom/{id}
    public function update(Request $request, int $id)
    {
        $recipe = $request->user()->family->customRecipes()->find($id);
        if (!$recipe) return response()->json(['message' => 'Nie znaleziono przepisu'], 404);

        $v = Validator::make($request->all(), [
            'title'            => ['required', 'string', 'max:255'],
            'instructions'     => ['nullable', 'string'],
            'servings'         => ['nullable', 'integer', 'min:1', 'max:100'],
            'ready_in_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'image_url'        => ['nullable', 'url', 'max:500'],
            'ingredients'      => ['nullable', 'array'],
            'ingredients.*.name'   => ['required', 'string', 'max:100'],
            'ingredients.*.amount' => ['nullable', 'numeric', 'min:0'],
            'ingredients.*.unit'   => ['nullable', 'string', 'max:50'],
        ]);

        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        $recipe->update([
            'title'            => $request->title,
            'instructions'     => $request->instructions,
            'servings'         => $request->servings,
            'ready_in_minutes' => $request->ready_in_minutes,
            'image_url'        => $request->image_url,
        ]);

        $this->syncIngredients($recipe, $request->ingredients ?? []);

        return response()->json($this->toDetail($recipe->fresh(['ingredients'])));
    }

    // DELETE /api/recipes/custom/{id}
    public function destroy(Request $request, int $id)
    {
        $recipe = $request->user()->family->customRecipes()->find($id);
        if (!$recipe) return response()->json(['message' => 'Nie znaleziono przepisu'], 404);

        $recipe->delete();
        return response()->json(null, 204);
    }

    // ── Helpers ───────────────────────────────────────────────

    private function syncIngredients(CustomRecipe $recipe, array $ingredients): void
    {
        $recipe->ingredients()->delete();
        foreach ($ingredients as $i => $ing) {
            CustomRecipeIngredient::create([
                'recipe_id'  => $recipe->id,
                'name'       => trim($ing['name']),
                'amount'     => $ing['amount'] ?? null,
                'unit'       => $ing['unit'] ?? null,
                'sort_order' => $i,
            ]);
        }
    }

    private function toDetail(CustomRecipe $recipe): array
    {
        return [
            'id'               => $recipe->id,
            'title'            => $recipe->title,
            'image'            => $recipe->image_url,
            'servings'         => $recipe->servings,
            'readyInMinutes'   => $recipe->ready_in_minutes,
            'instructions'     => $recipe->instructions,
            'source'           => 'custom',
            'extendedIngredients' => $recipe->ingredients->map(fn($ing) => [
                'id'           => $ing->id,
                'name'         => $ing->name,
                'originalName' => $ing->name,
                'amount'       => $ing->amount,
                'unit'         => $ing->unit ?? '',
            ])->values()->toArray(),
        ];
    }

    private function toSummary(CustomRecipe $recipe): array
    {
        return [
            'id'    => $recipe->id,
            'title' => $recipe->title,
            'image' => $recipe->image_url,
            'source' => 'custom',
            'ingredientsCount' => $recipe->ingredients->count(),
        ];
    }
}
