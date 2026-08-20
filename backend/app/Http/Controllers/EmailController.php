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

        if ($request->has('query') && !empty($request->query('query'))) {
            $q = $request->query('query');
            $query->where(function ($sub) use ($q) {
                $sub->where('sender_name', 'like', "%{$q}%")
                    ->orWhere('sender_email', 'like', "%{$q}%")
                    ->orWhere('subject', 'like', "%{$q}%")
                    ->orWhere('preview', 'like', "%{$q}%");
            });
        }

        $emails = $query->select([
            'id', 'email_account_id', 'sender_name', 'sender_email',
            'initials', 'color', 'subject', 'preview', 'date_sent',
            'folder', 'unread', 'starred', 'tags', 'attachment'
        ])->orderBy('date_sent', 'desc')->orderBy('id', 'desc')->get();

        $formattedEmails = $emails->map(function ($email) {
            return [
                'id' => $email->id,
                'email_account_id' => $email->email_account_id,
                'sender' => $email->sender_name ?: $email->sender_email,
                'email' => $email->sender_email,
                'initials' => $email->initials,
                'color' => $email->color,
                'subject' => $email->subject,
                'preview' => $email->preview,
                'time' => $email->date_sent ? Carbon::parse($email->date_sent)->diffForHumans() : 'Just now',
                'folder' => $email->folder,
                'unread' => (bool) $email->unread,
                'starred' => (bool) $email->starred,
                'tags' => $email->tags ?? [],
                'attachment' => $email->attachment,
            ];
        });

        $unreadCount = Email::whereIn('email_account_id', $accountIds)
            ->where('folder', 'Inbox')
            ->where('unread', true)
            ->count();

        return response()->json([
            'emails' => $formattedEmails,
            'unread_count' => $unreadCount,
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
            'email' => [
                'id' => $email->id,
                'email_account_id' => $email->email_account_id,
                'sender' => $email->sender_name ?: $email->sender_email,
                'email' => $email->sender_email,
                'initials' => $email->initials,
                'color' => $email->color,
                'subject' => $email->subject,
                'preview' => $email->preview,
                'time' => $email->date_sent ? Carbon::parse($email->date_sent)->format('M d, Y h:i A') : 'Just now',
                'folder' => $email->folder,
                'unread' => (bool) $email->unread,
                'starred' => (bool) $email->starred,
                'tags' => $email->tags ?? [],
                'attachment' => $email->attachment,
                'body_html' => $email->body_html,
                'body_text' => $email->body_text,
            ],
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
        $request->validate(['folder' => 'required|string']);
        $user = $request->user();
        $accountIds = $user->emailAccounts()->pluck('id')->toArray();

        $email = Email::whereIn('email_account_id', $accountIds)->findOrFail($id);
        $email->update(['folder' => $request->folder]);

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
            $this->smtpService->send(
                $account,
                $request->to,
                $request->cc,
                $request->bcc,
                $request->subject,
                $request->body,
                $attachments
            );

            // Record in Sent folder
            $initials = strtoupper(substr($request->user()->name ?? 'Me', 0, 2));

            $attachmentMeta = null;
            if (!empty($attachments)) {
                $first = $attachments[0];
                $type = 'pdf';
                if (isset($first['mime_type'])) {
                    if (strpos($first['mime_type'], 'image') !== false) $type = 'image';
                    else if (strpos($first['mime_type'], 'zip') !== false || strpos($first['mime_type'], 'rar') !== false) $type = 'zip';
                }
                $attachmentMeta = [
                    'name' => $first['name'] ?? 'attachment',
                    'size' => $first['size'] ?? '1 MB',
                    'type' => $type,
                ];
            }

            $createdEmail = Email::create([
                'email_account_id' => $account->id,
                'sender_name' => $account->name ?: $request->user()->name,
                'sender_email' => $account->email_address,
                'initials' => $initials,
                'color' => 'bg-indigo-600',
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
                'tags' => ['Work'],
                'attachment' => $attachmentMeta,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Email sent successfully via SMTP!',
                'email' => $createdEmail,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
