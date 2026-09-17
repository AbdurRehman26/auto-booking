<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StartTestRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return app()->environment('local', 'testing');
    }

    public function rules(): array
    {
        return [
            'url' => ['required', 'url:http,https', 'max:2000'],
            'send_notifications' => ['sometimes', 'boolean'],
            'steps' => ['required', 'array', 'min:1', 'max:30'],
            'steps.*.type' => ['required', 'in:navigate,click,check,enter,wait,review,instruction,condition,scroll,notify'],
            'steps.*.text' => ['required', 'string', 'max:6000'],
        ];
    }
}
