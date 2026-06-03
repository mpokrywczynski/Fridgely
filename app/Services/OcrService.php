<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OcrService
{
    private string $apiKey;
    private string $endpoint = 'https://api.ocr.space/parse/image';

    public function __construct()
    {
        $this->apiKey = config('services.ocr_space.key');
    }

    public function extractText(UploadedFile $image): string
    {
        $response = Http::timeout(30)
            ->attach('file', file_get_contents($image->getRealPath()), $image->getClientOriginalName())
            ->post($this->endpoint, [
                'apikey'            => $this->apiKey,
                'isOverlayRequired' => 'false',
                'detectOrientation' => 'true',
                'scale'             => 'true',
                'OCREngine'         => '1',
            ]);

        if ($response->failed()) {
            throw new RuntimeException('OCR.space: błąd połączenia (' . $response->status() . ')');
        }

        $body = $response->json();

        if (($body['IsErroredOnProcessing'] ?? false) || empty($body['ParsedResults'])) {
            $msg = $body['ErrorMessage'][0] ?? $body['ErrorDetails'] ?? 'Nieznany błąd OCR';
            throw new RuntimeException('OCR.space: ' . $msg);
        }

        return $body['ParsedResults'][0]['ParsedText'] ?? '';
    }
}
