<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workflow extends Model
{
    protected $fillable = ['public_id', 'name', 'status', 'start_url', 'check_interval', 'pause_on_error', 'schedule', 'schedule_enabled', 'scheduled_notifications'];

    protected function casts(): array
    {
        return ['pause_on_error' => 'boolean', 'schedule' => 'array', 'schedule_enabled' => 'boolean', 'scheduled_notifications' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function steps(): HasMany
    {
        return $this->hasMany(WorkflowStep::class)->orderBy('position');
    }

    public function notificationRules(): HasMany
    {
        return $this->hasMany(NotificationRule::class);
    }
}
