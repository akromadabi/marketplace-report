<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DataController extends Controller
{
    private function storeScope($storeId, $userId): array
    {
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

    // GET /api/data/orders
    public function orders(Request $request)
    {
        ini_set('memory_limit', '-1');
        $scope = $this->storeScope($request->query('store_id'), $request->query('user_id'));
        
        $query = DB::table('orders')->select('data', 'channel')->orderBy('id');
        if ($scope['where'] !== '') {
            $query->whereRaw(ltrim($scope['where'], ' WHERE'), $scope['params']);
        }

        $result = [];
        foreach ($query->cursor() as $r) {
            $parsed = is_string($r->data) ? json_decode($r->data, true) : (array) $r->data;
            if (!is_array($parsed)) $parsed = [];
            $parsed['Channel Marketplace'] = $r->channel;
            $result[] = $parsed;
        }
        return response()->json($result);
    }

    // GET /api/data/payments
    public function payments(Request $request)
    {
        ini_set('memory_limit', '-1');
        $scope = $this->storeScope($request->query('store_id'), $request->query('user_id'));
        
        $query = DB::table('payments')->select('data')->orderBy('id');
        if ($scope['where'] !== '') {
            $query->whereRaw(ltrim($scope['where'], ' WHERE'), $scope['params']);
        }

        $result = [];
        foreach ($query->cursor() as $r) {
            $parsed = is_string($r->data) ? json_decode($r->data, true) : (array) $r->data;
            if (is_array($parsed)) $result[] = $parsed;
        }
        return response()->json($result);
    }

    // GET /api/data/returns
    public function returns(Request $request)
    {
        ini_set('memory_limit', '-1');
        $scope = $this->storeScope($request->query('store_id'), $request->query('user_id'));
        
        $query = DB::table('returns_data')->select('data')->orderBy('id');
        if ($scope['where'] !== '') {
            $query->whereRaw(ltrim($scope['where'], ' WHERE'), $scope['params']);
        }

        $result = [];
        foreach ($query->cursor() as $r) {
            $parsed = is_string($r->data) ? json_decode($r->data, true) : (array) $r->data;
            if (is_array($parsed)) $result[] = $parsed;
        }
        return response()->json($result);
    }

    // GET /api/data/pengembalian
    public function pengembalian(Request $request)
    {
        ini_set('memory_limit', '-1');
        $scope = $this->storeScope($request->query('store_id'), $request->query('user_id'));
        
        $query = DB::table('pengembalian')->select('data')->orderBy('id');
        if ($scope['where'] !== '') {
            $query->whereRaw(ltrim($scope['where'], ' WHERE'), $scope['params']);
        }

        $result = [];
        foreach ($query->cursor() as $r) {
            $parsed = is_string($r->data) ? json_decode($r->data, true) : (array) $r->data;
            if (is_array($parsed)) $result[] = $parsed;
        }
        return response()->json($result);
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
