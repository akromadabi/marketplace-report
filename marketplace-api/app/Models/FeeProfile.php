<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FeeProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'store_id',
        'name',
        'platform',
        'admin_fee_pct',
        'affiliate_fee_pct',
        'markup_pct',
        'default_ad_spend'
    ];
}
