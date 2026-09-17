<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StartTestRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return app()->environment('local', 'testing');
    }

    public function rules(): array
    {
        $types = json_decode(DB::table('editor_configurations')->where('key', 'step_types')->value('value'), true, 512, JSON_THROW_ON_ERROR);

        return [
            'url' => ['required', 'url:http,https', 'max:2000'],
            'send_notifications' => ['sometimes', 'boolean'],
            'steps' => ['required', 'array', 'min:1', 'max:30'],
            'steps.*.type' => ['required', 'string', Rule::in(array_keys($types))],
            'steps.*.text' => ['required', 'string', 'max:6000'],
        ];
    }
}
