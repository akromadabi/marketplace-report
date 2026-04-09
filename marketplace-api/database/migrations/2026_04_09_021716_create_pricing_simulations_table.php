<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pricing_simulations', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('platform')->nullable();
            $table->integer('hpp')->default(0);
            $table->integer('harga_jual')->default(0);
            $table->integer('harga_awal')->default(0);
            $table->decimal('admin_fee_pct', 8, 2)->default(0);
            $table->decimal('affiliate_fee_pct', 8, 2)->default(0);
            $table->integer('ad_spend')->default(0);
            $table->decimal('markup_pct', 8, 2)->default(0);
            $table->string('target_margin_mode')->nullable();
            $table->integer('target_margin_value')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pricing_simulations');
    }
};
