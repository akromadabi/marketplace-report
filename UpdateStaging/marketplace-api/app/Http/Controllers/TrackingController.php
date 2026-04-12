<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class TrackingController extends Controller
{
    private array $courierMap = [
        'j&t express' => 'jnt', 'j&t' => 'jnt', 'jnt' => 'jnt', 'j&t cargo' => 'jnt',
        'jne' => 'jne', 'jne express' => 'jne',
        'sicepat' => 'sicepat', 'sicepat express' => 'sicepat', 'sicepat ekspres' => 'sicepat',
        'anteraja' => 'anteraja', 'anter aja' => 'anteraja',
        'ninja express' => 'ninja', 'ninja van' => 'ninja', 'ninja xpress' => 'ninja', 'ninja' => 'ninja',
        'tiki' => 'tiki',
        'pos indonesia' => 'pos', 'pos' => 'pos',
        'wahana' => 'wahana', 'wahana express' => 'wahana',
        'lion parcel' => 'lion', 'lion' => 'lion',
        'spx express' => 'spx', 'shopee express' => 'spx', 'spx' => 'spx', 'standard express' => 'spx',
        'id express' => 'ide', 'idexpress' => 'ide', 'ide' => 'ide',
        'sap express' => 'sap', 'sap' => 'sap',
        'grab express' => 'grab', 'grabexpress' => 'grab',
        'gosend' => 'gosend', 'go-send' => 'gosend',
    ];

    private array $awbPrefixes = [
        ['pattern' => '/^(JX|JP|JA|JT)/i', 'courier' => 'jnt'],
        ['pattern' => '/^(JN|CGK|SUB|SRG|BDOEX)/i', 'courier' => 'jne'],
        ['pattern' => '/^(SPXID|SPX)/i', 'courier' => 'spx'],
        ['pattern' => '/^(00|002|003|004)/i', 'courier' => 'sicepat'],
        ['pattern' => '/^(ANT|AJ)/i', 'courier' => 'anteraja'],
        ['pattern' => '/^(NLID|NINJAVAN)/i', 'courier' => 'ninja'],
        ['pattern' => '/^(TK)/i', 'courier' => 'tiki'],
        ['pattern' => '/^(IDX|IDE)/i', 'courier' => 'ide'],
        ['pattern' => '/^(LP)/i', 'courier' => 'lion'],
        ['pattern' => '/^(WH)/i', 'courier' => 'wahana'],
        ['pattern' => '/^(SAP)/i', 'courier' => 'sap'],
    ];

    // In-memory cache (static so it persists across requests in the same PHP process)
    private static array $cache = [];
    private const CACHE_TTL = 1800; // 30 minutes

    private function detectCourier(?string $provider): ?string
    {
        if (!$provider) return null;
        $norm = strtolower(trim($provider));
        if (isset($this->courierMap[$norm])) return $this->courierMap[$norm];
        foreach ($this->courierMap as $key => $code) {
            if (str_contains($norm, $key) || str_contains($key, $norm)) return $code;
        }
        return null;
    }

    private function detectCourierFromAwb(?string $awb): ?string
    {
        if (!$awb) return null;
        $norm = strtoupper(trim($awb));
        foreach ($this->awbPrefixes as $entry) {
            if (preg_match($entry['pattern'], $norm)) return $entry['courier'];
        }
        return null;
    }

    // GET /api/tracking
    public function track(Request $request)
    {
        $awb      = $request->query('awb');
        $courier  = $request->query('courier');
        $provider = $request->query('provider');

        if (!$awb || trim($awb) === '') {
            return response()->json(['error' => 'Nomor resi (awb) harus diisi'], 400);
        }

        $courierCode = $courier
            ?? $this->detectCourier($provider)
            ?? $this->detectCourierFromAwb($awb);

        if (!$courierCode) {
            return response()->json([
                'error' => 'Tidak dapat mendeteksi kurir. Silakan pilih kurir secara manual.',
                'availableCouriers' => array_values(array_unique(array_values($this->courierMap))),
            ], 400);
        }

        // Cache check
        $cacheKey = "{$courierCode}:".trim($awb);
        if (isset(self::$cache[$cacheKey])) {
            $entry = self::$cache[$cacheKey];
            if (time() - $entry['ts'] < self::CACHE_TTL) {
                return response()->json($entry['data']);
            }
            unset(self::$cache[$cacheKey]);
        }

        $apiKey = env('BINDERBYTE_API_KEY', 'e452fd43770c3434aa2b6b639cfe7150b182f4f93f7d5d716f9c124240e69322');
        $url = 'https://api.binderbyte.com/v1/track?api_key='.urlencode($apiKey)
            .'&courier='.urlencode($courierCode)
            .'&awb='.urlencode(trim($awb));

        try {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            $body   = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $data = json_decode($body, true);
            if (($data['status'] ?? null) == 200 || ($data['status'] ?? null) === 'success' || isset($data['data'])) {
                self::$cache[$cacheKey] = ['data' => $data, 'ts' => time()];
                return response()->json($data);
            }
            return response()->json(['error' => $data['message'] ?? 'Gagal melacak resi', 'raw' => $data], $status ?: 400);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal menghubungi layanan tracking: '.$e->getMessage()], 500);
        }
    }

    // GET /api/tracking/couriers
    public function couriers()
    {
        $unique = array_values(array_unique(array_values($this->courierMap)));
        sort($unique);
        return response()->json($unique);
    }
}
