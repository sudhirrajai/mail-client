<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Folder extends Model
{
    use HasFactory;

    protected $fillable = [
        'email_account_id',
        'name',
        'type',
        'remote_name',
        'unread_count',
        'total_count',
    ];

    public function emailAccount()
    {
        return $this->belongsTo(EmailAccount::class);
    }

    public function emails()
    {
        return $this->hasMany(Email::class);
    }
}
