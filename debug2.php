<?php
require __DIR__.'/marketplace-api/vendor/autoload.php';
$app = require_once __DIR__.'/marketplace-api/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$uploads = DB::table('uploads')->select('id','filename','user_id','store_id')->get();
foreach($uploads as $u) {
    if (strpos($u->filename, 'Data Input Return') !== false || strpos($u->filename, 'new-Pesanan') !== false) {
        echo $u->id . ' | ' . $u->filename . ' | user:' . $u->user_id . ' | store:' . $u->store_id . "\n";
    }
}
