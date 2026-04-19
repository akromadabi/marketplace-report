<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\DataController;
use App\Http\Controllers\ModalController;
use App\Http\Controllers\TrackingController;
use App\Http\Controllers\ScanController;
use App\Http\Controllers\AsetController;
use App\Http\Controllers\OperasionalController;
use App\Http\Controllers\PromoController;
use Illuminate\Support\Facades\DB;

// Handle OPTIONS preflight requests
Route::options('{any}', function () {
    return response()->json([], 200);
})->where('any', '.*');

// Health check
Route::get('/health', function () {
    return response()->json(['status' => 'ok', 'timestamp' => now()->toISOString()]);
});

// ─── Auth ───────────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/users', [AuthController::class, 'listUsers']);
    Route::post('/users', [AuthController::class, 'createUser']);
    Route::put('/users/{id}', [AuthController::class, 'updateUser']);
    Route::delete('/users/{id}', [AuthController::class, 'deleteUser']);
    Route::get('/roles', [AuthController::class, 'getRoles']);
    Route::put('/roles/{className}', [AuthController::class, 'updateRole']);
    Route::get('/permissions/{className}', [AuthController::class, 'getPermissions']);
    Route::get('/limits', [AuthController::class, 'getLimits']);
    Route::put('/limits/{className}', [AuthController::class, 'updateLimits']);
    Route::get('/usage/{userId}', [AuthController::class, 'getUsage']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
});

// ─── Stores ─────────────────────────────────────────────────────────
Route::prefix('stores')->group(function () {
    Route::get('/all', [StoreController::class, 'all']);
    Route::get('/', [StoreController::class, 'index']);
    Route::post('/', [StoreController::class, 'store']);
    Route::put('/{id}', [StoreController::class, 'update']);
    Route::delete('/{id}', [StoreController::class, 'destroy']);
});

Route::get('/logos/{filename}', function ($filename) {
    $path = public_path('logos/' . $filename);
    if (file_exists($path)) {
        return response()->file($path);
    }
    return redirect('/favicon.ico');
});

Route::post('/settings/logo', function (Illuminate\Http\Request $request) {
    $base64Data = $request->input('logo_data');
    if (!$base64Data) return response()->json(['error' => 'No logo data'], 400);
    
    if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $type)) {
        $data = substr($base64Data, strpos($base64Data, ',') + 1);
        $data = base64_decode($data);
        if ($data === false) return response()->json(['error' => 'Invalid base64'], 400);
        
        $path = public_path('logos/default_logo.png');
        if (!Illuminate\Support\Facades\File::exists(public_path('logos'))) {
            Illuminate\Support\Facades\File::makeDirectory(public_path('logos'), 0755, true);
        }
        file_put_contents($path, $data);
        return response()->json(['success' => true]);
    }
    return response()->json(['error' => 'Invalid image format'], 400);
});

// ─── Upload ─────────────────────────────────────────────────────────
Route::prefix('upload')->group(function () {
    Route::post('/', [UploadController::class, 'upload']);
    Route::post('/parsed', [UploadController::class, 'uploadParsed']);
    Route::get('/history', [UploadController::class, 'history']);
    Route::delete('/{id}', [UploadController::class, 'destroy']);
    Route::post('/assign-store', [UploadController::class, 'assignStore']);
});

// ─── Data ───────────────────────────────────────────────────────────
Route::prefix('data')->group(function () {
    Route::get('/orders', [DataController::class, 'orders']);
    Route::get('/payments', [DataController::class, 'payments']);
    Route::get('/returns', [DataController::class, 'returns']);
    Route::get('/pengembalian', [DataController::class, 'pengembalian']);
    Route::get('/stats', [DataController::class, 'stats']);
    Route::delete('/clear', [DataController::class, 'clear']);
});

// ─── Fee Profiles ───────────────────────────────────────────────────
Route::prefix('fee-profiles')->group(function () {
    Route::get('/', [\App\Http\Controllers\FeeProfileController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\FeeProfileController::class, 'store']);
    Route::put('/{id}', [\App\Http\Controllers\FeeProfileController::class, 'update']);
    Route::delete('/{id}', [\App\Http\Controllers\FeeProfileController::class, 'destroy']);
});

// ─── Modal (HPP) ────────────────────────────────────────────────────
Route::prefix('modal')->group(function () {
    Route::get('/', [ModalController::class, 'index']);
    Route::put('/', [ModalController::class, 'saveAll']);
    Route::put('/single', [ModalController::class, 'saveSingle']);
});

// ─── Tracking ───────────────────────────────────────────────────────
Route::prefix('tracking')->group(function () {
    Route::get('/', [TrackingController::class, 'track']);
    Route::get('/couriers', [TrackingController::class, 'couriers']);
});

// ─── Scan ────────────────────────────────────────────────────────────
Route::prefix('scan')->group(function () {
    Route::get('/', [ScanController::class, 'index']);
    Route::post('/', [ScanController::class, 'store']);
    Route::delete('/{id}', [ScanController::class, 'destroy']);
});

// ─── Aset ────────────────────────────────────────────────────────────
Route::prefix('aset')->group(function () {
    Route::get('/', [AsetController::class, 'index']);
    Route::post('/', [AsetController::class, 'store']);
    Route::put('/{id}', [AsetController::class, 'update']);
    Route::delete('/{id}', [AsetController::class, 'destroy']);
});

// ─── Promo TikTok ─────────────────────────────────────────────────────
Route::prefix('promo')->group(function () {
    Route::get('/', [\App\Http\Controllers\PromoController::class, 'index']);
    Route::post('/upload', [\App\Http\Controllers\PromoController::class, 'upload']);
    Route::put('/batch', [\App\Http\Controllers\PromoController::class, 'batch']);
    Route::delete('/', [\App\Http\Controllers\PromoController::class, 'destroy']);

    // Templates & Presets
    Route::get('/templates', [\App\Http\Controllers\CampaignTemplateController::class, 'index']);
    Route::post('/templates', [\App\Http\Controllers\CampaignTemplateController::class, 'store']);
    Route::delete('/templates/{id}', [\App\Http\Controllers\CampaignTemplateController::class, 'destroy']);
});

// ─── Promo Shopee ─────────────────────────────────────────────────────
Route::prefix('promo-shopee')->group(function () {
    Route::get('/', [\App\Http\Controllers\PromoShopeeController::class, 'index']);
    Route::post('/upload', [\App\Http\Controllers\PromoShopeeController::class, 'upload']);
    Route::put('/batch', [\App\Http\Controllers\PromoShopeeController::class, 'batch']);
    Route::delete('/', [\App\Http\Controllers\PromoShopeeController::class, 'destroy']);
});


// ─── Operasional ───────────────────────────────────────────────────────────
Route::prefix('operasional')->group(function () {
    Route::get('/', [OperasionalController::class, 'index']);
    Route::post('/', [OperasionalController::class, 'store']);
    Route::put('/{id}', [OperasionalController::class, 'update']);
    Route::delete('/{id}', [OperasionalController::class, 'destroy']);
});

// ─── Pricing Simulations ───────────────────────────────────────────────────────────
Route::get('/pricing-simulations', [App\Http\Controllers\PricingSimulationController::class, 'index']);
Route::post('/pricing-simulations/sync', [App\Http\Controllers\PricingSimulationController::class, 'sync']);