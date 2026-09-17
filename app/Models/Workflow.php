<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class Workflow extends Model
{
    protected $fillable = ['public_id', 'name', 'status', 'start_url', 'check_interval', 'pause_on_error'];

    protected function casts(): array { return ['pause_on_error' => 'boolean']; }
    public function steps(): HasMany { return $this->hasMany(WorkflowStep::class)->orderBy('position'); }
    public function notificationRules(): HasMany { return $this->hasMany(NotificationRule::class); }
}
