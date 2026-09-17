<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Channel extends Model
{
    protected $fillable = ['name', 'provider', 'destination'];

    protected function casts(): array
    {
        return ['destination' => 'encrypted'];
    }
}
