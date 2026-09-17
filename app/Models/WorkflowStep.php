<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class WorkflowStep extends Model
{
    protected $fillable = ['position', 'type', 'instruction'];
    public function workflow(): BelongsTo { return $this->belongsTo(Workflow::class); }
}
