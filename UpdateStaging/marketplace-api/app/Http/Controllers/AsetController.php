<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AsetController extends Controller
{
    public function index()
    {
        return response()->json(DB::table('aset')->orderBy('updated_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $id = DB::table('aset')->insertGetId([
            'nama'       => $request->input('nama'),
            'harga'      => $request->input('harga', 0),
            'jumlah'     => $request->input('jumlah', 0),
            'user_id'    => $request->input('user_id'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(DB::table('aset')->where('id', $id)->first());
    }

    public function update(Request $request, $id)
    {
        DB::table('aset')->where('id', $id)->update([
            'nama'       => $request->input('nama'),
            'harga'      => $request->input('harga', 0),
            'jumlah'     => $request->input('jumlah', 0),
            'updated_at' => now(),
        ]);
        return response()->json(DB::table('aset')->where('id', $id)->first());
    }

    public function destroy($id)
    {
        DB::table('aset')->where('id', $id)->delete();
        return response()->json(['success' => true]);
    }
}
