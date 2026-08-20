<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Email extends Model
{
    use HasFactory;

    protected $fillable = [
        'email_account_id',
        'folder_id',
        'message_id',
        'uid',
        'sender_name',
        'sender_email',
        'initials',
        'color',
        'recipient_to',
        'recipient_cc',
        'recipient_bcc',
        'subject',
        'preview',
        'body_html',
        'body_text',
        'date_sent',
        'folder',
        'unread',
        'starred',
        'tags',
        'attachment',
    ];

    protected $casts = [
        'unread' => 'boolean',
        'starred' => 'boolean',
        'tags' => 'array',
        'attachment' => 'array',
        'date_sent' => 'datetime',
    ];

    public function emailAccount()
    {
        return $this->belongsTo(EmailAccount::class);
    }

    public function folderModel()
    {
        return $this->belongsTo(Folder::class, 'folder_id');
    }
}
