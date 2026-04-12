<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ModalController extends Controller
{
    // GET /api/modal?store_id=X
    public function index(Request $request)
    {
        $storeId = $request->query('store_id');
        $query = DB::table('modal_values')->select('seller_sku', 'sku_id', 'variation', 'value');
        if ($storeId) $query->where('store_id', $storeId);
        $rows = $query->get();

        $result = [];
        foreach ($rows as $row) {
            if ($row->variation) {
                $key = "{$row->seller_sku}||{$row->sku_id}||{$row->variation}";
            } else {
                $key = $row->seller_sku;
            }
            $result[$key] = (string) $row->value;
        }
        return response()->json($result);
    }

    // PUT /api/modal — batch save
    public function saveAll(Request $request)
    {
        $values  = $request->input('values');
        $storeId = $request->input('store_id');
        if (!$values || !is_array($values)) {
            return response()->json(['error' => 'Values harus berupa object'], 400);
        }

        foreach ($values as $key => $val) {
            $numericValue = (int) preg_replace('/[^0-9]/', '', (string) $val) ?: 0;
            $parts = explode('||', $key);
            $sellerSku = $parts[0] ?? '';
            $skuId     = $parts[1] ?? '';
            $variation = $parts[2] ?? '';

            if ($storeId) {
                DB::statement("INSERT INTO modal_values (store_id, seller_sku, sku_id, variation, value)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE value = VALUES(value)",
                    [$storeId, $sellerSku, $skuId, $variation, $numericValue]);
            } else {
                DB::statement("INSERT INTO modal_values (seller_sku, sku_id, variation, value)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE value = VALUES(value)",
                    [$sellerSku, $skuId, $variation, $numericValue]);
            }
        }
        return response()->json(['success' => true]);
    }

    // PUT /api/modal/single
    public function saveSingle(Request $request)
    {
        $key     = $request->input('key');
        $val     = $request->input('value');
        $storeId = $request->input('store_id');
        if (!$key) return response()->json(['error' => 'Key wajib diisi'], 400);

        $numericValue = (int) preg_replace('/[^0-9]/', '', (string) $val) ?: 0;
        $parts = explode('||', $key);
        $sellerSku = $parts[0] ?? '';
        $skuId     = $parts[1] ?? '';
        $variation = $parts[2] ?? '';

        if ($storeId) {
            DB::statement("INSERT INTO modal_values (store_id, seller_sku, sku_id, variation, value)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE value = VALUES(value)",
                [$storeId, $sellerSku, $skuId, $variation, $numericValue]);
        } else {
            DB::statement("INSERT INTO modal_values (seller_sku, sku_id, variation, value)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE value = VALUES(value)",
                [$sellerSku, $skuId, $variation, $numericValue]);
        }
        return response()->json(['success' => true]);
    }
}
