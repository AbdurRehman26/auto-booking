<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
        $types = json_decode(DB::table('editor_configurations')->where('key', 'step_types')->value('value'), true, 512, JSON_THROW_ON_ERROR);

        $settings = DB::table('editor_configurations')->whereIn('key', ['intervals', 'channels', 'triggers', 'schedule_fields'])->pluck('value', 'key')->map(fn ($value) => json_decode($value, true, 512, JSON_THROW_ON_ERROR));

        $fields = $settings['schedule_fields'][$this->input('interval', '')] ?? [];

        return [
            'name' => ['required', 'string', 'max:160'],
            'status' => ['nullable', 'string', 'max:30'],
            'url' => ['nullable', 'url:http,https', 'max:2000'],
            'interval' => ['required', 'string', Rule::in($settings['intervals'])],
            'schedule' => [Rule::requiredIf(count($fields) > 0), 'nullable', 'array:time,timezone,days,date,repeat_minutes,repeat_custom'],
            'schedule.time' => [Rule::requiredIf(in_array('time', $fields) && ! $this->input('schedule.repeat_minutes')), 'nullable', 'date_format:H:i'],
            'schedule.repeat_minutes' => ['sometimes', 'integer', 'between:0,1440'],
            'schedule.repeat_custom' => ['sometimes', 'boolean'],
            'schedule.timezone' => [Rule::requiredIf(count($fields) > 0), 'nullable', 'timezone'],
            'schedule.days' => [Rule::requiredIf(in_array('days', $fields)), 'nullable', 'array', 'min:1', 'max:7'],
            'schedule.days.*' => ['integer', 'between:0,6', 'distinct'],
            'schedule.date' => [Rule::requiredIf(in_array('date', $fields)), 'nullable', 'date_format:Y-m-d'],
            'pause' => ['required', 'boolean'],
            'steps' => ['array'], 'steps.*.type' => ['required', 'string', Rule::in(array_keys($types))], 'steps.*.text' => ['required', 'string', 'max:6000'],
            'notifications' => ['array'], 'notifications.*.channel' => ['required', Rule::in(array_keys($settings['channels']))],
            'notifications.*.trigger' => ['required', Rule::in(array_keys($settings['triggers']))],
            'notifications.*.step' => ['nullable', 'integer', 'min:0'], 'notifications.*.destination' => ['required', 'string', 'max:2000'],
            'notifications.*.message' => ['nullable', 'string', 'max:4000'],
        ];
    }
}
