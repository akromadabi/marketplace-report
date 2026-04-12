<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PromoController extends Controller
{
    // GET /api/promo?store_id=X
    public function index(Request $request)
    {
        $storeId = $request->query('store_id');
        $query = DB::table('promo_values');
        if ($storeId) $query->where('store_id', $storeId);
        return response()->json($query->orderByDesc('id')->get());
    }

    // POST /api/promo/upload — upsert products from Excel parse, does NOT overwrite harga_promo/stok_promo
    public function upload(Request $request)
    {
        $products = $request->input('products');
        $storeId  = $request->input('store_id');

        if (!is_array($products)) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        foreach ($products as $p) {
            $matchArgs = [
                'store_id'   => $storeId,
                'product_id' => $p['product_id'] ?? null,
                'sku_id'     => $p['sku_id'] ?? null,
            ];

            // Keep existing harga_promo / stok_promo intact
            $existing = DB::table('promo_values')->where($matchArgs)->first();

            DB::table('promo_values')->updateOrInsert(
                $matchArgs,
                [
                    'product_name'    => $p['product_name'] ?? null,
                    'seller_sku'      => $p['seller_sku'] ?? null,
                    'variation_value' => $p['variation_value'] ?? null,
                    'stok_saat_ini'   => $p['stok_saat_ini'] ?? null,
                    'harga_promo'     => $existing ? $existing->harga_promo : null,
                    'stok_promo'      => $existing ? $existing->stok_promo : null,
                    'updated_at'      => now(),
                    'created_at'      => $existing ? $existing->created_at : now(),
                ]
            );
        }

        return response()->json(['success' => true]);
    }

    // PUT /api/promo/batch — save harga_promo / stok_promo per ID
    public function batch(Request $request)
    {
        $updates = $request->input('updates');
        $storeId = $request->input('store_id');

        if (!is_array($updates)) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        foreach ($updates as $u) {
            if (!isset($u['id'])) continue;

            $payload = ['updated_at' => now()];
            if (array_key_exists('harga_promo', $u)) $payload['harga_promo'] = $u['harga_promo'];
            if (array_key_exists('stok_promo', $u))  $payload['stok_promo']  = $u['stok_promo'];

            DB::table('promo_values')->where('id', $u['id'])->update($payload);
        }

        return response()->json(['success' => true]);
    }

    // DELETE /api/promo — delete by array of IDs
    public function destroy(Request $request)
    {
        $ids = $request->input('ids');
        if (!is_array($ids) || count($ids) === 0) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        DB::table('promo_values')->whereIn('id', $ids)->delete();
        return response()->json(['success' => true]);
    }
}
