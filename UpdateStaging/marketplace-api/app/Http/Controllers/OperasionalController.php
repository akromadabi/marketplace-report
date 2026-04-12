<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OperasionalController extends Controller
{
    public function index()
    {
        return response()->json(
            DB::table('operasional')->orderBy('tanggal', 'desc')->orderBy('id', 'desc')->get()
        );
    }

    public function store(Request $request)
    {
        $id = DB::table('operasional')->insertGetId([
            'nama'       => $request->input('nama'),
            'kategori'   => $request->input('kategori'),
            'tanggal'    => $request->input('tanggal'),
            'biaya'      => $request->input('biaya', 0),
            'user_id'    => $request->input('user_id'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(DB::table('operasional')->where('id', $id)->first());
    }

    public function update(Request $request, $id)
    {
        DB::table('operasional')->where('id', $id)->update([
            'nama'       => $request->input('nama'),
            'kategori'   => $request->input('kategori'),
            'tanggal'    => $request->input('tanggal'),
            'biaya'      => $request->input('biaya', 0),
            'updated_at' => now(),
        ]);
        return response()->json(DB::table('operasional')->where('id', $id)->first());
    }

    public function destroy($id)
    {
        DB::table('operasional')->where('id', $id)->delete();
        return response()->json(['success' => true]);
    }
}
