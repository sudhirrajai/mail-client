<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class EmailAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'email_address',
        'imap_host',
        'imap_port',
        'imap_encryption',
        'imap_username',
        'imap_password',
        'smtp_host',
        'smtp_port',
        'smtp_encryption',
        'smtp_username',
        'smtp_password',
        'is_default',
        'is_active',
    ];

    protected $hidden = [
        'imap_password',
        'smtp_password',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'imap_port' => 'integer',
            'smtp_port' => 'integer',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function folders()
    {
        return $this->hasMany(Folder::class);
    }

    public function emails()
    {
        return $this->hasMany(Email::class);
    }

    // Encrypt & Decrypt Passwords safely
    public function setImapPasswordAttribute($value)
    {
        $this->attributes['imap_password'] = Crypt::encryptString($value);
    }

    public function getDecryptedImapPasswordAttribute()
    {
        return Crypt::decryptString($this->attributes['imap_password']);
    }

    public function setSmtpPasswordAttribute($value)
    {
        $this->attributes['smtp_password'] = Crypt::encryptString($value);
    }

    public function getDecryptedSmtpPasswordAttribute()
    {
        return Crypt::decryptString($this->attributes['smtp_password']);
    }
}
