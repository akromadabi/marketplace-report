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
        Schema::create('promo_shopee_values', function (Blueprint $table) {
            $table->id();
            $table->integer('store_id')->nullable();
            $table->string('product_id')->nullable();
            $table->string('sku_id')->nullable();
            $table->string('product_name')->nullable();
            $table->string('seller_sku')->nullable();
            $table->string('variation_value')->nullable();
            $table->integer('harga_promo')->nullable();
            $table->integer('stok_promo')->nullable();
            $table->integer('stok_saat_ini')->nullable();
            $table->integer('batas_pembelian')->nullable();
            $table->integer('saran_harga')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('promo_shopee_values');
    }
};
