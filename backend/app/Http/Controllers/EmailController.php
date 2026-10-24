<?php

namespace App\Http\Controllers;

use App\Models\Email;
use App\Models\EmailAccount;
use App\Services\SmtpMailService;
use App\Services\ImapSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Exception;

class EmailController extends Controller
{
    protected $smtpService;
    protected $imapService;

    public function __construct(SmtpMailService $smtpService, ImapSyncService $imapService)
    {
        $this->smtpService = $smtpService;
        $this->imapService = $imapService;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $accountIds = $user->emailAccounts()->pluck('id')->toArray();

        $query = Email::whereIn('email_account_id', $accountIds);

        if ($request->has('account_id') && !empty($request->account_id)) {
            $query->where('email_account_id', $request->account_id);
        }

        if ($request->has('folder') && $request->folder === 'Inbox') {
            $inboxSubjects = Email::whereIn('email_account_id', $accountIds)
                ->where('folder', 'Inbox')
                ->pluck('subject')
                ->map(function ($s) {
                    return strtolower(trim(preg_replace('/^(re|fwd|fw):\s*/i', '', $s)));
                })
                ->filter()
                ->unique()
                ->values()
                ->toArray();

            $query->where(function ($subQ) use ($inboxSubjects) {
                $subQ->where('folder', 'Inbox');
                if (!empty($inboxSubjects)) {
                    $subQ->orWhere(function ($orQ) use ($inboxSubjects) {
                        $orQ->where('folder', 'Sent');
                        $orQ->where(function ($subjQ) use ($inboxSubjects) {
                            foreach ($inboxSubjects as $s) {
                                $subjQ->orWhere('subject', 'like', "%{$s}%");
                            }
                        });
                    });
                }
            });
        } elseif ($request->has('folder') && $request->folder !== 'Starred') {
            $query->where('folder', $request->folder);
        } elseif ($request->folder === 'Starred') {
            $query->where('starred', true);
        }

        if ($request->has('filter')) {
            if ($request->filter === 'Unread') {
                $query->where('unread', true);
            } elseif ($request->filter === 'Starred') {
                $query->where('starred', true);
            } elseif ($request->filter === 'Has Attachments') {
                $query->whereNotNull('attachment');
            }
        }

        if ($request->has('tag') && !empty($request->tag)) {
            $tag = $request->tag;
            $query->where(function ($tq) use ($tag) {
                $tq->where('tags', 'like', "%\"{$tag}\"%")
                    ->orWhere('tags', 'like', "%{$tag}%");
            });
        }

        if ($request->has('query') && !empty($request->query('query'))) {
            $q = $request->query('query');
            $query->where(function ($sub) use ($q) {
                $sub->where('sender_name', 'like', "%{$q}%")
                    ->orWhere('sender_email', 'like', "%{$q}%")
                    ->orWhere('subject', 'like', "%{$q}%")
                    ->orWhere('preview', 'like', "%{$q}%")
                    ->orWhere('body_text', 'like', "%{$q}%");
            });
        }

        $emails = $query->select([
            'id', 'email_account_id', 'sender_name', 'sender_email',
            'recipient_to', 'recipient_cc', 'recipient_bcc',
            'initials', 'color', 'subject', 'preview', 'body_html', 'body_text', 'date_sent',
            'folder', 'unread', 'starred', 'tags', 'attachment'
        ])->orderBy('date_sent', 'desc')->orderBy('id', 'desc')->get();

        $formattedEmails = $emails->map(function ($email) {
            return $this->formatEmail($email);
        });

        $unreadCount = Email::whereIn('email_account_id', $accountIds)
            ->where('folder', 'Inbox')
            ->where('unread', true)
            ->count();

        $folderCounts = [
            'Inbox' => $unreadCount,
            'Starred' => Email::whereIn('email_account_id', $accountIds)->where('starred', true)->count(),
            'Sent' => Email::whereIn('email_account_id', $accountIds)->where('folder', 'Sent')->count(),
            'Drafts' => Email::whereIn('email_account_id', $accountIds)->where('folder', 'Drafts')->count(),
            'Archive' => Email::whereIn('email_account_id', $accountIds)->where('folder', 'Archive')->count(),
            'Spam' => Email::whereIn('email_account_id', $accountIds)->where('folder', 'Spam')->count(),
            'Trash' => Email::whereIn('email_account_id', $accountIds)->where('folder', 'Trash')->count(),
        ];

        // Dynamic Quota Lookup per selected account or active account
        $targetAccount = null;
        if ($request->has('account_id') && !empty($request->account_id)) {
            $targetAccount = EmailAccount::where('user_id', $user->id)->find($request->account_id);
        } elseif (count($accountIds) === 1) {
            $targetAccount = EmailAccount::where('user_id', $user->id)->find($accountIds[0]);
        }

        $storage = null;
        if ($targetAccount) {
            $quota = $this->imapService->getMailboxQuota($targetAccount);
            if ($quota) {
                $storage = $quota;
            } else {
                $totalEmailCount = Email::where('email_account_id', $targetAccount->id)->count();
                $usedMb = round($totalEmailCount * 0.45, 1);
                $isGmail = stripos($targetAccount->imap_host, 'gmail') !== false;
                $limitFormatted = $isGmail ? '15 GB' : '1 GB';
                $limitMb = $isGmail ? 15 * 1024 : 1024;
                $storage = [
                    'used_mb' => $usedMb,
                    'total_gb' => $isGmail ? 15 : 1,
                    'formatted' => "{$usedMb} MB / {$limitFormatted}",
                    'percentage' => max(1, min(100, round(($usedMb / $limitMb) * 100))),
                ];
            }
        } else {
            $totalEmailCount = Email::whereIn('email_account_id', $accountIds)->count();
            $usedMb = round($totalEmailCount * 0.45, 1);
            $storage = [
                'used_mb' => $usedMb,
                'total_gb' => 1,
                'formatted' => "{$usedMb} MB / Combined",
                'percentage' => min(100, round(($usedMb / 1024) * 100)),
            ];
        }

        return response()->json([
            'emails' => $formattedEmails,
            'unread_count' => $unreadCount,
            'folder_counts' => $folderCounts,
            'storage' => $storage,
        ]);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $accountIds = $user->emailAccounts()->pluck('id')->toArray();

        $email = Email::whereIn('email_account_id', $accountIds)->findOrFail($id);

        if ($email->unread) {
            $email->update(['unread' => false]);
        }

        return response()->json([
            'email' => $this->formatEmail($email),
        ]);
    }

