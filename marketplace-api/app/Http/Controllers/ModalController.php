<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class ModalController extends Controller
{
    // GET /api/modal/catalog?store_id=X&user_id=Y
    public function catalog(Request $request)
    {
        $storeId = $request->query('store_id');
        $userId = $request->query('user_id');

        $uploadIds = null;
        if ($storeId || $userId) {
            $uQuery = DB::table('uploads')->select('id');
            if ($storeId && $userId) {
                $uQuery->where(function ($q) use ($storeId, $userId) {
                    $q->where('store_id', $storeId)
                      ->orWhere(function ($q2) use ($userId) {
                          $q2->whereNull('store_id')->where('user_id', $userId);
                      });
                });
            } elseif ($storeId) {
                $uQuery->where('store_id', $storeId);
            } else {
                $uQuery->where('user_id', $userId);
            }
            $uploadIds = $uQuery->pluck('id')->toArray();
            if (empty($uploadIds)) {
                return response()->json([]);
            }
        }

        $maxUploadId = $uploadIds ? max($uploadIds) : (DB::table('uploads')->max('id') ?? 0);
        $cntUploads  = $uploadIds ? count($uploadIds) : (DB::table('uploads')->count() ?? 0);
        $cacheKey    = "sku_catalog_v2_{$storeId}_{$userId}_{$cntUploads}_{$maxUploadId}";

        $catalog = Cache::store('file')->remember($cacheKey, 86400, function () use ($uploadIds) {
            $query = DB::table('orders')->select('id', 'data', 'channel');
            if ($uploadIds !== null) {
                $query->whereIn('upload_id', $uploadIds);
            }

            $uniqueMap = [];
            $query->chunkById(5000, function ($rows) use (&$uniqueMap) {
                foreach ($rows as $r) {
                    $d = is_string($r->data) ? json_decode($r->data, true) : (array) $r->data;
                    if (!is_array($d)) continue;
                    $sellerSku   = trim((string) ($d['Seller SKU'] ?? ''));
                    $skuId       = trim((string) ($d['SKU ID'] ?? ''));
                    $variation   = trim((string) ($d['Variation'] ?? ''));
                    $productName = trim((string) ($d['Product Name'] ?? ''));
                    if ($sellerSku === '' && $productName === '') continue;

                    $skuKey = $sellerSku !== '' ? $sellerSku : "__NSKU__{$productName}";
                    $key = "{$skuKey}||{$skuId}||{$variation}";
                    if (!isset($uniqueMap[$key])) {
                        $uniqueMap[$key] = [
                            'Seller SKU'          => $sellerSku,
                            'SKU ID'              => $skuId,
                            'Variation'           => $variation,
                            'Product Name'        => $productName,
                            'Channel Marketplace' => $r->channel ?? ($d['Channel Marketplace'] ?? ''),
                        ];
                    } elseif ($uniqueMap[$key]['Product Name'] === '' && $productName !== '') {
                        $uniqueMap[$key]['Product Name'] = $productName;
                    }
                }
            });

            return array_values($uniqueMap);
        });

        return response()->json($catalog);
    }

    // GET /api/modal?store_id=X
    public function index(Request $request)
    {
        $storeId = $request->query('store_id');
        $query = DB::table('modal_values')->select('store_id', 'seller_sku', 'sku_id', 'variation', 'value');
        if ($storeId) {
            // Ambil data spesifik store_id ATAU fallback ke nilai default (store_id IS NULL)
            $query->where(function ($q) use ($storeId) {
                $q->where('store_id', $storeId)
                  ->orWhereNull('store_id');
            })->orderByRaw('CASE WHEN store_id IS NOT NULL THEN 1 ELSE 0 END ASC');
        }
        $rows = $query->get();

        $result = [];
        foreach ($rows as $row) {
            if ($row->variation) {
                $key = "{$row->seller_sku}||{$row->sku_id}||{$row->variation}";
            } else {
                $key = $row->seller_sku;
            }
            // Nilai toko yang spesifik (bukan NULL) akan menimpa nilai default jika ada duplikasi
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

        DB::transaction(function () use ($values, $storeId) {
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
        });
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
