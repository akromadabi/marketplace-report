<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScanController extends Controller
{
    // GET /api/scan?store_id=X
    public function index(Request $request)
    {
        $storeId = $request->query('store_id');
        $query = DB::table('scanned_resi as s')
            ->leftJoin('users as u', 's.scanned_by', '=', 'u.id')
            ->select('s.*', 'u.name as scanned_by_name')
            ->orderBy('s.scanned_at', 'desc');
        if ($storeId) $query->where('s.store_id', $storeId);
        return response()->json($query->get());
    }

    // POST /api/scan
    public function store(Request $request)
    {
        $resi = trim($request->input('resi', ''));
        if (!$resi) return response()->json(['error' => 'Nomor resi tidak boleh kosong'], 400);

        $existing = DB::table('scanned_resi')->where('resi', $resi)->first();
        if ($existing) return response()->json(['error' => 'Resi sudah pernah discan', 'duplicate' => true], 409);

        try {
            $id = DB::table('scanned_resi')->insertGetId([
                'resi'       => $resi,
                'scanned_by' => $request->input('user_id'),
                'store_id'   => $request->input('store_id'),
                'notes'      => $request->input('notes'),
                'scanned_at' => now(),
            ]);
            return response()->json(['success' => true, 'id' => $id, 'resi' => $resi]);
        } catch (\Exception $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json(['error' => 'Resi sudah pernah discan', 'duplicate' => true], 409);
            }
            return response()->json(['error' => 'Server error'], 500);
        }
    }

    // DELETE /api/scan/:id
    public function destroy($id)
    {
        DB::table('scanned_resi')->where('id', $id)->delete();
        return response()->json(['success' => true]);
    }
}
