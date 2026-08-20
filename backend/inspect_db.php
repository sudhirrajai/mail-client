<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Email;

foreach (Email::all() as $e) {
    echo "ID: {$e->id} | Acc: {$e->email_account_id} | Folder: {$e->folder} | Subj: {$e->subject} | Body: " . substr(strip_tags($e->body_html), 0, 100) . "\n";
}
