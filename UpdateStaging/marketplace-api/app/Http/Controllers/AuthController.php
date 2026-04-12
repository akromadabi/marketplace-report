<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    // POST /api/auth/login
    public function login(Request $request)
    {
        $username = $request->input('username');
        $password = $request->input('password');

        if (!$username || !$password) {
            return response()->json(['error' => 'Username dan password wajib diisi'], 400);
        }

        $user = DB::table('users')->where('username', $username)->first();
        if (!$user) {
            return response()->json(['error' => 'Username tidak ditemukan'], 401);
        }

        // Lazy bcrypt migration: try bcrypt first, fall back to plaintext
        $passwordOk = false;
        if (Hash::needsRehash($user->password) === false && str_starts_with($user->password, '$2y$')) {
            // Bcrypt hash
            $passwordOk = Hash::check($password, $user->password);
        } else {
            // Plaintext (old format) — check then upgrade
            $passwordOk = ($user->password === $password);
            if ($passwordOk) {
                DB::table('users')->where('id', $user->id)
                    ->update(['password' => Hash::make($password)]);
            }
        }

        if (!$passwordOk) {
            return response()->json(['error' => 'Password salah'], 401);
        }

        if ($user->status === 'inactive') {
            return response()->json(['error' => 'Akun Anda telah dinonaktifkan. Hubungi admin.'], 403);
        }

        $permissions = [];
        $limits = ['max_stores' => -1, 'max_orders' => -1];

        if ($user->role === 'user' && $user->class) {
            $perms = DB::table('class_permissions')
                ->where('class_name', $user->class)
                ->pluck('permission')
                ->toArray();
            $permissions = $perms;

            $lim = DB::table('class_limits')->where('class_name', $user->class)->first();
            if ($lim) {
                $limits = ['max_stores' => $lim->max_stores, 'max_orders' => $lim->max_orders];
            }
        }

        return response()->json([
            'id'         => $user->id,
            'username'   => $user->username,
            'name'       => $user->name,
            'role'       => $user->role,
            'class'      => $user->class,
            'store_name' => $user->store_name ?? '',
            'status'     => $user->status,
            'permissions'=> $permissions,
            'limits'     => $limits,
        ]);
    }

    // GET /api/auth/users
    public function listUsers()
    {
        $users = DB::table('users')
            ->select('id', 'username', 'name', 'role', 'class', 'store_name', 'status', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get();

        $allStores = DB::table('stores')->select('id', 'user_id', 'name')->get();
        $orderCounts = DB::table('orders')
            ->join('uploads', 'orders.upload_id', '=', 'uploads.id')
            ->select('uploads.user_id', DB::raw('COUNT(*) as count'))
            ->groupBy('uploads.user_id')
            ->get()
            ->keyBy('user_id');
        $allLimits = DB::table('class_limits')->get()->keyBy('class_name');

        $storesByUser = [];
        foreach ($allStores as $s) {
            $storesByUser[$s->user_id][] = $s->name;
        }

        $enriched = $users->map(function ($u) use ($storesByUser, $orderCounts, $allLimits) {
            $stores = $storesByUser[$u->id] ?? [];
            $lim = $allLimits[$u->class] ?? null;
            return array_merge((array) $u, [
                'stores'      => $stores,
                'store_count' => count($stores),
                'order_count' => $orderCounts[$u->id]->count ?? 0,
                'limits'      => $lim
                    ? ['max_stores' => $lim->max_stores, 'max_orders' => $lim->max_orders]
                    : ['max_stores' => -1, 'max_orders' => -1],
            ]);
        });

        return response()->json($enriched);
    }

    // POST /api/auth/users
    public function createUser(Request $request)
    {
        $data = $request->only(['username', 'password', 'name', 'role', 'class', 'store_name', 'status']);
        if (empty($data['username']) || empty($data['password']) || empty($data['name'])) {
            return response()->json(['error' => 'Data tidak lengkap'], 400);
        }

        try {
            DB::table('users')->insert([
                'username'   => $data['username'],
                'password'   => Hash::make($data['password']),
                'name'       => $data['name'],
                'role'       => $data['role'] ?? 'user',
                'class'      => $data['class'] ?? 'silver',
                'store_name' => $data['store_name'] ?? '',
                'status'     => $data['status'] ?? 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json(['error' => 'Username sudah digunakan'], 400);
            }
            return response()->json(['error' => 'Server error'], 500);
        }
    }

    // PUT /api/auth/users/:id
    public function updateUser(Request $request, $id)
    {
        $fields = [];
        foreach (['username', 'name', 'role', 'class', 'store_name', 'status'] as $f) {
            if ($request->has($f)) $fields[$f] = $request->input($f);
        }
        if ($request->filled('password')) {
            $fields['password'] = Hash::make($request->input('password'));
        }
        if (empty($fields)) {
            return response()->json(['error' => 'Tidak ada data yang diupdate'], 400);
        }
        $fields['updated_at'] = now();

        try {
            DB::table('users')->where('id', $id)->update($fields);
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json(['error' => 'Username sudah digunakan'], 400);
            }
            return response()->json(['error' => 'Server error'], 500);
        }
    }

    // DELETE /api/auth/users/:id
    public function deleteUser($id)
    {
        DB::table('users')->where('id', $id)->delete();
        return response()->json(['success' => true]);
    }

    // GET /api/auth/roles
    public function getRoles()
    {
        $rows = DB::table('class_permissions')->orderBy('class_name')->get();
        $grouped = [];
        foreach ($rows as $row) {
            $grouped[$row->class_name][] = $row->permission;
        }
        return response()->json($grouped);
    }

    // PUT /api/auth/roles/:className
    public function updateRole(Request $request, $className)
    {
        if (!in_array($className, ['platinum', 'gold', 'silver'])) {
            return response()->json(['error' => 'Kelas tidak valid'], 400);
        }
        $permissions = $request->input('permissions');
        if (!is_array($permissions)) {
            return response()->json(['error' => 'permissions harus berupa array'], 400);
        }

        DB::table('class_permissions')->where('class_name', $className)->delete();
        if (!empty($permissions)) {
            $values = array_map(fn($p) => ['class_name' => $className, 'permission' => $p], $permissions);
            DB::table('class_permissions')->insert($values);
        }
        return response()->json(['success' => true]);
    }

    // GET /api/auth/permissions/:className
    public function getPermissions($className)
    {
        $perms = DB::table('class_permissions')
            ->where('class_name', $className)
            ->pluck('permission');
        return response()->json($perms);
    }

    // GET /api/auth/limits
    public function getLimits()
    {
        $rows = DB::table('class_limits')
            ->orderByRaw("FIELD(class_name, 'platinum', 'gold', 'silver')")
            ->get();
        $result = [];
        foreach ($rows as $r) {
            $result[$r->class_name] = ['max_stores' => $r->max_stores, 'max_orders' => $r->max_orders];
        }
        return response()->json($result);
    }

    // PUT /api/auth/limits/:className
    public function updateLimits(Request $request, $className)
    {
        if (!in_array($className, ['platinum', 'gold', 'silver'])) {
            return response()->json(['error' => 'Kelas tidak valid'], 400);
        }
        $maxStores = $request->input('max_stores', -1);
        $maxOrders = $request->input('max_orders', -1);

        DB::statement("INSERT INTO class_limits (class_name, max_stores, max_orders) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE max_stores = VALUES(max_stores), max_orders = VALUES(max_orders)",
            [$className, $maxStores, $maxOrders]);

        return response()->json(['success' => true]);
    }

    // GET /api/auth/usage/:userId
    public function getUsage($userId)
    {
        $storeCount = DB::table('stores')->where('user_id', $userId)->count();
        $orderCount = DB::table('orders')
            ->whereIn('upload_id', DB::table('uploads')->where('user_id', $userId)->pluck('id'))
            ->count();
        return response()->json(['stores' => $storeCount, 'orders' => $orderCount]);
    }

    // PUT /api/auth/profile
    public function updateProfile(Request $request)
    {
        $userId = $request->input('user_id');
        if (!$userId) return response()->json(['error' => 'user_id wajib'], 400);

        $newPassword = $request->input('new_password');
        $currentPassword = $request->input('current_password');

        if ($newPassword) {
            if (!$currentPassword) return response()->json(['error' => 'Password saat ini wajib diisi'], 400);
            $user = DB::table('users')->where('id', $userId)->first();
            if (!$user) return response()->json(['error' => 'User tidak ditemukan'], 404);

            // Check current password (support both bcrypt and plaintext)
            $currentOk = str_starts_with($user->password, '$2y$')
                ? Hash::check($currentPassword, $user->password)
                : ($user->password === $currentPassword);

            if (!$currentOk) return response()->json(['error' => 'Password saat ini salah'], 401);
        }

        $fields = [];
        if ($request->filled('name')) $fields['name'] = trim($request->input('name'));
        if ($newPassword && trim($newPassword)) $fields['password'] = Hash::make(trim($newPassword));
        if (empty($fields)) return response()->json(['error' => 'Tidak ada data yang diubah'], 400);

        $fields['updated_at'] = now();
        DB::table('users')->where('id', $userId)->update($fields);

        $updated = DB::table('users')
            ->select('id', 'username', 'name', 'role', 'class', 'store_name', 'status')
            ->where('id', $userId)->first();

        return response()->json(['success' => true, 'user' => $updated]);
    }
}
