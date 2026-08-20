<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('emails', function (Blueprint $table) {
            $table->index(['email_account_id', 'folder', 'date_sent'], 'idx_acc_folder_date');
            $table->index(['email_account_id', 'folder', 'unread'], 'idx_acc_folder_unread');
            $table->index(['email_account_id', 'starred'], 'idx_acc_starred');
            $table->index(['uid'], 'idx_uid');
        });
    }

    public function down(): void
    {
        Schema::table('emails', function (Blueprint $table) {
            $table->dropIndex('idx_acc_folder_date');
            $table->dropIndex('idx_acc_folder_unread');
            $table->dropIndex('idx_acc_starred');
            $table->dropIndex('idx_uid');
        });
    }
};
