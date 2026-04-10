<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PromoShopeeController extends Controller
{
    // GET /api/promo-shopee?store_id=X
    public function index(Request $request)
    {
        $storeId = $request->query('store_id');
        $query = DB::table('promo_shopee_values');
        if ($storeId) clone $query->where('store_id', $storeId);
        // Wait, clone isn't right if I just do $query->where(). 
        // Let's do standard builder.
        if ($storeId) $query->where('store_id', $storeId);
        return response()->json($query->orderByDesc('id')->get());
    }

    // POST /api/promo-shopee/upload
    public function upload(Request $request)
    {
        $products = $request->input('products');
        $storeId  = $request->input('store_id');

        if (!is_array($products)) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        DB::transaction(function () use ($products, $storeId) {
            foreach ($products as $p) {
                $matchArgs = [
                    'store_id'   => $storeId,
                    'product_id' => $p['product_id'] ?? null,
                    'sku_id'     => $p['sku_id'] ?? null,
                ];

                $existing = DB::table('promo_shopee_values')->where($matchArgs)->first();

                DB::table('promo_shopee_values')->updateOrInsert(
                    $matchArgs,
                    [
                        'product_name'    => $p['product_name'] ?? null,
                        'seller_sku'      => $p['seller_sku'] ?? null,
                        'variation_value' => $p['variation_value'] ?? null,
                        'stok_saat_ini'   => $p['stok_saat_ini'] ?? null,
                        // Di Shopee, rekomendasi harga kadang langsung datang dari Excel waktu di-upload
                        'saran_harga'     => $p['saran_harga'] ?? null,
                        // Batas pembelian bisa datang dari Excel:
                        'batas_pembelian' => $p['batas_pembelian'] ?? ($existing ? $existing->batas_pembelian : null),
                        
                        'harga_promo'     => $existing ? $existing->harga_promo : null,
                        'stok_promo'      => $existing ? $existing->stok_promo : null,
                        'updated_at'      => now(),
                        'created_at'      => $existing ? $existing->created_at : now(),
                    ]
                );
            }
        });

        return response()->json(['success' => true]);
    }

    // PUT /api/promo-shopee/batch
    public function batch(Request $request)
    {
        $updates = $request->input('updates');
        $storeId = $request->input('store_id');

        if (!is_array($updates)) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        DB::transaction(function () use ($updates, $storeId) {
            foreach ($updates as $u) {
                if (!isset($u['id'])) continue;

                $payload = ['updated_at' => now()];
                if (array_key_exists('harga_promo', $u)) $payload['harga_promo'] = $u['harga_promo'];
                if (array_key_exists('stok_promo', $u))  $payload['stok_promo']  = $u['stok_promo'];
                if (array_key_exists('batas_pembelian', $u)) $payload['batas_pembelian'] = $u['batas_pembelian'];

                DB::table('promo_shopee_values')->where('id', $u['id'])->update($payload);
            }
        });

        return response()->json(['success' => true]);
    }

    // DELETE /api/promo-shopee
    public function destroy(Request $request)
    {
        $ids = $request->input('ids');
        if (!is_array($ids) || count($ids) === 0) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        DB::table('promo_shopee_values')->whereIn('id', $ids)->delete();
        return response()->json(['success' => true]);
    }
}
