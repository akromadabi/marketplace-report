<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StoreController extends Controller
{
    // GET /api/stores?user_id=X
    public function index(Request $request)
    {
        $userId = $request->query('user_id');
        if (!$userId) return response()->json(['error' => 'user_id wajib'], 400);

        $stores = DB::select("
            SELECT s.*,
                (SELECT COUNT(*) FROM uploads WHERE store_id = s.id) as upload_count,
                (SELECT COUNT(*) FROM orders WHERE upload_id IN (SELECT id FROM uploads WHERE store_id = s.id)) as order_count
            FROM stores s WHERE s.user_id = ? ORDER BY s.created_at
        ", [$userId]);

        return response()->json($stores);
    }

    // GET /api/stores/all
    public function all()
    {
        $stores = DB::select("
            SELECT s.*, u.name as user_name, u.username,
                (SELECT COUNT(*) FROM uploads WHERE store_id = s.id) as upload_count,
                (SELECT COUNT(*) FROM orders WHERE upload_id IN (SELECT id FROM uploads WHERE store_id = s.id)) as order_count
            FROM stores s
            JOIN users u ON s.user_id = u.id
            ORDER BY u.name, s.name
        ");
        return response()->json($stores);
    }

    // POST /api/stores
    public function store(Request $request)
    {
        $userId = $request->input('user_id');
        $name   = $request->input('name');

        if (!$userId || !$name) {
            return response()->json(['error' => 'user_id dan nama toko wajib'], 400);
        }

        // Check class limit
        $user = DB::table('users')->where('id', $userId)->first();
        if ($user && $user->class) {
            $lim = DB::table('class_limits')->where('class_name', $user->class)->first();
            if ($lim && $lim->max_stores != -1) {
                $count = DB::table('stores')->where('user_id', $userId)->count();
                if ($count >= $lim->max_stores) {
                    return response()->json([
                        'error' => "Batas toko kelas {$user->class} adalah {$lim->max_stores}. Anda sudah memiliki {$count} toko."
                    ], 403);
                }
            }
        }

        try {
            $id = DB::table('stores')->insertGetId([
                'user_id'     => $userId,
                'name'        => trim($name),
                'platform'    => $request->input('platform', ''),
                'description' => $request->input('description', ''),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
            return response()->json(['id' => $id, 'success' => true]);
        } catch (\Exception $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json(['error' => 'Nama toko sudah digunakan'], 400);
            }
            return response()->json(['error' => 'Server error'], 500);
        }
    }

    // PUT /api/stores/:id
    public function update(Request $request, $id)
    {
        $fields = [];
        if ($request->has('name'))        $fields['name'] = trim($request->input('name'));
        if ($request->has('platform'))    $fields['platform'] = $request->input('platform');
        if ($request->has('description')) $fields['description'] = $request->input('description');
        if ($request->has('is_active'))   $fields['is_active'] = $request->input('is_active') ? 1 : 0;
        if (empty($fields)) return response()->json(['error' => 'Tidak ada data yang diubah'], 400);

        $fields['updated_at'] = now();
        try {
            DB::table('stores')->where('id', $id)->update($fields);
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json(['error' => 'Nama toko sudah digunakan'], 400);
            }
            return response()->json(['error' => 'Server error'], 500);
        }
    }

    // DELETE /api/stores/:id
    public function destroy($id)
    {
        DB::table('stores')->where('id', $id)->delete();
        return response()->json(['success' => true]);
    }
}
