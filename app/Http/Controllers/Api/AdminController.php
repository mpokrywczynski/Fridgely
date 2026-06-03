<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function setPremium(Request $request)
    {
        $secret = config('app.admin_secret');

        if (empty($secret) || $request->input('secret') !== $secret) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'family_id' => 'required|integer|exists:families,id',
            'premium'   => 'required|boolean',
        ]);

        $family = Family::findOrFail($validated['family_id']);
        $family->update(['is_premium' => $validated['premium']]);

        return response()->json([
            'family_id'  => $family->id,
            'name'       => $family->name,
            'is_premium' => $family->is_premium,
        ]);
    }
}
