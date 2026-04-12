<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PromoController extends Controller
{
    public function index(Request $request)
    {
        $storeId = $request->query('store_id');
        $query = DB::table('promo_values');
        if ($storeId) $query->where('store_id', $storeId);
        return response()->json($query->orderByDesc('id')->get());
    }

    public function upload(Request $request)
    {
        $products = $request->input('products');
        $storeId = $request->input('store_id');

        if (!is_array($products)) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        foreach ($products as $p) {
            // We use updateOrInsert based on store_id and sku_id. If a product has no sku_id, fallback to product_id + variation_value
            $matchArgs = ['store_id' => $storeId, 'product_id' => $p['product_id'], 'sku_id' => $p['sku_id'] ?? null];
            
            // To ensure we don't accidentally overwrite harga_promo / stok_promo with nulls
            $existing = DB::table('promo_values')->where($matchArgs)->first();
            
            DB::table('promo_values')->updateOrInsert(
                $matchArgs,
                [
                    'product_name' => $p['product_name'] ?? null,
                    'seller_sku' => $p['seller_sku'] ?? null,
                    'variation_value' => $p['variation_value'] ?? null,
                    'harga_promo' => $existing ? $existing->harga_promo : null,
                    'stok_promo' => $existing ? $existing->stok_promo : null,
                    'updated_at' => now(),
                    'created_at' => $existing ? $existing->created_at : now(),
                ]
            );
        }
        return response()->json(['success' => true]);
    }

    public function batch(Request $request)
    {
        $updates = $request->input('updates');
        $storeId = $request->input('store_id');

        if (!is_array($updates)) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        foreach ($updates as $u) {
            if (isset($u['id'])) {
                DB::table('promo_values')->where('id', $u['id'])->update([
                    'harga_promo' => $u['harga_promo'],
                    'stok_promo' => $u['stok_promo'],
                    'updated_at' => now()
                ]);
            }
        }
        return response()->json(['success' => true]);
    }

    public function destroy(Request $request)
    {
        $ids = $request->input('ids');
        if (!is_array($ids)) {
            return response()->json(['error' => 'Invalid data'], 400);
        }

        DB::table('promo_values')->whereIn('id', $ids)->delete();
        return response()->json(['success' => true]);
    }
}
