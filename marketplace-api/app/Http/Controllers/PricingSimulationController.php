<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\PricingSimulation;

class PricingSimulationController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->query('user_id');
        if (!$userId) return response()->json([]);

        return response()->json(PricingSimulation::where('user_id', $userId)->orderBy('id', 'asc')->get());
    }

    public function sync(Request $request)
    {
        $userId = $request->input('user_id');
        if (!$userId) return response()->json(['error' => 'user_id required'], 400);

        // Delete all old simulations for this specific user
        PricingSimulation::where('user_id', $userId)->delete();
        
        $rows = $request->input('rows', []);
        foreach ($rows as $row) {
            PricingSimulation::create([
                'user_id' => $userId,
                // To keep client ID if useful (optional, ID will reset anyway, but we can override)
                'id' => $row['id'] ?? null,
                'name' => $row['name'] ?? null,
                'platform' => $row['platform'] ?? null,
                'hpp' => $row['hpp'] ?? 0,
                'harga_jual' => $row['hargaJual'] ?? 0,
                'harga_awal' => $row['hargaAwal'] ?? 0,
                'admin_fee_pct' => $row['r_adminFeePct'] ?? 0,
                'affiliate_fee_pct' => $row['r_affiliateFeePct'] ?? 0,
                'ad_spend' => $row['r_adSpend'] ?? 0,
                'markup_pct' => $row['r_markupPct'] ?? 0,
                'target_margin_mode' => $row['r_targetMarginMode'] ?? 'nominal',
                'target_margin_value' => $row['r_targetMarginValue'] ?? 0,
            ]);
        }
        
        return response()->json(['success' => true]);
    }
}
