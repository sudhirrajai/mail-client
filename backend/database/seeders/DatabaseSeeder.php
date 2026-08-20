<?php

namespace Database\Seeders;

use App\Models\Email;
use App\Models\EmailAccount;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::create([
            'name' => 'Alex Rivera',
            'email' => 'alex@work.com',
            'password' => Hash::make('password123'),
        ]);

        $account = EmailAccount::create([
            'user_id' => $user->id,
            'name' => 'Work Mail (Demo)',
            'email_address' => 'alex@work.com',
            'imap_host' => 'imap.gmail.com',
            'imap_port' => 993,
            'imap_encryption' => 'ssl',
            'imap_username' => 'alex@work.com',
            'imap_password' => 'demopassword',
            'smtp_host' => 'smtp.gmail.com',
            'smtp_port' => 465,
            'smtp_encryption' => 'ssl',
            'smtp_username' => 'alex@work.com',
            'smtp_password' => 'demopassword',
            'is_default' => true,
            'is_active' => true,
        ]);

        $folders = [
            'Inbox' => Folder::create(['email_account_id' => $account->id, 'name' => 'Inbox', 'type' => 'Inbox', 'unread_count' => 4, 'total_count' => 6]),
            'Starred' => Folder::create(['email_account_id' => $account->id, 'name' => 'Starred', 'type' => 'Starred', 'unread_count' => 0, 'total_count' => 2]),
            'Sent' => Folder::create(['email_account_id' => $account->id, 'name' => 'Sent', 'type' => 'Sent', 'unread_count' => 0, 'total_count' => 1]),
            'Drafts' => Folder::create(['email_account_id' => $account->id, 'name' => 'Drafts', 'type' => 'Drafts', 'unread_count' => 0, 'total_count' => 1]),
            'Archive' => Folder::create(['email_account_id' => $account->id, 'name' => 'Archive', 'type' => 'Archive', 'unread_count' => 0, 'total_count' => 1]),
            'Spam' => Folder::create(['email_account_id' => $account->id, 'name' => 'Spam', 'type' => 'Spam', 'unread_count' => 0, 'total_count' => 0]),
            'Trash' => Folder::create(['email_account_id' => $account->id, 'name' => 'Trash', 'type' => 'Trash', 'unread_count' => 0, 'total_count' => 0]),
        ];

        $demoEmails = [
            [
                'email_account_id' => $account->id,
                'folder_id' => $folders['Inbox']->id,
                'sender_name' => 'Maya Chen',
                'sender_email' => 'maya@linear.app',
                'initials' => 'MC',
                'color' => 'bg-sky-600',
                'recipient_to' => 'alex@work.com',
                'subject' => 'Your weekly project digest is ready',
                'preview' => 'Here is everything that moved forward across your teams this week.',
                'body_html' => '<p>Hi Alex,</p><p>Here is a quick update on the latest work. Everything is moving in the right direction and the team has made some great progress this week.</p><p>We have wrapped the first pass and are now focusing on the details that will make the launch feel polished. I\'ve included the latest files below for your review.</p><blockquote>"The best work happens when the whole team can see the same picture."</blockquote><p>Let me know what you think when you have a moment.</p><p>Best,<br>Maya Chen</p>',
                'body_text' => 'Hi Alex, Here is a quick update on the latest work. Everything is moving in the right direction...',
                'date_sent' => now()->subMinutes(15),
                'folder' => 'Inbox',
                'unread' => true,
                'starred' => true,
                'tags' => ['Work'],
                'attachment' => ['name' => 'project-digest.pdf', 'size' => '2.4 MB', 'type' => 'pdf'],
            ],
            [
                'email_account_id' => $account->id,
                'folder_id' => $folders['Inbox']->id,
                'sender_name' => 'The Verge',
                'sender_email' => 'briefing@theverge.com',
                'initials' => 'TV',
                'color' => 'bg-orange-500',
                'recipient_to' => 'alex@work.com',
                'subject' => 'The morning tech briefing',
                'preview' => 'A quieter week for hardware, but a very busy one for the cloud.',
                'body_html' => '<p>Hello Alex,</p><p>Welcome to today\'s morning tech briefing. Cloud innovation has hit a new milestone this month.</p>',
                'body_text' => 'Hello Alex, Welcome to today\'s morning tech briefing.',
                'date_sent' => now()->subHours(2),
                'folder' => 'Inbox',
                'unread' => true,
                'starred' => false,
                'tags' => ['Personal'],
            ],
            [
                'email_account_id' => $account->id,
                'folder_id' => $folders['Inbox']->id,
                'sender_name' => 'Figma',
                'sender_email' => 'receipts@figma.com',
                'initials' => 'FG',
                'color' => 'bg-pink-600',
                'recipient_to' => 'alex@work.com',
                'subject' => 'Your Figma invoice is available',
                'preview' => 'Your invoice for the Pro plan is ready to download.',
                'body_html' => '<p>Hi Alex,</p><p>Thanks for subscribing to Figma Pro. Your monthly invoice #4092 is attached.</p>',
                'body_text' => 'Thanks for subscribing to Figma Pro. Your invoice is attached.',
                'date_sent' => now()->subDay(),
                'folder' => 'Inbox',
                'unread' => true,
                'starred' => false,
                'tags' => ['Finance'],
                'attachment' => ['name' => 'invoice-august.pdf', 'size' => '184 KB', 'type' => 'pdf'],
            ],
            [
                'email_account_id' => $account->id,
                'folder_id' => $folders['Inbox']->id,
                'sender_name' => 'Jordan Lee',
                'sender_email' => 'jordan@company.com',
                'initials' => 'JL',
                'color' => 'bg-violet-600',
                'recipient_to' => 'alex@work.com',
                'subject' => 'Re: Launch plan — final thoughts',
                'preview' => 'This looks great. I added a few notes around the rollout sequence.',
                'body_html' => '<p>Hey Alex,</p><p>The launch plan v3 looks sharp. Let\'s proceed with Thursday\'s deployment.</p>',
                'body_text' => 'The launch plan v3 looks sharp. Let\'s proceed with Thursday\'s deployment.',
                'date_sent' => now()->subDays(2),
                'folder' => 'Inbox',
                'unread' => false,
                'starred' => true,
                'tags' => ['Urgent', 'Work'],
            ],
            [
                'email_account_id' => $account->id,
                'folder_id' => $folders['Sent']->id,
                'sender_name' => 'You',
                'sender_email' => 'alex@work.com',
                'initials' => 'AR',
                'color' => 'bg-indigo-600',
                'recipient_to' => 'jordan@company.com',
                'subject' => 'Launch plan — v3',
                'preview' => 'Sharing the latest version for review before tomorrow.',
                'body_html' => '<p>Jordan,</p><p>Attached is v3 of the rollout sequence.</p>',
                'body_text' => 'Attached is v3 of the rollout sequence.',
                'date_sent' => now()->subDays(3),
                'folder' => 'Sent',
                'unread' => false,
                'starred' => false,
                'tags' => ['Work'],
            ],
        ];

        foreach ($demoEmails as $e) {
            Email::create($e);
        }
    }
}
