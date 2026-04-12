<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CampaignTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'store_id',
        'platform',
        'name',
        'payload'
    ];

    protected $casts = [
        'payload' => 'array'
    ];
}
