<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DataController extends Controller
{
    /**
     * Query the `uploads` table once to get upload IDs, row counts, and version fingerprints
     * per category for the given store_id / user_id scope.
     */
    private function getUploadScopeInfo(Request $request): array
    {
        $storeId = $request->query('store_id');
        $userId  = $request->query('user_id');

        $query = DB::table('uploads')->select('id', 'category', 'row_count');
        if ($storeId && $userId) {
            $query->where(function ($q) use ($storeId, $userId) {
                $q->where('store_id', $storeId)
                  ->orWhere(function ($q2) use ($userId) {
                      $q2->whereNull('store_id')->where('user_id', $userId);
                  });
            });
        } elseif ($storeId) {
            $query->where('store_id', $storeId);
        } elseif ($userId) {
            $query->where('user_id', $userId);
        }

        $rows = $query->get();

        $byCat = [
            'orders'       => ['ids' => [], 'count' => 0, 'max_id' => 0, 'rows' => 0],
            'payments'     => ['ids' => [], 'count' => 0, 'max_id' => 0, 'rows' => 0],
            'returns'      => ['ids' => [], 'count' => 0, 'max_id' => 0, 'rows' => 0],
            'pengembalian' => ['ids' => [], 'count' => 0, 'max_id' => 0, 'rows' => 0],
        ];
        $allIds = [];
        $totalCount = 0;
        $maxId = 0;
        $totalRows = 0;

        foreach ($rows as $r) {
            $id = (int) $r->id;
            $rc = (int) ($r->row_count ?? 0);
            $cat = strtolower((string) $r->category);
            if ($cat === 'return') $cat = 'returns';

            $allIds[] = $id;
            $totalCount++;
            if ($id > $maxId) $maxId = $id;
            $totalRows += $rc;

            if (isset($byCat[$cat])) {
                $byCat[$cat]['ids'][] = $id;
                $byCat[$cat]['count']++;
                if ($id > $byCat[$cat]['max_id']) $byCat[$cat]['max_id'] = $id;
                $byCat[$cat]['rows'] += $rc;
            }
        }

        $scopeTag = ($storeId ?: 'all') . '_' . ($userId ?: 'all');
        $catVersions = [];
        foreach ($byCat as $c => $info) {
            $catVersions[$c] = "v3_{$scopeTag}_{$c}_{$info['count']}_{$info['max_id']}_{$info['rows']}";
        }
        $uploadVersion = "v3_{$scopeTag}_{$totalCount}_{$maxId}_{$totalRows}_"
            . substr(md5( implode('|', $catVersions) ), 0, 10);

        return [
            'scopeTag'      => $scopeTag,
            'hasScope'      => (bool) ($storeId || $userId),
            'allIds'        => $allIds,
            'byCat'         => $byCat,
            'catVersions'   => $catVersions,
            'uploadVersion' => $uploadVersion,
            'stats'         => [
                'orders'       => $byCat['orders']['rows'],
                'payments'     => $byCat['payments']['rows'],
                'returns'      => $byCat['returns']['rows'],
                'pengembalian' => $byCat['pengembalian']['rows'],
            ],
        ];
    }

    /**
     * Serve a gzip-compressed JSON payload from disk cache, or build & cache it once.
     * Automatically cleans up stale cache files for the same prefix.
     */
    private function serveCachedJsonOrBuild(string $cacheKey, string $prefix, Request $request, callable $builder)
    {
        ini_set('memory_limit', '-1');
        set_time_limit(0);

        $cacheDir = storage_path('app/data_cache');
        if (!File::exists($cacheDir)) {
            File::makeDirectory($cacheDir, 0755, true);
        }

        $safeKey  = preg_replace('/[^A-Za-z0-9_\-]/', '_', $cacheKey);
        $safePref = preg_replace('/[^A-Za-z0-9_\-]/', '_', $prefix);
        $gzPath   = $cacheDir . DIRECTORY_SEPARATOR . $safeKey . '.json.gz';

        if (!file_exists($gzPath)) {
            $json = $builder();
            $gz   = gzencode($json, 1);
            unset($json);

            // Cleanup older cache files for this prefix
            foreach (glob($cacheDir . DIRECTORY_SEPARATOR . $safePref . '_*.json.gz') ?: [] as $oldFile) {
                @unlink($oldFile);
            }

            $tmpPath = $gzPath . '.' . uniqid('', true) . '.tmp';
            if (@file_put_contents($tmpPath, $gz) !== false) {
                @rename($tmpPath, $gzPath);
            }
        } else {
            $gz = file_get_contents($gzPath);
        }

        $acceptEncoding = (string) $request->header('Accept-Encoding', '');
        if (str_contains($acceptEncoding, 'gzip') && $gz !== false) {
            return response($gz, 200, [
                'Content-Type'     => 'application/json; charset=utf-8',
                'Content-Encoding' => 'gzip',
                'Content-Length'   => strlen($gz),
                'X-Cache-Key'      => $safeKey,
            ]);
        }

        $plain = $gz !== false ? gzdecode($gz) : '[]';
        return response($plain, 200, [
            'Content-Type' => 'application/json; charset=utf-8',
        ]);
    }

    // GET /api/data/version
    public function version(Request $request)
    {
        $info = $this->getUploadScopeInfo($request);
        return response()->json([
            'uploadVersion' => $info['uploadVersion'],
            'categories'    => $info['catVersions'],
            'stats'         => $info['stats'],
        ]);
    }

    // GET /api/data/payments-map
    // Pre-aggregates payments per Order ID: { "orderId": [settlement, affiliate, customerPayment, ongkir] }
    public function paymentsMap(Request $request)
    {
        $info = $this->getUploadScopeInfo($request);
        $payIds = $info['byCat']['payments']['ids'];
        if ($info['hasScope'] && empty($payIds)) {
            return response()->json((object) []);
        }

        $prefix   = "paymap_{$info['scopeTag']}";
        $cacheKey = $info['catVersions']['payments'];

        return $this->serveCachedJsonOrBuild($cacheKey, $prefix, $request, function () use ($info, $payIds) {
            $query = DB::table('payments')->select('id', 'data');
            if ($info['hasScope']) {
                $query->whereIn('upload_id', $payIds);
            }

            $map = [];
            $query->chunkById(10000, function ($rows) use (&$map) {
                foreach ($rows as $r) {
                    $d = is_string($r->data) ? json_decode($r->data, true) : (array) $r->data;
                    if (!is_array($d)) continue;

                    $oid = '';
                    $tsa = 0.0;
                    $aff = 0.0;
                    $cp  = 0.0;
                    $ong = 0.0;

                    foreach ($d as $k => $v) {
                        if ($v === '' || $v === null) continue;
                        $lk = strtolower(trim((string) $k));
                        if ($lk === 'order/adjustment id' || $lk === 'no. pesanan') {
                            $oid = trim((string) $v);
                        } elseif ($lk === 'total settlement amount' || $lk === 'total penghasilan') {
                            $val = is_numeric($v) ? (float) $v : (float) str_replace(',', '', (string) $v);
                            if (!is_nan($val)) $tsa += $val;
                        } elseif ($lk === 'affiliate commission' || $lk === 'komisi affiliate') {
                            $val = is_numeric($v) ? (float) $v : (float) str_replace(',', '', (string) $v);
                            if (!is_nan($val)) $aff += $val;
                        } elseif ($lk === 'customer payment' || $lk === 'total pembayaran pembeli') {
                            $val = is_numeric($v) ? (float) $v : (float) str_replace(',', '', (string) $v);
                            if (!is_nan($val)) $cp += $val;
                        } elseif ($lk === 'return shipping costs (passed on to the customer)') {
                            $clean = is_numeric($v) ? (string) $v : preg_replace('/[^0-9.\-]+/', '', (string) $v);
                            if ($clean !== '' && is_numeric($clean)) $ong += (float) $clean;
                        }
                    }

                    if ($oid !== '') {
                        if (!isset($map[$oid])) {
                            $map[$oid] = [$tsa, $aff, $cp, $ong];
                        } else {
                            $map[$oid][0] += $tsa;
                            $map[$oid][1] += $aff;
                            $map[$oid][2] += $cp;
                            $map[$oid][3] += $ong;
                        }
                    }
                }
            });

            return empty($map) ? '{}' : json_encode($map);
        });
    }

    // GET /api/data/orders
    public function orders(Request $request)
    {
        $info   = $this->getUploadScopeInfo($request);
        $ordIds = $info['byCat']['orders']['ids'];
        if ($info['hasScope'] && empty($ordIds)) {
            if (str_contains((string) $request->header('Accept', ''), 'application/x-ndjson')) {
                return response('', 200, ['Content-Type' => 'application/x-ndjson']);
            }
            return response()->json([]);
        }

        // Legacy NDJSON fallback if explicitly requested
        if (str_contains((string) $request->header('Accept', ''), 'application/x-ndjson')) {
            $query = DB::table('orders')->select('id', 'data', 'channel');
            if ($info['hasScope']) $query->whereIn('upload_id', $ordIds);

            return new StreamedResponse(function () use ($query) {
                $channelCache = [];
                $query->chunkById(5000, function ($rows) use (&$channelCache) {
                    $buf = '';
                    foreach ($rows as $r) {
                        $ch = $r->channel ?? '';
                        if (!isset($channelCache[$ch])) {
                            $channelCache[$ch] = json_encode($ch);
                        }
                        $chJson = $channelCache[$ch];
                        $d = $r->data;
                        if (is_string($d)) {
                            $trimmed = rtrim($d);
                            $len = strlen($trimmed);
                            if ($len >= 2 && $trimmed[0] === '{' && $trimmed[$len - 1] === '}') {
                                $buf .= ($len === 2)
                                    ? '{"Channel Marketplace":' . $chJson . "}\n"
                                    : substr($trimmed, 0, -1) . ',"Channel Marketplace":' . $chJson . "}\n";
                                continue;
                            }
                            $parsed = json_decode($d, true);
                        } else {
                            $parsed = (array) $d;
                        }
                        if (!is_array($parsed)) $parsed = [];
                        $parsed['Channel Marketplace'] = $ch;
                        $buf .= json_encode($parsed) . "\n";
                    }
                    echo $buf;
                    if (ob_get_level() > 0) ob_flush();
                    flush();
                });
            }, 200, ['Content-Type' => 'application/x-ndjson']);
        }

        $prefix   = "orders_{$info['scopeTag']}";
        $cacheKey = $info['catVersions']['orders'];

        return $this->serveCachedJsonOrBuild($cacheKey, $prefix, $request, function () use ($info, $ordIds) {
            $query = DB::table('orders')->select('id', 'data', 'channel');
            if ($info['hasScope']) {
                $query->whereIn('upload_id', $ordIds);
            }

            $chunks = [];
            $channelCache = [];
            $query->chunkById(10000, function ($rows) use (&$chunks, &$channelCache) {
                $part = [];
                foreach ($rows as $r) {
                    $ch = $r->channel ?? '';
                    if (!isset($channelCache[$ch])) {
                        $channelCache[$ch] = json_encode($ch);
                    }
                    $chJson = $channelCache[$ch];
                    $d = $r->data;
                    if (is_string($d)) {
                        $trimmed = rtrim($d);
                        $len = strlen($trimmed);
                        if ($len >= 2 && $trimmed[0] === '{' && $trimmed[$len - 1] === '}') {
                            $part[] = ($len === 2)
                                ? '{"Channel Marketplace":' . $chJson . '}'
                                : substr($trimmed, 0, -1) . ',"Channel Marketplace":' . $chJson . '}';
                            continue;
                        }
                        $parsed = json_decode($d, true);
                    } else {
                        $parsed = (array) $d;
                    }
                    if (!is_array($parsed)) $parsed = [];
                    $parsed['Channel Marketplace'] = $ch;
                    $part[] = json_encode($parsed);
                }
                if (!empty($part)) {
                    $chunks[] = implode(',', $part);
                }
            });

            return '[' . implode(',', $chunks) . ']';
        });
    }

    // GET /api/data/payments
    public function payments(Request $request)
    {
        $info   = $this->getUploadScopeInfo($request);
        $payIds = $info['byCat']['payments']['ids'];
        if ($info['hasScope'] && empty($payIds)) {
            return response()->json([]);
        }

        $query = DB::table('payments')->select('id', 'data');
        if ($info['hasScope']) $query->whereIn('upload_id', $payIds);

        return new StreamedResponse(function () use ($query) {
            $query->chunkById(5000, function ($rows) {
                $buf = '';
                foreach ($rows as $r) {
                    $d = $r->data;
                    $buf .= (is_array($d) || is_object($d)) ? json_encode($d) . "\n" : $d . "\n";
                }
                echo $buf;
                if (ob_get_level() > 0) ob_flush();
                flush();
            });
        }, 200, ['Content-Type' => 'application/x-ndjson']);
    }

    // GET /api/data/returns
    public function returns(Request $request)
    {
        $info   = $this->getUploadScopeInfo($request);
        $retIds = $info['byCat']['returns']['ids'];
        if ($info['hasScope'] && empty($retIds)) {
            if (str_contains((string) $request->header('Accept', ''), 'application/x-ndjson')) {
                return response('', 200, ['Content-Type' => 'application/x-ndjson']);
            }
            return response()->json([]);
        }

        if (str_contains((string) $request->header('Accept', ''), 'application/x-ndjson')) {
            $query = DB::table('returns_data')->select('id', 'data');
            if ($info['hasScope']) $query->whereIn('upload_id', $retIds);
            return new StreamedResponse(function () use ($query) {
                $query->chunkById(5000, function ($rows) {
                    $buf = '';
                    foreach ($rows as $r) {
                        $d = $r->data;
                        $buf .= (is_array($d) || is_object($d)) ? json_encode($d) . "\n" : $d . "\n";
                    }
                    echo $buf;
                    if (ob_get_level() > 0) ob_flush();
                    flush();
                });
            }, 200, ['Content-Type' => 'application/x-ndjson']);
        }

        $prefix   = "returns_{$info['scopeTag']}";
        $cacheKey = $info['catVersions']['returns'];

        return $this->serveCachedJsonOrBuild($cacheKey, $prefix, $request, function () use ($info, $retIds) {
            $query = DB::table('returns_data')->select('id', 'data');
            if ($info['hasScope']) $query->whereIn('upload_id', $retIds);

            $items = [];
            $query->chunkById(5000, function ($rows) use (&$items) {
                foreach ($rows as $r) {
                    $d = $r->data;
                    $items[] = (is_array($d) || is_object($d)) ? json_encode($d) : rtrim((string) $d);
                }
            });
            return '[' . implode(',', $items) . ']';
        });
    }

    // GET /api/data/pengembalian
    public function pengembalian(Request $request)
    {
        $info   = $this->getUploadScopeInfo($request);
        $pngIds = $info['byCat']['pengembalian']['ids'];
        if ($info['hasScope'] && empty($pngIds)) {
            if (str_contains((string) $request->header('Accept', ''), 'application/x-ndjson')) {
                return response('', 200, ['Content-Type' => 'application/x-ndjson']);
            }
            return response()->json([]);
        }

        if (str_contains((string) $request->header('Accept', ''), 'application/x-ndjson')) {
            $query = DB::table('pengembalian')->select('id', 'data');
            if ($info['hasScope']) $query->whereIn('upload_id', $pngIds);
            return new StreamedResponse(function () use ($query) {
                $query->chunkById(5000, function ($rows) {
                    $buf = '';
                    foreach ($rows as $r) {
                        $d = $r->data;
                        $buf .= (is_array($d) || is_object($d)) ? json_encode($d) . "\n" : $d . "\n";
                    }
                    echo $buf;
                    if (ob_get_level() > 0) ob_flush();
                    flush();
                });
            }, 200, ['Content-Type' => 'application/x-ndjson']);
        }

        $prefix   = "pengembalian_{$info['scopeTag']}";
        $cacheKey = $info['catVersions']['pengembalian'];

        return $this->serveCachedJsonOrBuild($cacheKey, $prefix, $request, function () use ($info, $pngIds) {
            $query = DB::table('pengembalian')->select('id', 'data');
            if ($info['hasScope']) $query->whereIn('upload_id', $pngIds);

            $items = [];
            $query->chunkById(5000, function ($rows) use (&$items) {
                foreach ($rows as $r) {
                    $d = $r->data;
                    $items[] = (is_array($d) || is_object($d)) ? json_encode($d) : rtrim((string) $d);
                }
            });
            return '[' . implode(',', $items) . ']';
        });
    }

    // GET /api/data/stats
    public function stats(Request $request)
    {
        $info = $this->getUploadScopeInfo($request);
        return response()->json($info['stats']);
    }

    // DELETE /api/data/clear
    public function clear(Request $request)
    {
        $storeId = $request->query('store_id');
        if ($storeId) {
            DB::statement('DELETE FROM orders WHERE upload_id IN (SELECT id FROM uploads WHERE store_id = ?)', [$storeId]);
            DB::statement('DELETE FROM payments WHERE upload_id IN (SELECT id FROM uploads WHERE store_id = ?)', [$storeId]);
            DB::statement('DELETE FROM returns_data WHERE upload_id IN (SELECT id FROM uploads WHERE store_id = ?)', [$storeId]);
            DB::statement('DELETE FROM pengembalian WHERE upload_id IN (SELECT id FROM uploads WHERE store_id = ?)', [$storeId]);
            DB::table('uploads')->where('store_id', $storeId)->delete();
        } else {
            DB::table('orders')->delete();
            DB::table('payments')->delete();
            DB::table('returns_data')->delete();
            DB::table('pengembalian')->delete();
            DB::table('uploads')->delete();
        }

        $cacheDir = storage_path('app/data_cache');
        if (File::exists($cacheDir)) {
            File::cleanDirectory($cacheDir);
        }

        return response()->json(['success' => true]);
    }
}
