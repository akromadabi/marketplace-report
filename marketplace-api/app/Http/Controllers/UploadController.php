<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UploadController extends Controller
{
    private function pruneData(array $data, string $category): array
    {
        $orderWhitelist = [
            'order id',
            'order status',
            'product name',
            'seller sku',
            'sku id',
            'variation',
            'quantity',
            'cancel reason',
            'tracking id',
            'pembeli',
            'nama penerima',
            'recipient',
            'username (buyer)',
            'buyer username',
            'phone #',
            'city',
            'kota / kabupaten',
            'kota/kabupaten',
            'regency and city',
            'districts',
            'province',
            'provinsi',
            'alamat',
            'detail address',
            'payment method',
            'shipping provider name',
            'opsi pengiriman',
            'delivered time',
            'cancelled time',
            'waktu pesanan dibuat',
            'created time',
            'shipped time',
            'channel marketplace',
            'order amount',
            'total pembayaran',
            'harga asli produk'
        ];

        $paymentWhitelist = [
            'order/adjustment id',
            'no. pesanan',
            'total settlement amount',
            'total penghasilan',
            'customer payment',
            'total pembayaran pembeli',
            'affiliate commission',
            'komisi affiliate',
            'return shipping costs (passed on to the customer)',
            'tanggal dana dilepaskan',
            'waktu pesanan dibuat',
            'order created time',
            'order settled time',
            'metode pembayaran pembeli',
            'biaya layanan',
            'biaya administrasi',
            'biaya proses pesanan',
            'channel marketplace'
        ];

        $returnWhitelist = [
            'order id',
            'return order id',
            'return status',
            'return sub status',
            'return logistics tracking id',
            'product name',
            'sku id',
            'seller sku',
            'sku name',
            'buyer username',
            'return type',
            'return reason',
            'return quantity',
            'return unit price',
            'refund amount',
            'order amount',
            'order status',
            'order substatus',
            'payment method',
            'time requested',
            'refund time',
            'dispute status',
            'appeal status',
            'compensation status',
            'compensation amount',
            'buyer note',
            'channel marketplace'
        ];

        $whitelist = [];
        if ($category === 'orders')
            $whitelist = array_flip($orderWhitelist);
        elseif ($category === 'payments')
            $whitelist = array_flip($paymentWhitelist);
        elseif ($category === 'return' || $category === 'returns')
            $whitelist = array_flip($returnWhitelist);
        else
            return $data; // pengembalian or unknown keep as is

        return array_map(function ($row) use ($whitelist) {
            $newRow = [];
            foreach ($row as $k => $v) {
                $trimmedKey = trim((string) $k);
                if (isset($whitelist[strtolower($trimmedKey)])) {
                    $newRow[$trimmedKey] = $v;
                }
            }
            return $newRow;
        }, $data);
    }

    public function history(Request $request)
    {
        $userId = $request->filled('user_id') ? $request->query('user_id') : null;
        $storeId = $request->filled('store_id') ? $request->query('store_id') : null;

        $query = DB::table('uploads as u')
            ->leftJoin('users as us', 'u.user_id', '=', 'us.id')
            ->select('u.*', 'us.name as uploaded_by')
            ->orderBy('u.created_at', 'desc')
            ->limit(10000);

        if ($storeId && $userId) {
            // Include uploads scoped to this store OR orphan uploads (no store) from this user
            $query->where(function ($q) use ($storeId, $userId) {
                $q->where('u.store_id', $storeId)
                    ->orWhere(function ($q2) use ($userId) {
                        $q2->whereNull('u.store_id')->where('u.user_id', $userId);
                    });
            });
        } elseif ($storeId) {
            $query->where('u.store_id', $storeId);
        } elseif ($userId) {
            $query->where('u.user_id', $userId);
        }

        $results = $query->get();

        $grouped = [];
        foreach ($results as $item) {
            $baseName = preg_replace('/ \(Part \d+\/\d+\)$/', '', $item->filename);

            $date = substr($item->created_at, 0, 10);
            $key = $baseName . '|' . $item->category . '|' . $item->store_id . '|' . $date;

            if (!isset($grouped[$key])) {
                $grouped[$key] = (object) [
                    'id' => (string) $item->id,
                    'filename' => $baseName,
                    'category' => $item->category,
                    'platform' => $item->platform,
                    'row_count' => 0,
                    'skipped_rows' => 0,
                    'created_at' => $item->created_at,
                    'uploaded_by' => $item->uploaded_by,
                    'user_id' => $item->user_id,
                    'store_id' => $item->store_id,
                ];
            } else {
                $grouped[$key]->id .= ',' . $item->id;
                if ($item->created_at > $grouped[$key]->created_at) {
                    $grouped[$key]->created_at = $item->created_at;
                }
            }
            $grouped[$key]->row_count += ($item->row_count ?? 0);
            $grouped[$key]->skipped_rows += ($item->skipped_rows ?? 0);
        }

        $groupedList = array_values($grouped);
        usort($groupedList, fn($a, $b) => strcmp($b->created_at, $a->created_at));

        return response()->json(array_slice($groupedList, 0, 100));
    }

    // DELETE /api/upload/:id
    public function destroy($id)
    {
        $ids = array_filter(explode(',', $id));
        DB::table('orders')->whereIn('upload_id', $ids)->delete();
        DB::table('payments')->whereIn('upload_id', $ids)->delete();
        DB::table('returns_data')->whereIn('upload_id', $ids)->delete();
        DB::table('pengembalian')->whereIn('upload_id', $ids)->delete();
        DB::table('uploads')->whereIn('id', $ids)->delete();
        return response()->json(['success' => true]);
    }

    // POST /api/upload-parsed (Bypass PhpSpreadsheet)
    public function uploadParsed(Request $request)
    {
        try {
            ini_set('memory_limit', '-1');
            set_time_limit(0);
            $userId = $request->input('user_id');
            $storeId = $request->input('store_id');
            $filesData = $request->input('files_data'); // array of {filename, platform, category, jsonData}

            $results = ['orders' => 0, 'payments' => 0, 'returns' => 0, 'pengembalian' => 0];
            $skipped = ['orders' => 0, 'payments' => 0, 'returns' => 0, 'pengembalian' => 0];

            if (!is_array($filesData))
                return response()->json(['error' => 'Invalid data payload'], 400);

            // Phase 1: Limits check
            $totalNewOrders = array_sum(array_map(fn($f) => $f['category'] === 'orders' ? count($f['jsonData']) : 0, $filesData));
            if ($userId && $totalNewOrders > 0) {
                $user = DB::table('users')->where('id', $userId)->first();
                if ($user && $user->class) {
                    $lim = DB::table('class_limits')->where('class_name', $user->class)->first();
                    if ($lim && $lim->max_orders != -1) {
                        $existingCount = DB::table('orders')
                            ->whereIn('upload_id', DB::table('uploads')->where('user_id', $userId)->pluck('id'))
                            ->count();
                        if ($existingCount + $totalNewOrders > $lim->max_orders) {
                            return response()->json([
                                'error' => "Batas pesanan kelas {$user->class} adalah {$lim->max_orders}. Anda sudah memiliki {$existingCount} pesanan."
                            ], 403);
                        }
                    }
                }
            }

            // Pre-prune all incoming filesData once so hashes match Phase 3
            foreach ($filesData as &$fdataRef) {
                $catRef = $fdataRef['category'] ?? 'unknown';
                if ($catRef !== 'unknown' && !empty($fdataRef['jsonData'])) {
                    $fdataRef['jsonData'] = $this->pruneData($fdataRef['jsonData'], $catRef);
                }
            }
            unset($fdataRef);

            // Phase 2: Deduplication setup
            $existingOrderIds = [];
            $existingHashes = ['payments' => [], 'returns_data' => [], 'pengembalian' => []];
            $existingPaymentOrderIds = [];

            if ($storeId) {
                $incomingOrderIds = [];
                $incomingHashes = ['payments' => [], 'returns_data' => [], 'pengembalian' => []];
                $incomingPaymentOidsByHash = [];

                foreach ($filesData as $fdata) {
                    $cat = $fdata['category'] ?? 'unknown';
                    $jsonData = $fdata['jsonData'] ?? [];
                    if (empty($jsonData))
                        continue;

                    if ($cat === 'orders') {
                        foreach ($jsonData as $row) {
                            $oid = (string) ($row['Order ID'] ?? '');
                            if ($oid)
                                $incomingOrderIds[] = $oid;
                        }
                    } else {
                        $table = match ($cat) {
                            'payments' => 'payments',
                            'return' => 'returns_data',
                            'pengembalian' => 'pengembalian',
                            default => null
                        };
                        if ($table) {
                            $rows = $cat === 'pengembalian'
                                ? array_map(fn($r) => array_merge((array) $r, ['Channel Marketplace' => 'Pengembalian']), $jsonData)
                                : $jsonData;

                            foreach ($rows as $row) {
                                $hash = md5(json_encode($row));
                                $incomingHashes[$table][] = $hash;

                                if ($cat === 'payments') {
                                    foreach (array_keys((array) $row) as $k) {
                                        if (str_contains(strtolower($k), 'order/adjustment') || str_contains(strtolower($k), 'no. pesanan')) {
                                            $payOid = trim((string) ($row[$k] ?? ''));
                                            if ($payOid && $payOid !== '/')
                                                $incomingPaymentOidsByHash[$hash] = $payOid;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (!empty($incomingOrderIds)) {
                    $oids = array_unique($incomingOrderIds);
                    foreach (array_chunk($oids, 1000) as $chunk) {
                        $rows = DB::table('orders as o')
                            ->join('uploads as u', 'o.upload_id', '=', 'u.id')
                            ->where('u.store_id', $storeId)
                            ->whereIn('o.order_id', $chunk)
                            ->select('o.order_id')
                            ->distinct()
                            ->get();
                        foreach ($rows as $r)
                            $existingOrderIds[$r->order_id] = true;
                    }
                }

                foreach (['payments' => 'payments', 'returns_data' => 'returns_data', 'pengembalian' => 'pengembalian'] as $table => $tableVal) {
                    if (!empty($incomingHashes[$table])) {
                        $hashes = array_unique($incomingHashes[$table]);
                        foreach (array_chunk($hashes, 1000) as $chunk) {
                            $rows = DB::table($table . ' as t')
                                ->join('uploads as u', 't.upload_id', '=', 'u.id')
                                ->where('u.store_id', $storeId)
                                ->whereNotNull('t.content_hash')
                                ->whereIn('t.content_hash', $chunk)
                                ->select('t.content_hash')
                                ->get();
                            foreach ($rows as $r)
                                $existingHashes[$table][$r->content_hash] = true;
                        }
                    }
                }

                // Only check payment Order IDs for rows not already matched by indexed content_hash
                $unmatchedPaymentOids = [];
                foreach ($incomingPaymentOidsByHash as $hash => $payOid) {
                    if (!isset($existingHashes['payments'][$hash])) {
                        $unmatchedPaymentOids[] = $payOid;
                    }
                }

                if (!empty($unmatchedPaymentOids)) {
                    $oids = array_unique($unmatchedPaymentOids);
                    foreach (array_chunk($oids, 1000) as $chunk) {
                        $payRows = DB::table('payments as t')
                            ->join('uploads as u', 't.upload_id', '=', 'u.id')
                            ->where('u.store_id', $storeId)
                            ->where(function ($q) use ($chunk) {
                                $q->whereIn(DB::raw("JSON_UNQUOTE(JSON_EXTRACT(t.data, '$.\"Order/adjustment ID\"'))"), $chunk)
                                    ->orWhereIn(DB::raw("JSON_UNQUOTE(JSON_EXTRACT(t.data, '$.\"Order/Adjustment No.\"'))"), $chunk)
                                    ->orWhereIn(DB::raw("JSON_UNQUOTE(JSON_EXTRACT(t.data, '$.\"No. Pesanan\"'))"), $chunk);
                            })
                            ->select('t.data')
                            ->get();

                        foreach ($payRows as $pr) {
                            $d = is_string($pr->data) ? json_decode($pr->data, true) : (array) $pr->data;
                            foreach (array_keys($d) as $k) {
                                if (str_contains(strtolower($k), 'order/adjustment') || str_contains(strtolower($k), 'no. pesanan')) {
                                    $oid = trim((string) ($d[$k] ?? ''));
                                    if ($oid && $oid !== '/' && $oid !== 'null') {
                                        $existingPaymentOrderIds[$oid] = true;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Phase 3: Insert
            foreach ($filesData as $fdata) {
                $category = $fdata['category'] ?? 'unknown';
                $platform = $fdata['platform'] ?? 'unknown';
                $jsonData = $fdata['jsonData'] ?? [];
                $filename = $fdata['filename'] ?? 'uploaded_file.xlsx';
                if ($category === 'unknown' || empty($jsonData))
                    continue;

                $channel = ucfirst($platform);

                if ($category === 'orders') {
                    $newRows = array_filter($jsonData, function ($row) use (&$existingOrderIds) {
                        $oid = (string) ($row['Order ID'] ?? '');
                        return $oid && !isset($existingOrderIds[$oid]);
                    });
                    $newRows = array_values($newRows);
                    $skippedCount = count($jsonData) - count($newRows);
                    $skipped['orders'] += $skippedCount;

                    if (count($newRows) > 0 || $skippedCount > 0) {
                        $uploadId = DB::table('uploads')->insertGetId([
                            'user_id' => $userId,
                            'store_id' => $storeId,
                            'filename' => $filename,
                            'category' => $category,
                            'platform' => $platform,
                            'row_count' => count($newRows),
                            'skipped_rows' => $skippedCount,
                            'created_at' => now(),
                        ]);

                        foreach (array_chunk($newRows, 500) as $chunk) {
                            $inserts = array_map(fn($row) => [
                                'upload_id' => $uploadId,
                                'order_id' => (string) ($row['Order ID'] ?? ''),
                                'channel' => $channel,
                                'data' => json_encode($row),
                                'created_at' => now(),
                            ], $chunk);
                            DB::table('orders')->insert($inserts);
                            foreach ($chunk as $r)
                                $existingOrderIds[(string) ($r['Order ID'] ?? '')] = true;
                        }
                        $results['orders'] += count($newRows);
                    }
                } else {
                    $tableName = match ($category) {
                        'payments' => 'payments',
                        'return' => 'returns_data',
                        'pengembalian' => 'pengembalian',
                        default => null,
                    };
                    $resultKey = match ($category) { 'return' => 'returns', default => $category};
                    if (!$tableName)
                        continue;

                    $rows = $category === 'pengembalian'
                        ? array_map(fn($r) => array_merge((array) $r, ['Channel Marketplace' => 'Pengembalian']), $jsonData)
                        : $jsonData;

                    $newRows = [];
                    foreach ($rows as $row) {
                        $jsonStr = json_encode($row);
                        $hash = md5($jsonStr);

                        if (isset($existingHashes[$tableName][$hash])) {
                            $skipped[$resultKey]++;
                            continue;
                        }

                        if ($category === 'payments') {
                            foreach (array_keys((array) $row) as $k) {
                                if (str_contains(strtolower($k), 'order/adjustment') || str_contains(strtolower($k), 'no. pesanan')) {
                                    $payOid = trim((string) ($row[$k] ?? ''));
                                    if ($payOid && $payOid !== '/' && isset($existingPaymentOrderIds[$payOid])) {
                                        $skipped[$resultKey]++;
                                        continue 2;
                                    }
                                    if ($payOid && $payOid !== '/')
                                        $existingPaymentOrderIds[$payOid] = true;
                                    break;
                                }
                            }
                        }

                        $existingHashes[$tableName][$hash] = true;
                        $newRows[] = ['jsonStr' => $jsonStr, 'hash' => $hash];
                    }

                    $skippedCount = count($rows) - count($newRows);
                    if (count($newRows) > 0 || $skippedCount > 0) {
                        $uploadId = DB::table('uploads')->insertGetId([
                            'user_id' => $userId,
                            'store_id' => $storeId,
                            'filename' => $filename,
                            'category' => $category,
                            'platform' => $platform,
                            'row_count' => count($newRows),
                            'skipped_rows' => $skippedCount,
                            'created_at' => now(),
                        ]);

                        foreach (array_chunk($newRows, 500) as $chunk) {
                            $inserts = array_map(fn($r) => [
                                'upload_id' => $uploadId,
                                'data' => $r['jsonStr'],
                                'content_hash' => $r['hash'],
                                'created_at' => now(),
                            ], $chunk);
                            DB::table($tableName)->insert($inserts);
                        }
                        $results[$resultKey] += count($newRows);
                    }
                }
            }

            $totalSkipped = array_sum($skipped);
            return response()->json(['success' => true, 'results' => $results, 'skipped' => $skipped, 'totalSkipped' => $totalSkipped]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'API Backend Error: ' . $e->getMessage() . ' at line ' . $e->getLine()
            ], 400);
        }
    }

    // POST /api/upload/assign-store
    // Assign semua orphan uploads (store_id IS NULL) milik user ke store tertentu
    public function assignStore(Request $request)
    {
        $userId = $request->input('user_id');
        $storeId = $request->input('store_id');
        if (!$userId || !$storeId) {
            return response()->json(['error' => 'user_id dan store_id wajib'], 400);
        }
        $updated = DB::table('uploads')
            ->where('user_id', $userId)
            ->whereNull('store_id')
            ->update(['store_id' => $storeId]);
        return response()->json(['success' => true, 'updated' => $updated]);
    }
}
