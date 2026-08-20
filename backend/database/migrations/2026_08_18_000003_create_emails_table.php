<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_account_id')->constrained('email_accounts')->onDelete('cascade');
            $table->foreignId('folder_id')->nullable()->constrained('folders')->onDelete('cascade');
            $table->string('message_id')->nullable();
            $table->unsignedBigInteger('uid')->nullable();
            $table->string('sender_name')->default('');
            $table->string('sender_email')->default('');
            $table->string('initials')->default('EM');
            $table->string('color')->default('bg-sky-600');
            $table->string('recipient_to')->default('');
            $table->string('recipient_cc')->nullable();
            $table->string('recipient_bcc')->nullable();
            $table->string('subject')->default('(No Subject)');
            $table->text('preview')->nullable();
            $table->longText('body_html')->nullable();
            $table->longText('body_text')->nullable();
            $table->dateTime('date_sent')->nullable();
            $table->string('folder')->default('Inbox');
            $table->boolean('unread')->default(true);
            $table->boolean('starred')->default(false);
            $table->json('tags')->nullable();
            $table->json('attachment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('emails');
    }
};
