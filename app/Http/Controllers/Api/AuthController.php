<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\StorageZone;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:191',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => 'owner',
        ]);

        $family = Family::create([
            'name'        => $data['name'] . "'s Family",
            'invite_code' => Family::generateInviteCode(),
            'owner_id'    => $user->id,
        ]);

        $user->update(['family_id' => $family->id]);

        $this->createDefaultZones($family);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user'   => $user->load('family'),
            'token'  => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Nieprawidłowy email lub hasło.'],
            ]);
        }

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user'  => $user->load('family'),
            'token' => $token,
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json(['message' => 'Link do resetowania hasła został wysłany na podany adres e-mail.']);
        }

        return response()->json(['message' => 'Nie znaleziono konta z tym adresem e-mail.'], 422);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'                 => 'required|string',
            'email'                 => 'required|email',
            'password'              => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password)])->save();
                $user->tokens()->delete();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Hasło zostało zmienione. Możesz się teraz zalogować.']);
        }

        return response()->json(['message' => 'Link wygasł lub jest nieprawidłowy. Wyślij nowy link.'], 422);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Wylogowano pomyślnie.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->load('family'));
    }

    private function createDefaultZones(Family $family): void
    {
        $zones = [
            ['name' => 'Lodówka',     'type' => 'fridge',  'icon' => '🧊', 'sort_order' => 1],
            ['name' => 'Zamrażalnik', 'type' => 'freezer', 'icon' => '❄️',  'sort_order' => 2],
            ['name' => 'Szafka',      'type' => 'pantry',  'icon' => '🗄️', 'sort_order' => 3],
            ['name' => 'Spiżarnia',   'type' => 'pantry',  'icon' => '🪴', 'sort_order' => 4],
        ];

        foreach ($zones as $zone) {
            StorageZone::create(array_merge($zone, ['family_id' => $family->id]));
        }
    }
}
