<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('emails', function (Blueprint $table) {
            $table->string('in_reply_to')->nullable()->after('message_id');
            $table->text('references')->nullable()->after('in_reply_to');
            $table->index('in_reply_to', 'idx_emails_in_reply_to');
            $table->index('message_id', 'idx_emails_message_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('emails', function (Blueprint $table) {
            $table->dropIndex('idx_emails_in_reply_to');
            $table->dropIndex('idx_emails_message_id');
            $table->dropColumn(['in_reply_to', 'references']);
        });
    }
};
