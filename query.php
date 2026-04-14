<?php
$rows1 = DB::select("SELECT u.filename, count(*) as c FROM returns_data r JOIN uploads u ON r.upload_id = u.id GROUP BY u.filename");
echo "returns_data:\n";
print_r($rows1);

$rows2 = DB::select("SELECT u.filename, count(*) as c FROM pengembalian p JOIN uploads u ON p.upload_id = u.id GROUP BY u.filename");
echo "pengembalian:\n";
print_r($rows2);
