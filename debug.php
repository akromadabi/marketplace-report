<?php
require __DIR__.'/marketplace-api/vendor/autoload.php';
$app = require_once __DIR__.'/marketplace-api/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$uploads = DB::table('uploads')->select('id','filename','created_at', 'row_count')->orderBy('created_at','desc')->get();
foreach($uploads as $u) {
    echo $u->id . ' | ' . $u->filename . ' | ' . $u->created_at . ' | ' . $u->row_count . "\n";
}
