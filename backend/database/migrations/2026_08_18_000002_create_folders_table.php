<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('folders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_account_id')->constrained('email_accounts')->onDelete('cascade');
            $table->string('name');
            $table->enum('type', ['Inbox', 'Starred', 'Sent', 'Drafts', 'Archive', 'Spam', 'Trash'])->default('Inbox');
            $table->string('remote_name')->default('INBOX');
            $table->integer('unread_count')->default(0);
            $table->integer('total_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('folders');
    }
};
