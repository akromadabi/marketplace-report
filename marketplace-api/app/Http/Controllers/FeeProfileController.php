<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\FeeProfile;
use Illuminate\Support\Facades\DB;

class FeeProfileController extends Controller
{
    public function index(Request $request)
    {
        $storeId = $request->query('store_id');
        
        // Fetch specific store configs AND default global configs (store_id = null)
        $profiles = FeeProfile::where('store_id', $storeId)
                      ->orWhereNull('store_id')
                      ->orderBy('platform')
                      ->get();

        // Seed automatically if empty
        if ($profiles->isEmpty()) {
            $this->seedDefaults($storeId);
            $profiles = FeeProfile::where('store_id', $storeId)
                      ->orWhereNull('store_id')
                      ->orderBy('platform')
                      ->get();
        }

        return response()->json($profiles);
    }

    public function store(Request $request)
    {
        $request->validate([
            'store_id' => 'required',
            'name' => 'required|string',
            'platform' => 'required|string',
            'admin_fee_pct' => 'required|numeric',
            'affiliate_fee_pct' => 'required|numeric',
            'markup_pct' => 'required|numeric',
            'default_ad_spend' => 'required|numeric',
        ]);

        $profile = FeeProfile::create($request->all());
        return response()->json($profile, 201);
    }

    public function update(Request $request, $id)
    {
        $profile = FeeProfile::findOrFail($id);
        
        // Prevent editing global defaults natively, maybe force clone if store_id is null
        if ($profile->store_id === null) {
            $profile = FeeProfile::create(array_merge($request->all(), ['store_id' => $request->input('store_id')]));
            return response()->json($profile, 201);
        }

        $profile->update($request->all());
        return response()->json($profile);
    }

    public function destroy($id)
    {
        $profile = FeeProfile::findOrFail($id);
        if ($profile->store_id !== null) {
            $profile->delete();
        }
        return response()->json(['message' => 'Deleted']);
    }

    private function seedDefaults($storeId)
    {
        $defaults = [
            [
                'store_id' => null,
                'name' => 'Shopee Star (Kategori A)',
                'platform' => 'shopee',
                'admin_fee_pct' => 8.5,
                'affiliate_fee_pct' => 5.0,
                'markup_pct' => 60.0,
                'default_ad_spend' => 0
            ],
            [
                'store_id' => null,
                'name' => 'Shopee Non-Star (Kategori A)',
                'platform' => 'shopee',
                'admin_fee_pct' => 6.5,
                'affiliate_fee_pct' => 5.0,
                'markup_pct' => 60.0,
                'default_ad_spend' => 0
            ],
            [
                'store_id' => null,
                'name' => 'TikTok Shop Fashion',
                'platform' => 'tiktok',
                'admin_fee_pct' => 6.5,
                'affiliate_fee_pct' => 5.0,
                'markup_pct' => 60.0,
                'default_ad_spend' => 0
            ],
        ];

        FeeProfile::insert($defaults);
    }
}
