<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class UploadController extends Controller
{
    // ─── Header Maps ────────────────────────────────────────────────
    private array $shopeeOrdersHeaders  = ["no. pesanan", "status pesanan", "status pembatalan/ pengembalian", "no. resi", "opsi pengiriman", "antar ke counter/ pick-up"];
    private array $shopeeReturnHeaders  = ["no. pengembalian", "no. pesanan", "solusi pengembalian barang/dana", "tipe pengembalian", "status pembatalan/ pengembalian"];
    private array $shopeeHeaderMap = [
        "no. pesanan" => "Order ID", "status pesanan" => "Order Status",
        "nomor referensi sku" => "SKU ID", "sku induk" => "Seller SKU",
        "nama produk" => "Product Name", "nama variasi" => "Variation",
        "jumlah produk di pesan" => "Quantity", "total pembayaran" => "Order Amount",
        "waktu pesanan dibuat" => "Created Time", "waktu pengiriman diatur" => "Shipped Time",
        "waktu pesanan selesai" => "Delivered Time", "alasan pembatalan" => "Cancel Reason",
        "no. resi" => "Tracking ID", "opsi pengiriman" => "Shipping Provider Name",
        "catatan dari pembeli" => "Buyer Message", "username (pembeli)" => "Buyer Username",
        "no. telepon" => "Phone #", "provinsi" => "Province",
        "kota/kabupaten" => "Regency and City", "alamat pengiriman" => "Detail Address",
        "metode pembayaran" => "Payment Method",
    ];

    private function detectPlatformAndCategory(array $headers, array $sheetNames): array
    {
        $normalized = array_map(fn($h) => strtolower(trim($h)), $headers);
        $tiktokOrdersH   = ["order id","order status","order substatus","cancelation/return type","normal or pre-order","sku id","seller sku","product name","variation"];
        $tiktokPaymentsH = ["order/adjustment id","total settlement amount","total revenue","subtotal after seller discounts","customer payment"];
        $tiktokPaymentsFlex = ["order created time","order settled time"];
        $tiktokReturnH   = ["return order id","order id","order amount","order status","order substatus","payment method","sku id"];

        if (in_array('Income', $sheetNames)) return ['platform' => 'shopee', 'category' => 'payments'];
        if (!array_diff($this->shopeeReturnHeaders, $normalized)) return ['platform' => 'shopee', 'category' => 'return'];
        if (!array_diff($this->shopeeOrdersHeaders, $normalized)) return ['platform' => 'shopee', 'category' => 'orders'];

        $hasTanggal = (bool) preg_grep('/tanggal/', $normalized);
        $hasResi    = (bool) preg_grep('/resi/', $normalized);
        if ($hasTanggal && $hasResi) return ['platform' => 'none', 'category' => 'pengembalian'];

        if (!array_diff($tiktokOrdersH, $normalized) && count($normalized) >= count($tiktokOrdersH))
            return ['platform' => 'tiktok', 'category' => 'orders'];

        $hasTiktokPayments = !array_diff($tiktokPaymentsH, $normalized)
            && count(array_filter($tiktokPaymentsFlex, fn($p) => (bool) preg_grep('/^'.preg_quote($p,'/').'/', $normalized))) === count($tiktokPaymentsFlex);
        if ($hasTiktokPayments && count($normalized) >= count($tiktokPaymentsH))
            return ['platform' => 'tiktok', 'category' => 'payments'];

        if (!array_diff($tiktokReturnH, $normalized) && count($normalized) >= count($tiktokReturnH))
            return ['platform' => 'tiktok', 'category' => 'return'];

        return ['platform' => 'unknown', 'category' => 'unknown'];
    }

    private function mapShopeeHeaders(array $data): array
    {
        return array_map(function ($row) {
            $newRow = [];
            foreach ($row as $k => $v) {
                $lk = strtolower(trim($k));
                if (isset($this->shopeeHeaderMap[$lk])) $newRow[$this->shopeeHeaderMap[$lk]] = $v;
            }
            return $newRow;
        }, $data);
    }

    private function mapShopeeIncomeToStandard(array $data): array
    {
        return array_map(function ($row) {
            return [
                'Order/adjustment ID' => $row['No. Pesanan'] ?? '',
                'Total settlement amount' => (float)($row['Total Penghasilan'] ?? 0),
                'Customer payment' => (float)($row['Harga Asli Produk'] ?? 0),
                'Affiliate commission' => 0,
                'Return shipping costs (passed on to the customer)' => (float)($row['Ongkos Kirim Pengembalian Barang'] ?? 0),
                'Tanggal Dana Dilepaskan' => $row['Tanggal Dana Dilepaskan'] ?? '',
                'Waktu Pesanan Dibuat' => $row['Waktu Pesanan Dibuat'] ?? '',
                'Metode pembayaran pembeli' => $row['Metode pembayaran pembeli'] ?? '',
                'Biaya Layanan' => (float)($row['Biaya Layanan'] ?? 0),
                'Biaya Administrasi' => (float)($row['Biaya Administrasi'] ?? 0),
                'Biaya Proses Pesanan' => (float)($row['Biaya Proses Pesanan'] ?? 0),
                'Channel Marketplace' => 'Shopee',
            ];
        }, $data);
    }

    private function mapShopeeReturnToStandard(array $data): array
    {
        $statusMap = [
            'dana dikembalikan ke pembeli' => 'Completed',
            'sedang diproses' => 'In Process',
            'ditolak' => 'Rejected',
            'selesai' => 'Completed',
        ];
        return array_map(function ($row) use ($statusMap) {
            $statusRaw = strtolower(trim($row['Status Pembatalan/ Pengembalian'] ?? ''));
            return [
                'Order ID' => $row['No. Pesanan'] ?? '',
                'Return Order ID' => $row['No. Pengembalian'] ?? '',
                'Return Status' => $statusMap[$statusRaw] ?? ($row['Status Pembatalan/ Pengembalian'] ?? ''),
                'Return Logistics Tracking ID' => $row['No. Resi Pengembalian Barang'] ?? '',
                'Product Name' => $row['Nama Produk'] ?? '',
                'Return Type' => $row['Tipe Pengembalian'] ?? '',
                'Return Reason' => $row['Alasan Pengembalian'] ?? '',
                'Refund Amount' => $row['Total Pengembalian Dana'] ?? '',
                'Channel Marketplace' => 'Shopee',
            ];
        }, $data);
    }

    private function formatDateIndo($date): string
    {
        if (!($date instanceof \DateTime)) return '';
        $days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        $months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        return sprintf('%s, %02d %s %d (%02d:%02d)',
            $days[(int)$date->format('w')],
            (int)$date->format('j'),
            $months[(int)$date->format('n') - 1],
            (int)$date->format('Y'),
            (int)$date->format('G'),
            (int)$date->format('i')
        );
    }

    private function readSheetToArray(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet, int $headerRow = 0): array
    {
        $data = [];
        $highestRow = $sheet->getHighestRow();
        $highestCol = $sheet->getHighestColumn();
        $highestColIndex = Coordinate::columnIndexFromString($highestCol);

        // Read headers (using getCell with coordinate string)
        $headers = [];
        for ($col = 1; $col <= $highestColIndex; $col++) {
            $colStr = Coordinate::stringFromColumnIndex($col);
            $cell   = $sheet->getCell($colStr . ($headerRow + 1));
            $val    = $cell->getValue();
            $headers[$col] = $val !== null ? (string)$val : '';
        }

        // Read rows
        for ($row = $headerRow + 2; $row <= $highestRow; $row++) {
            $rowData = [];
            $hasData = false;
            for ($col = 1; $col <= $highestColIndex; $col++) {
                $colStr = Coordinate::stringFromColumnIndex($col);
                $cell   = $sheet->getCell($colStr . $row);
                $val    = $cell->getValue();
                // Preserve large numbers as string
                if (is_float($val) && abs($val) > PHP_INT_MAX) {
                    $val = $cell->getFormattedValue();
                }
                $key = $headers[$col];
                if ($key !== '') {
                    $rowData[$key] = $val ?? '';
                    if ($val !== null && $val !== '') $hasData = true;
                }
            }
            if ($hasData) $data[] = $rowData;
        }
        return $data;
    }

    // POST /api/upload
    public function upload(Request $request)
    {
        ini_set('memory_limit', '-1');
        set_time_limit(0);
        $userId  = $request->input('user_id');
        $storeId = $request->input('store_id');
        $results = ['orders' => 0, 'payments' => 0, 'returns' => 0, 'pengembalian' => 0];
        $skipped = ['orders' => 0, 'payments' => 0, 'returns' => 0, 'pengembalian' => 0];

        $files = $request->file('files') ?? [];
        if (!is_array($files)) $files = [$files];

        // Phase 1: Parse all files
        $parsedFiles = [];
        foreach ($files as $file) {
            try {
                $reader = IOFactory::createReaderForFile($file->getRealPath());
                $reader->setReadDataOnly(true);
                $spreadsheet = $reader->load($file->getRealPath());

                $sheetNames  = $spreadsheet->getSheetNames();
                $sheet       = $spreadsheet->getActiveSheet();

                // Build header list from first row
                $highestColIndex = Coordinate::columnIndexFromString($sheet->getHighestColumn());
                $headers = [];
                for ($col = 1; $col <= $highestColIndex; $col++) {
                    $colStr = Coordinate::stringFromColumnIndex($col);
                    $h = $sheet->getCell($colStr . '1')->getValue();
                    if ($h !== null) $headers[] = (string)$h;
                }

                ['platform' => $platform, 'category' => $category] = $this->detectPlatformAndCategory($headers, $sheetNames);
                if ($category === 'unknown') continue;

                $jsonData = [];

                if ($platform === 'shopee' && $category === 'payments') {
                    // Shopee Income sheet has headers on row 6, data from row 7
                    if (!in_array('Income', $sheetNames)) continue;
                    $incomeSheet = $spreadsheet->getSheetByName('Income');
                    $jsonData    = $this->mapShopeeIncomeToStandard($this->readSheetToArray($incomeSheet, 5));
                } else {
                    $jsonData = $this->readSheetToArray($sheet, 0);
                }

                if ($platform === 'tiktok' && $category === 'orders') {
                    $jsonData = array_slice($jsonData, 1); // Skip first row (TikTok header row)
                }
                if ($platform === 'shopee' && $category === 'orders')  $jsonData = $this->mapShopeeHeaders($jsonData);
                if ($platform === 'shopee' && $category === 'return')   $jsonData = $this->mapShopeeReturnToStandard($jsonData);

                if ($category === 'pengembalian') {
                    $jsonData = array_map(function ($row) {
                        foreach ($row as $k => $v) {
                            if (preg_match('/tanggal|date/i', $k) && $v !== null && $v !== '') {
                                // PhpSpreadsheet returns dates as float (Excel serial)
                                if (is_float($v) || is_int($v)) {
                                    $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float)$v);
                                    $row[$k] = $this->formatDateIndo($dt);
                                }
                            }
                        }
                        return $row;
                    }, $jsonData);
                }

                $parsedFiles[] = ['file' => $file, 'platform' => $platform, 'category' => $category, 'jsonData' => $jsonData];
            } catch (\Exception $e) {
                \Log::error('Upload parse error: '.$e->getMessage());
                continue;
            }
        }

        // Phase 2: Check order limits
        $totalNewOrders = array_sum(array_map(
            fn($f) => $f['category'] === 'orders' ? count($f['jsonData']) : 0,
            $parsedFiles
        ));
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
                            'error' => "Batas pesanan kelas {$user->class} adalah {$lim->max_orders}. Anda sudah memiliki {$existingCount} pesanan dan mencoba menambah {$totalNewOrders} pesanan baru."
                        ], 403);
                    }
                }
            }
        }

        // Phase 3: Insert with deduplication
        $existingOrderIds = [];
        if ($storeId && !empty(array_filter($parsedFiles, fn($f) => $f['category'] === 'orders'))) {
            $rows = DB::select('SELECT DISTINCT o.order_id FROM orders o JOIN uploads u ON o.upload_id = u.id WHERE u.store_id = ?', [$storeId]);
            $existingOrderIds = array_flip(array_column($rows, 'order_id'));
        }

        $existingHashes = ['payments' => [], 'returns_data' => [], 'pengembalian' => []];
        $existingPaymentOrderIds = [];
        if ($storeId) {
            foreach (['payments', 'returns_data', 'pengembalian'] as $table) {
                $rows = DB::select("SELECT t.content_hash FROM {$table} t JOIN uploads u ON t.upload_id = u.id WHERE u.store_id = ? AND t.content_hash IS NOT NULL", [$storeId]);
                $existingHashes[$table] = array_flip(array_column($rows, 'content_hash'));
            }
            $payRows = DB::select('SELECT t.data FROM payments t JOIN uploads u ON t.upload_id = u.id WHERE u.store_id = ?', [$storeId]);
            foreach ($payRows as $pr) {
                $d = is_string($pr->data) ? json_decode($pr->data, true) : (array)$pr->data;
                foreach (array_keys($d) as $k) {
                    if (str_contains(strtolower($k), 'order/adjustment') || str_contains(strtolower($k), 'no. pesanan')) {
                        $oid = trim((string)($d[$k] ?? ''));
                        if ($oid && $oid !== '/') $existingPaymentOrderIds[$oid] = true;
                        break;
                    }
                }
            }
        }

        foreach ($parsedFiles as ['file' => $file, 'platform' => $platform, 'category' => $category, 'jsonData' => $jsonData]) {
            $channel = ucfirst($platform);

            if ($category === 'orders') {
                $newRows = array_filter($jsonData, function ($row) use (&$existingOrderIds) {
                    $oid = (string)($row['Order ID'] ?? '');
                    return $oid && !isset($existingOrderIds[$oid]);
                });
                $newRows     = array_values($newRows);
                $skippedCount = count($jsonData) - count($newRows);
                $skipped['orders'] += $skippedCount;

                $uploadId = DB::table('uploads')->insertGetId([
                    'user_id'      => $userId,
                    'store_id'     => $storeId,
                    'filename'     => $file->getClientOriginalName(),
                    'category'     => $category,
                    'platform'     => $platform,
                    'row_count'    => count($newRows),
                    'skipped_rows' => $skippedCount,
                    'created_at'   => now(),
                ]);

                foreach (array_chunk($newRows, 500) as $chunk) {
                    $inserts = array_map(fn($row) => [
                        'upload_id' => $uploadId,
                        'order_id'  => (string)($row['Order ID'] ?? ''),
                        'channel'   => $channel,
                        'data'      => json_encode($row),
                        'created_at'=> now(),
                    ], $chunk);
                    DB::table('orders')->insert($inserts);
                    foreach ($chunk as $r) $existingOrderIds[(string)($r['Order ID'] ?? '')] = true;
                }
                $results['orders'] += count($newRows);

            } else {
                $tableName = match($category) {
                    'payments'     => 'payments',
                    'return'       => 'returns_data',
                    'pengembalian' => 'pengembalian',
                    default        => null,
                };
                $resultKey = match($category) {
                    'return'       => 'returns',
                    default        => $category,
                };
                if (!$tableName) continue;

                $rows = $category === 'pengembalian'
                    ? array_map(fn($r) => array_merge($r, ['Channel Marketplace' => 'Pengembalian']), $jsonData)
                    : $jsonData;

                $newRows = [];
                foreach ($rows as $row) {
                    $jsonStr = json_encode($row);
                    $hash    = md5($jsonStr);

                    if (isset($existingHashes[$tableName][$hash])) { $skipped[$resultKey]++; continue; }

                    if ($category === 'payments') {
                        foreach (array_keys($row) as $k) {
                            $lk = strtolower($k);
                            if (str_contains($lk, 'order/adjustment') || str_contains($lk, 'no. pesanan')) {
                                $payOid = trim((string)($row[$k] ?? ''));
                                if ($payOid && $payOid !== '/' && isset($existingPaymentOrderIds[$payOid])) {
                                    $skipped[$resultKey]++; continue 2;
                                }
                                if ($payOid && $payOid !== '/') $existingPaymentOrderIds[$payOid] = true;
                                break;
                            }
                        }
                    }

                    $existingHashes[$tableName][$hash] = true;
                    $newRows[] = ['jsonStr' => $jsonStr, 'hash' => $hash];
                }

                $skippedCount = count($rows) - count($newRows);
                $uploadId = DB::table('uploads')->insertGetId([
                    'user_id'      => $userId,
                    'store_id'     => $storeId,
                    'filename'     => $file->getClientOriginalName(),
                    'category'     => $category,
                    'platform'     => $platform,
                    'row_count'    => count($newRows),
                    'skipped_rows' => $skippedCount,
                    'created_at'   => now(),
                ]);

                foreach (array_chunk($newRows, 500) as $chunk) {
                    $inserts = array_map(fn($r) => [
                        'upload_id'    => $uploadId,
                        'data'         => $r['jsonStr'],
                        'content_hash' => $r['hash'],
                        'created_at'   => now(),
                    ], $chunk);
                    DB::table($tableName)->insert($inserts);
                }
                $results[$resultKey] += count($newRows);
            }
        }

        $totalSkipped = array_sum($skipped);
        return response()->json(['success' => true, 'results' => $results, 'skipped' => $skipped, 'totalSkipped' => $totalSkipped]);
    }

    // GET /api/upload/history
    public function history(Request $request)
    {
        $query = DB::table('uploads as u')
            ->leftJoin('users as us', 'u.user_id', '=', 'us.id')
            ->select('u.*', 'us.name as uploaded_by')
            ->orderBy('u.created_at', 'desc')
            ->limit(100);
        if ($request->filled('user_id'))  $query->where('u.user_id', $request->query('user_id'));
        if ($request->filled('store_id')) $query->where('u.store_id', $request->query('store_id'));
        return response()->json($query->get());
    }

    // DELETE /api/upload/:id
    public function destroy($id)
    {
        DB::table('orders')->where('upload_id', $id)->delete();
        DB::table('payments')->where('upload_id', $id)->delete();
        DB::table('returns_data')->where('upload_id', $id)->delete();
        DB::table('pengembalian')->where('upload_id', $id)->delete();
        DB::table('uploads')->where('id', $id)->delete();
        return response()->json(['success' => true]);
    }

    // POST /api/upload-parsed (Bypass PhpSpreadsheet)
    public function uploadParsed(Request $request)
    {
        ini_set('memory_limit', '-1');
        set_time_limit(0);
        $userId  = $request->input('user_id');
        $storeId = $request->input('store_id');
        $filesData = $request->input('files_data'); // array of {filename, platform, category, jsonData}

        $results = ['orders' => 0, 'payments' => 0, 'returns' => 0, 'pengembalian' => 0];
        $skipped = ['orders' => 0, 'payments' => 0, 'returns' => 0, 'pengembalian' => 0];

        if (!is_array($filesData)) return response()->json(['error' => 'Invalid data payload'], 400);

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

        // Phase 2: Deduplication setup
        $existingOrderIds = [];
        $existingHashes = ['payments' => [], 'returns_data' => [], 'pengembalian' => []];
        $existingPaymentOrderIds = [];

        if ($storeId) {
            $incomingOrderIds = [];
            $incomingHashes = ['payments' => [], 'returns_data' => [], 'pengembalian' => []];
            $incomingPaymentOids = [];

            foreach ($filesData as $fdata) {
                $cat = $fdata['category'] ?? 'unknown';
                $jsonData = $fdata['jsonData'] ?? [];
                if (empty($jsonData)) continue;

                if ($cat === 'orders') {
                    foreach ($jsonData as $row) {
                        $oid = (string)($row['Order ID'] ?? '');
                        if ($oid) $incomingOrderIds[] = $oid;
                    }
                } else {
                    $table = match($cat) {
                        'payments' => 'payments',
                        'return' => 'returns_data',
                        'pengembalian' => 'pengembalian',
                        default => null
                    };
                    if ($table) {
                        $rows = $cat === 'pengembalian' 
                            ? array_map(fn($r) => array_merge((array)$r, ['Channel Marketplace' => 'Pengembalian']), $jsonData)
                            : $jsonData;
                        
                        foreach ($rows as $row) {
                            $hash = md5(json_encode($row));
                            $incomingHashes[$table][] = $hash;

                            if ($cat === 'payments') {
                                foreach (array_keys((array)$row) as $k) {
                                    if (str_contains(strtolower($k), 'order/adjustment') || str_contains(strtolower($k), 'no. pesanan')) {
                                        $payOid = trim((string)($row[$k] ?? ''));
                                        if ($payOid && $payOid !== '/') $incomingPaymentOids[] = $payOid;
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
                    foreach ($rows as $r) $existingOrderIds[$r->order_id] = true;
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
                        foreach ($rows as $r) $existingHashes[$table][$r->content_hash] = true;
                    }
                }
            }

            if (!empty($incomingPaymentOids)) {
                $oids = array_unique($incomingPaymentOids);
                foreach (array_chunk($oids, 1000) as $chunk) {
                    $payRows = DB::table('payments as t')
                        ->join('uploads as u', 't.upload_id', '=', 'u.id')
                        ->where('u.store_id', $storeId)
                        ->where(function($q) use ($chunk) {
                            $q->whereIn(DB::raw("JSON_UNQUOTE(JSON_EXTRACT(t.data, '$.\"Order/Adjustment No.\"'))"), $chunk)
                              ->orWhereIn(DB::raw("JSON_UNQUOTE(JSON_EXTRACT(t.data, '$.\"No. Pesanan\"'))"), $chunk);
                        })
                        ->select('t.data')
                        ->get();
                    
                    foreach ($payRows as $pr) {
                        $d = is_string($pr->data) ? json_decode($pr->data, true) : (array)$pr->data;
                        foreach (array_keys($d) as $k) {
                            if (str_contains(strtolower($k), 'order/adjustment') || str_contains(strtolower($k), 'no. pesanan')) {
                                $oid = trim((string)($d[$k] ?? ''));
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
            if ($category === 'unknown' || empty($jsonData)) continue;

            $channel = ucfirst($platform);

            if ($category === 'orders') {
                $newRows = array_filter($jsonData, function ($row) use (&$existingOrderIds) {
                    $oid = (string)($row['Order ID'] ?? '');
                    return $oid && !isset($existingOrderIds[$oid]);
                });
                $newRows = array_values($newRows);
                $skippedCount = count($jsonData) - count($newRows);
                $skipped['orders'] += $skippedCount;

                if (count($newRows) > 0 || $skippedCount > 0) {
                    $uploadId = DB::table('uploads')->insertGetId([
                        'user_id'      => $userId,
                        'store_id'     => $storeId,
                        'filename'     => $filename,
                        'category'     => $category,
                        'platform'     => $platform,
                        'row_count'    => count($newRows),
                        'skipped_rows' => $skippedCount,
                        'created_at'   => now(),
                    ]);

                    foreach (array_chunk($newRows, 500) as $chunk) {
                        $inserts = array_map(fn($row) => [
                            'upload_id' => $uploadId,
                            'order_id'  => (string)($row['Order ID'] ?? ''),
                            'channel'   => $channel,
                            'data'      => json_encode($row),
                            'created_at'=> now(),
                        ], $chunk);
                        DB::table('orders')->insert($inserts);
                        foreach ($chunk as $r) $existingOrderIds[(string)($r['Order ID'] ?? '')] = true;
                    }
                    $results['orders'] += count($newRows);
                }
            } else {
                $tableName = match($category) {
                    'payments'     => 'payments',
                    'return'       => 'returns_data',
                    'pengembalian' => 'pengembalian',
                    default        => null,
                };
                $resultKey = match($category) { 'return' => 'returns', default => $category };
                if (!$tableName) continue;

                $rows = $category === 'pengembalian'
                    ? array_map(fn($r) => array_merge((array)$r, ['Channel Marketplace' => 'Pengembalian']), $jsonData)
                    : $jsonData;

                $newRows = [];
                foreach ($rows as $row) {
                    $jsonStr = json_encode($row);
                    $hash    = md5($jsonStr);

                    if (isset($existingHashes[$tableName][$hash])) { $skipped[$resultKey]++; continue; }

                    if ($category === 'payments') {
                        foreach (array_keys((array)$row) as $k) {
                            if (str_contains(strtolower($k), 'order/adjustment') || str_contains(strtolower($k), 'no. pesanan')) {
                                $payOid = trim((string)($row[$k] ?? ''));
                                if ($payOid && $payOid !== '/' && isset($existingPaymentOrderIds[$payOid])) {
                                    $skipped[$resultKey]++; continue 2;
                                }
                                if ($payOid && $payOid !== '/') $existingPaymentOrderIds[$payOid] = true;
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
                        'user_id'      => $userId,
                        'store_id'     => $storeId,
                        'filename'     => $filename,
                        'category'     => $category,
                        'platform'     => $platform,
                        'row_count'    => count($newRows),
                        'skipped_rows' => $skippedCount,
                        'created_at'   => now(),
                    ]);

                    foreach (array_chunk($newRows, 500) as $chunk) {
                        $inserts = array_map(fn($r) => [
                            'upload_id'    => $uploadId,
                            'data'         => $r['jsonStr'],
                            'content_hash' => $r['hash'],
                            'created_at'   => now(),
                        ], $chunk);
                        DB::table($tableName)->insert($inserts);
                    }
                    $results[$resultKey] += count($newRows);
                }
            }
        }

        $totalSkipped = array_sum($skipped);
        return response()->json(['success' => true, 'results' => $results, 'skipped' => $skipped, 'totalSkipped' => $totalSkipped]);
    }
}