    public function toggleStar(Request $request, $id)
    {
        $user = $request->user();
        $accountIds = $user->emailAccounts()->pluck('id')->toArray();

        $email = Email::whereIn('email_account_id', $accountIds)->findOrFail($id);
        $email->update(['starred' => !$email->starred]);

        if ($email->emailAccount) {
            $this->imapService->markStarredOnRemoteImap($email->emailAccount, $email, $email->starred);
        }

        return response()->json(['starred' => $email->starred]);
    }

    public function toggleRead(Request $request, $id)
    {
        $user = $request->user();
        $accountIds = $user->emailAccounts()->pluck('id')->toArray();

        $email = Email::whereIn('email_account_id', $accountIds)->findOrFail($id);
        $email->update(['unread' => $request->boolean('unread')]);

        if ($email->emailAccount) {
            $this->imapService->markReadOnRemoteImap($email->emailAccount, $email, $email->unread);
        }

        return response()->json(['unread' => $email->unread]);
    }

    public function moveToFolder(Request $request, $id)
    {
        $request->validate(['folder' => 'required|string|in:Inbox,Starred,Sent,Drafts,Archive,Spam,Trash']);
        $user = $request->user();
        $accountIds = $user->emailAccounts()->pluck('id')->toArray();

        $email = Email::whereIn('email_account_id', $accountIds)->findOrFail($id);
        $oldFolder = $email->folder;
        $targetFolder = $request->folder;

        $email->update(['folder' => $targetFolder]);

        if ($email->emailAccount && $oldFolder !== $targetFolder) {
            $this->imapService->moveEmailOnRemoteImap($email->emailAccount, $email, $targetFolder);
        }

        return response()->json(['success' => true, 'folder' => $email->folder]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $accountIds = $user->emailAccounts()->pluck('id')->toArray();

        $email = Email::whereIn('email_account_id', $accountIds)->findOrFail($id);

        if ($email->emailAccount) {
            $this->imapService->deleteFromRemoteImap($email->emailAccount, $email);
        }

        if ($email->folder === 'Trash') {
            $email->update(['folder' => 'DeletedPermanently']);
        } else {
            $email->update(['folder' => 'Trash']);
        }

        return response()->json(['success' => true]);
    }

    public function send(Request $request)
    {
        $request->validate([
            'account_id' => 'nullable',
            'to' => 'required|email',
            'subject' => 'required|string',
            'body' => 'required|string',
        ]);

        $account = null;
        if ($request->filled('account_id')) {
            $account = $request->user()->emailAccounts()->find($request->account_id);
        }

        if (!$account) {
            $account = $request->user()->emailAccounts()->where('is_default', true)->first()
                ?? $request->user()->emailAccounts()->first();
        }

        if (!$account) {
            return response()->json([
                'message' => 'No connected email account found. Please connect an SMTP email account in settings first.'
            ], 422);
        }

        try {
            $attachments = $request->input('attachments', []);

            // Send via SMTP Service
            $rawMime = $this->smtpService->send(
                $account,
                $request->to,
                $request->cc,
                $request->bcc,
                $request->subject,
                $request->body,
                $attachments,
                $request->input('in_reply_to'),
                $request->input('references')
            );

            // Append a copy to the remote IMAP "Sent" folder (cPanel / Roundcube / Dovecot)
            if (!empty($rawMime) && !empty($account->imap_host)) {
                try {
                    $this->imapService->appendSentMessage($account, $rawMime);
                } catch (\Throwable $imapEx) {
                    \Illuminate\Support\Facades\Log::warning('IMAP Sent Append warning: ' . $imapEx->getMessage());
                }
            }

            // Record in Sent folder
            $initials = strtoupper(substr($request->user()->name ?? 'Me', 0, 2));

            $attachmentMeta = null;
            if (!empty($attachments)) {
                $parsedList = [];
                foreach ($attachments as $att) {
                    $type = 'pdf';
                    if (isset($att['mime_type'])) {
                        if (strpos($att['mime_type'], 'image') !== false) $type = 'image';
                        else if (strpos($att['mime_type'], 'zip') !== false || strpos($att['mime_type'], 'rar') !== false) $type = 'zip';
                    }
                    $parsedList[] = [
                        'name' => $att['name'] ?? 'attachment',
                        'size' => $att['size'] ?? '1 MB',
                        'type' => $type,
                        'mime_type' => $att['mime_type'] ?? 'application/octet-stream',
                        'content_base64' => $att['content_base64'] ?? null,
                    ];
                }
                $attachmentMeta = count($parsedList) === 1 ? $parsedList[0] : $parsedList;
            }

            $createdEmail = Email::create([
                'email_account_id' => $account->id,
                'sender_name' => $account->name ?: $request->user()->name,
                'sender_email' => $account->email_address,
                'initials' => $initials,
                'color' => ImapSyncService::generateAvatarColor($account->email_address),
                'recipient_to' => $request->to,
                'recipient_cc' => $request->cc,
                'recipient_bcc' => $request->bcc,
                'subject' => $request->subject,
                'preview' => substr(strip_tags($request->body), 0, 100),
                'body_html' => $request->body,
                'body_text' => strip_tags($request->body),
                'date_sent' => now(),
                'folder' => 'Sent',
                'unread' => false,
                'starred' => false,
                'tags' => ImapSyncService::detectEmailTags($request->subject, $account->email_address),
                'attachment' => $attachmentMeta,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Email sent successfully via SMTP!',
                'email' => $this->formatEmail($createdEmail),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function saveDraft(Request $request)
    {
        $request->validate([
            'account_id' => 'nullable',
        ]);

        $account = null;
        if ($request->filled('account_id')) {
            $account = $request->user()->emailAccounts()->find($request->account_id);
        }
        if (!$account) {
            $account = $request->user()->emailAccounts()->where('is_default', true)->first()
                ?? $request->user()->emailAccounts()->first();
        }

        if (!$account) {
            return response()->json(['message' => 'No connected email account found.'], 422);
        }

        $id = $request->input('id');
        $initials = strtoupper(substr($request->user()->name ?? 'Me', 0, 2));

        $data = [
            'email_account_id' => $account->id,
            'sender_name' => $account->name ?: $request->user()->name,
            'sender_email' => $account->email_address,
            'initials' => $initials,
            'color' => ImapSyncService::generateAvatarColor($account->email_address),
            'recipient_to' => $request->to ?: '',
            'recipient_cc' => $request->cc,
            'recipient_bcc' => $request->bcc,
            'subject' => $request->subject ?: '(Draft No Subject)',
            'preview' => substr(strip_tags($request->body ?: ''), 0, 100),
            'body_html' => $request->body ?: '',
            'body_text' => strip_tags($request->body ?: ''),
            'date_sent' => now(),
            'folder' => 'Drafts',
            'unread' => false,
            'starred' => false,
            'tags' => ImapSyncService::detectEmailTags($request->subject ?: '', $account->email_address),
        ];

        if ($id) {
            $draft = Email::where('email_account_id', $account->id)->where('folder', 'Drafts')->find($id);
            if ($draft) {
                $draft->update($data);
                return response()->json([
                    'success' => true,
                    'message' => 'Draft updated successfully!',
                    'email' => $this->formatEmail($draft),
                ]);
            }
        }

        $draft = Email::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Draft saved successfully!',
            'email' => $this->formatEmail($draft),
        ]);
    }

    private function formatEmail(Email $email): array
    {
        return [
            'id' => $email->id,
            'email_account_id' => $email->email_account_id,
            'sender' => $email->sender_name ?: $email->sender_email,
            'sender_name' => $email->sender_name ?: $email->sender_email,
            'sender_email' => $email->sender_email,
            'email' => $email->sender_email,
            'recipient_to' => $email->recipient_to,
            'recipient_cc' => $email->recipient_cc,
            'recipient_bcc' => $email->recipient_bcc,
            'initials' => $email->initials ?: 'ME',
            'color' => $email->color ?: 'bg-indigo-600',
            'subject' => $email->subject,
            'preview' => $email->preview,
            'body_html' => $email->body_html,
            'body_text' => $email->body_text,
            'date_sent' => $email->date_sent ? Carbon::parse($email->date_sent)->toISOString() : now()->toISOString(),
            'time' => $email->date_sent ? Carbon::parse($email->date_sent)->diffForHumans() : 'Just now',
            'folder' => $email->folder,
            'unread' => (bool) $email->unread,
            'starred' => (bool) $email->starred,
            'tags' => $email->tags ?? [],
            'attachment' => $email->attachment,
        ];
    }
}
