<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CampaignTemplate;

class CampaignTemplateController extends Controller
{
    public function index(Request $request)
    {
        $storeId = $request->input('store_id');
        $platform = $request->input('platform', 'tiktok');

        if (!$storeId) {
            return response()->json(['error' => 'store_id is required'], 400);
        }

        $templates = CampaignTemplate::where('store_id', $storeId)
            ->where('platform', $platform)
            ->orderBy('name')
            ->get();

        return response()->json($templates);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'store_id' => 'required|integer',
            'platform' => 'required|string',
            'name' => 'required|string|max:255',
            'payload' => 'required|array'
        ]);

        // Simpan atau update berdasarkan store_id, platform, dan name yang sama
        $template = CampaignTemplate::updateOrCreate(
            [
                'store_id' => $validated['store_id'],
                'platform' => $validated['platform'],
                'name' => $validated['name']
            ],
            [
                'payload' => $validated['payload']
            ]
        );

        return response()->json([
            'message' => 'Template berhasil disimpan',
            'template' => $template
        ]);
    }

    public function destroy($id)
    {
        $template = CampaignTemplate::find($id);

        if (!$template) {
            return response()->json(['error' => 'Template not found'], 404);
        }

        $template->delete();

        return response()->json(['message' => 'Template berhasil dihapus']);
    }
}
