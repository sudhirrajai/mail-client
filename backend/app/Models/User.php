<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_admin',
        'plan',
        'status',
        'max_storage_mb',
        'max_accounts',
        'ai_credits_monthly',
        'ai_credits_remaining',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'max_storage_mb' => 'integer',
            'max_accounts' => 'integer',
            'ai_credits_monthly' => 'integer',
            'ai_credits_remaining' => 'integer',
        ];
    }

    public function emailAccounts()
    {
        return $this->hasMany(EmailAccount::class);
    }

    public function isAdmin(): bool
    {
        return (bool) $this->is_admin || $this->role === 'admin';
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    public function canAddAccount(): bool
    {
        return $this->emailAccounts()->count() < $this->max_accounts;
    }
}
