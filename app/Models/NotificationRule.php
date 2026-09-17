<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class NotificationRule extends Model
{
    protected $fillable = ['channel', 'trigger', 'step_position', 'destination', 'message'];
    public function workflow(): BelongsTo { return $this->belongsTo(Workflow::class); }
}
