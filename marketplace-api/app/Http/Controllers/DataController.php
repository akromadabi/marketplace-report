<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DataController extends Controller
{
    private function storeScope($storeId, $userId): array
    {
        if ($storeId && $userId) {
            // Include uploads for this store OR orphan uploads (no store) owned by this user
            return [
                'where'  => ' WHERE upload_id IN (SELECT id FROM uploads WHERE store_id = ? OR (store_id IS NULL AND user_id = ?))',
                'params' => [$storeId, $userId],
            ];
        }
        if ($storeId) {
            return [
                'where'  => ' WHERE upload_id IN (SELECT id FROM uploads WHERE store_id = ?)',
                'params' => [$storeId],
            ];
        }
        if ($userId) {
            return [
                'where'  => ' WHERE upload_id IN (SELECT id FROM uploads WHERE user_id = ?)',
                'params' => [$userId],
            ];
        }
        return ['where' => '', 'params' => []];
    }

    private function getUploadIds(Request $request): ?array
    {
        $storeId = $request->query('store_id');
        $userId = $request->query('user_id');

        if ($storeId || $userId) {
            $query = DB::table('uploads')->select('id');
            if ($storeId && $userId) {
                $query->where(function ($q) use ($storeId, $userId) {
                    $q->where('store_id', $storeId)
                      ->orWhere(function ($q2) use ($userId) {
                          $q2->whereNull('store_id')->where('user_id', $userId);
                      });
                });
            } elseif ($storeId) {
                $query->where('store_id', $storeId);
            } else {
                $query->where('user_id', $userId);
            }
            return $query->pluck('id')->toArray();
        }
        return null;
    }

    private function applyUploadScope($query, Request $request)
    {
        $uploadIds = $this->getUploadIds($request);
        if ($uploadIds !== null) {
            if (!empty($uploadIds)) {
                $query->whereIn('upload_id', $uploadIds);
            } else {
                $query->whereRaw('1 = 0');
            }
        }
        return $query;
    }

    // GET /api/data/orders
    public function orders(Request $request)
    {
        $query = DB::table('orders')->select('id', 'data', 'channel');
        $this->applyUploadScope($query, $request);

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
                            if ($len === 2) {
                                $buf .= '{"Channel Marketplace":' . $chJson . "}\n";
                            } else {
                                $buf .= substr($trimmed, 0, -1) . ',"Channel Marketplace":' . $chJson . "}\n";
                            }
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

    // GET /api/data/payments
    public function payments(Request $request)
    {
        $query = DB::table('payments')->select('id', 'data');
        $this->applyUploadScope($query, $request);

        return new StreamedResponse(function () use ($query) {
            $query->chunkById(5000, function ($rows) {
                $buf = '';
                foreach ($rows as $r) {
                    $d = $r->data;
                    if (is_array($d) || is_object($d)) {
                        $buf .= json_encode($d) . "\n";
                    } else {
                        $buf .= $d . "\n";
                    }
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
        $query = DB::table('returns_data')->select('id', 'data');
        $this->applyUploadScope($query, $request);

        return new StreamedResponse(function () use ($query) {
            $query->chunkById(5000, function ($rows) {
                $buf = '';
                foreach ($rows as $r) {
                    $d = $r->data;
                    if (is_array($d) || is_object($d)) {
                        $buf .= json_encode($d) . "\n";
                    } else {
                        $buf .= $d . "\n";
                    }
                }
                echo $buf;
                if (ob_get_level() > 0) ob_flush();
                flush();
            });
        }, 200, ['Content-Type' => 'application/x-ndjson']);
    }

    // GET /api/data/pengembalian
    public function pengembalian(Request $request)
    {
        $query = DB::table('pengembalian')->select('id', 'data');
        $this->applyUploadScope($query, $request);

        return new StreamedResponse(function () use ($query) {
            $query->chunkById(5000, function ($rows) {
                $buf = '';
                foreach ($rows as $r) {
                    $d = $r->data;
                    if (is_array($d) || is_object($d)) {
                        $buf .= json_encode($d) . "\n";
                    } else {
                        $buf .= $d . "\n";
                    }
                }
                echo $buf;
                if (ob_get_level() > 0) ob_flush();
                flush();
            });
        }, 200, ['Content-Type' => 'application/x-ndjson']);
    }

    // GET /api/data/stats
    public function stats(Request $request)
    {
        $scope = $this->storeScope($request->query('store_id'), $request->query('user_id'));
        $ordersCount      = DB::select("SELECT COUNT(*) as count FROM orders{$scope['where']}", $scope['params'])[0]->count;
        $paymentsCount    = DB::select("SELECT COUNT(*) as count FROM payments{$scope['where']}", $scope['params'])[0]->count;
        $returnsCount     = DB::select("SELECT COUNT(*) as count FROM returns_data{$scope['where']}", $scope['params'])[0]->count;
        $pengembalianCount= DB::select("SELECT COUNT(*) as count FROM pengembalian{$scope['where']}", $scope['params'])[0]->count;

        return response()->json([
            'orders'      => $ordersCount,
            'payments'    => $paymentsCount,
            'returns'     => $returnsCount,
            'pengembalian'=> $pengembalianCount,
        ]);
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
        return response()->json(['success' => true]);
    }
}
