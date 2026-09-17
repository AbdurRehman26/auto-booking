<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $row = DB::table('editor_configurations')->where('key', 'notification_providers');
        $providers = json_decode($row->value('value'), true, 512, JSON_THROW_ON_ERROR);
        foreach ($providers as $key => &$provider) {
            $provider['input_type'] = match ($key) {
                'whatsapp' => 'tel',
                'telegram' => 'text',
                'email' => 'email',
                default => 'url',
            };
        }
        unset($provider);
        $providers['slack']['destination'] = 'Slack webhook URL';
        $providers['email'] ??= [
            'label' => 'Email', 'destination' => 'Recipient email address',
            'placeholder' => 'you@example.com', 'input_type' => 'email', 'subject' => true,
            'help' => 'Sends through Resend. Configure RESEND_API_KEY and a verified MAIL_FROM_ADDRESS on the server.',
        ];
        $row->update(['value' => json_encode($providers, JSON_THROW_ON_ERROR)]);
    }

    public function down(): void
    {
        // Preserve provider settings referenced by saved workflow steps.
    }
};
