<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('fee_profiles', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('store_id')->nullable();
            $table->string('name');
            $table->string('platform'); // shopee, tiktok, general
            $table->decimal('admin_fee_pct', 5, 2)->default(0);
            $table->decimal('affiliate_fee_pct', 5, 2)->default(0);
            $table->decimal('markup_pct', 5, 2)->default(60);
            $table->integer('default_ad_spend')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fee_profiles');
    }
};
