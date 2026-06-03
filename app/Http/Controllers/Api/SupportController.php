<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use App\Models\SupportReply;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $messages = SupportMessage::where('user_id', $request->user()->id)
            ->with('replies')
            ->orderByDesc('created_at')
            ->get(['id', 'subject', 'message', 'admin_reply', 'is_read', 'closed_at', 'created_at', 'updated_at']);

        return response()->json($messages);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => 'required|string|max:191',
            'message' => 'required|string|max:5000',
        ]);

        SupportMessage::create([
            'user_id' => $request->user()->id,
            'subject' => $data['subject'],
            'message' => $data['message'],
        ]);

        return response()->json(['message' => 'Wiadomość wysłana. Odpowiemy wkrótce!']);
    }

    public function reply(Request $request, SupportMessage $message): JsonResponse
    {
        if ($message->user_id !== $request->user()->id) {
            abort(403);
        }
        if ($message->isClosed()) {
            return response()->json(['message' => 'To zgłoszenie jest zamknięte.'], 422);
        }

        $data = $request->validate(['body' => 'required|string|max:5000']);

        SupportReply::create([
            'support_message_id' => $message->id,
            'body'               => $data['body'],
            'is_admin'           => false,
        ]);

        $message->update(['is_read' => false]);

        return response()->json(['message' => 'Odpowiedź dodana.']);
    }

    public function close(Request $request, SupportMessage $message): JsonResponse
    {
        if ($message->user_id !== $request->user()->id) {
            abort(403);
        }

        $message->update(['closed_at' => now()]);

        return response()->json(['message' => 'Zgłoszenie zostało zamknięte.']);
    }
}
