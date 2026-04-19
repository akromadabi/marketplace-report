<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class StoreController extends Controller
{
    private function saveLogo($base64Data) {
        if (!$base64Data) return null;
        if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $type)) {
            $data = substr($base64Data, strpos($base64Data, ',') + 1);
            $type = strtolower($type[1]); // jpg, png, gif
            if (!in_array($type, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg+xml'])) {
                return null;
            }
            if ($type === 'svg+xml') $type = 'svg';
            $data = base64_decode($data);
            if ($data === false) return null;
            $filename = uniqid('logo_') . '.' . $type;
            $path = public_path('logos/' . $filename);
            if (!File::exists(public_path('logos'))) {
                File::makeDirectory(public_path('logos'), 0755, true);
            }
            file_put_contents($path, $data);
            return 'logos/' . $filename;
        }
        return null;
    }

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

        $logoUrl = null;
        if ($request->has('logo_data')) {
            $logoUrl = $this->saveLogo($request->input('logo_data'));
        }

        try {
            $id = DB::table('stores')->insertGetId([
                'user_id'     => $userId,
                'name'        => trim($name),
                'platform'    => $request->input('platform', ''),
                'description' => $request->input('description', ''),
                'logo_url'    => $logoUrl,
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
        
        if ($request->has('logo_data')) {
            $logoUrl = $this->saveLogo($request->input('logo_data'));
            if ($logoUrl) {
                // optionally delete old logo here if needed, but not strictly necessary for now
                $fields['logo_url'] = $logoUrl;
            }
        }

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
