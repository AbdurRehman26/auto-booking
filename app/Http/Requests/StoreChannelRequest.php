<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StoreChannelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $providers = json_decode(DB::table('editor_configurations')->where('key', 'notification_providers')->value('value'), true, 512, JSON_THROW_ON_ERROR);
        $destination = ['required', 'string', 'max:2000'];
        $destination[] = match ($this->input('provider')) {
            'email' => 'email',
            'whatsapp' => 'regex:/^\+[1-9]\d{6,14}$/',
            'telegram' => 'regex:/^(@[A-Za-z0-9_]{5,}|-?\d+)$/',
            default => 'url:https',
        };

        return ['name' => ['required', 'string', 'max:160'], 'provider' => ['required', Rule::in(array_keys($providers))], 'destination' => $destination];
    }
}
