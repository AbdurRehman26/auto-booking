<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreWorkflowRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'status' => ['nullable', 'string', 'max:30'],
            'url' => ['nullable', 'url:http,https', 'max:2000'],
            'interval' => ['required', 'string', 'max:60'],
            'pause' => ['required', 'boolean'],
            'steps' => ['array'], 'steps.*.type' => ['required', 'string', 'max:30'], 'steps.*.text' => ['required', 'string', 'max:2000'],
            'notifications' => ['array'], 'notifications.*.channel' => ['required', 'in:email,slack,whatsapp,webhook'],
            'notifications.*.trigger' => ['required', 'in:failure,availability,complete,step'],
            'notifications.*.step' => ['nullable', 'integer', 'min:0'], 'notifications.*.destination' => ['required', 'string', 'max:2000'],
            'notifications.*.message' => ['nullable', 'string', 'max:4000'],
        ];
    }
}
