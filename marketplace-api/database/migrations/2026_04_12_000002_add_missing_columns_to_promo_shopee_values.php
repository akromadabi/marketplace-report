<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Menambahkan semua kolom yang dibuat manual (tidak ada di migration sebelumnya)
     * ke tabel promo_shopee_values. Menggunakan hasColumn() agar aman di production.
     */
    public function up(): void
    {
        Schema::table('promo_shopee_values', function (Blueprint $table) {
            if (!Schema::hasColumn('promo_shopee_values', 'store_id')) {
                $table->integer('store_id')->nullable()->after('id');
            }
            if (!Schema::hasColumn('promo_shopee_values', 'product_id')) {
                $table->string('product_id')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'sku_id')) {
                $table->string('sku_id')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'product_name')) {
                $table->string('product_name')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'seller_sku')) {
                $table->string('seller_sku')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'variation_value')) {
                $table->string('variation_value')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'harga_promo')) {
                $table->integer('harga_promo')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'stok_promo')) {
                $table->integer('stok_promo')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'stok_saat_ini')) {
                $table->integer('stok_saat_ini')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'batas_pembelian')) {
                $table->integer('batas_pembelian')->nullable();
            }
            if (!Schema::hasColumn('promo_shopee_values', 'saran_harga')) {
                $table->integer('saran_harga')->nullable();
            }
        });
    }

    public function down(): void
    {
        $cols = [
            'store_id', 'product_id', 'sku_id', 'product_name', 'seller_sku',
            'variation_value', 'harga_promo', 'stok_promo', 'stok_saat_ini',
            'batas_pembelian', 'saran_harga',
        ];
        Schema::table('promo_shopee_values', function (Blueprint $table) use ($cols) {
            foreach ($cols as $col) {
                if (Schema::hasColumn('promo_shopee_values', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
