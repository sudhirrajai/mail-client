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
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->after('password'); // 'admin', 'user'
            $table->boolean('is_admin')->default(false)->after('role');
            $table->string('plan')->default('free')->after('is_admin'); // 'free', 'pro', 'enterprise'
            $table->string('status')->default('active')->after('plan'); // 'active', 'suspended'
            $table->integer('max_storage_mb')->default(1000)->after('status'); // Storage limit in MB
            $table->integer('max_accounts')->default(1)->after('max_storage_mb'); // Max email accounts allowed
            $table->integer('ai_credits_monthly')->default(50)->after('max_accounts');
            $table->integer('ai_credits_remaining')->default(50)->after('ai_credits_monthly');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'role',
                'is_admin',
                'plan',
                'status',
                'max_storage_mb',
                'max_accounts',
                'ai_credits_monthly',
                'ai_credits_remaining',
            ]);
        });
    }
};
