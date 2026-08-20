<?php

namespace App\Services;

use App\Models\Email;
use App\Models\EmailAccount;
use App\Models\Folder;
use Exception;
use Illuminate\Support\Carbon;

class ImapSyncService
{
    /**
     * Test IMAP connection using stream socket client
     */
    public function testConnection(array $config): array
    {
        try {
            $host = $config['imap_host'];
            $port = (int) $config['imap_port'];
            $encryption = strtolower($config['imap_encryption'] ?? 'ssl');
            $username = $config['imap_username'];
            $password = $config['imap_password'];

            if (function_exists('imap_open')) {
                $flags = '/imap';
                if ($encryption === 'ssl' || $port == 993) $flags .= '/ssl/novalidate-cert';
                elseif ($encryption === 'tls') $flags .= '/tls/novalidate-cert';
                else $flags .= '/notls';

                $mailbox = "{" . $host . ":" . $port . $flags . "}INBOX";
                $mbox = @imap_open($mailbox, $username, $password, 0, 1);
                if ($mbox) {
                    imap_close($mbox);
                    return ['success' => true, 'message' => 'IMAP connection & authentication successful!'];
                }
            }

            $prefix = ($encryption === 'ssl' || $port == 993) ? 'ssl://' : ($encryption === 'tls' ? 'tls://' : '');
            $context = stream_context_create([
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                ]
            ]);

            $stream = @stream_socket_client(
                $prefix . $host . ':' . $port,
                $errno,
                $errstr,
                10,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if (!$stream) {
                return ['success' => false, 'message' => "IMAP connection failed to $host:$port — $errstr ($errno)"];
            }

            fgets($stream, 512);

            $tag = 'A001';
            fputs($stream, "$tag LOGIN \"$username\" \"$password\"\r\n");

            $loginResponse = '';
            while ($line = fgets($stream, 512)) {
                $loginResponse .= $line;
                if (strpos($line, $tag) === 0) break;
            }

            fclose($stream);

            if (strpos($loginResponse, "$tag OK") !== false) {
                return ['success' => true, 'message' => 'IMAP connection & login successful!'];
            }

            return ['success' => false, 'message' => 'IMAP Authentication failed. Check your username and password/App Password.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'IMAP Error: ' . $e->getMessage()];
        }
    }

    /**
     * Decode MIME headers & Quoted-Printable strings
     */
    private function decodeMimeHeader(string $text): string
    {
        if (empty($text)) return '';

        // Decode MIME headers (=?UTF-8?B?...?= or =?UTF-8?Q?...?=)
        if (function_exists('mb_decode_mime_header')) {
            $text = mb_decode_mime_header($text);
        } elseif (function_exists('iconv_mime_decode')) {
            $text = iconv_mime_decode($text, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
        }

        // Decode Quoted-Printable (=3D, =20, etc.)
        if (strpos($text, '=3D') !== false || strpos($text, "=\r\n") !== false) {
            $text = quoted_printable_decode($text);
        }

        return trim(strip_tags($text));
    }

    private function cleanSender(string $rawFrom, string $fallbackEmail): array
    {
        $rawFrom = $this->decodeMimeHeader($rawFrom);
        $name = '';
        $email = $fallbackEmail;

        if (preg_match('/(.*?)<([^>]+)>/', $rawFrom, $matches)) {
            $name = trim($matches[1], '"\' ');
            $email = trim($matches[2]);
        } elseif (filter_var($rawFrom, FILTER_VALIDATE_EMAIL)) {
            $name = explode('@', $rawFrom)[0];
            $email = $rawFrom;
        } else {
            $name = $rawFrom;
        }

        $name = strip_tags($name);
        if (empty($name)) {
            $name = explode('@', $email)[0];
        }

        return [$name, $email];
    }

    private function cleanProtocolNoise(string $text): string
    {
        // Strip IMAP socket protocol headers
        $text = preg_replace('/^\*\s*\d+\s*FETCH\s*\([^\r\n]*\r?\n/i', '', $text);
        $text = preg_replace('/BODY\[HEADER\.FIELDS[^\r\n]*\r?\n/i', '', $text);
        $text = preg_replace('/BODY\[TEXT\][^\r\n]*\r?\n/i', '', $text);
        $text = preg_replace('/A00F\d+\s+OK\s+Fetch\s+completed[^\r\n]*/i', '', $text);
        return trim($text);
    }

    /**
     * Extract full HTML and Plain text body from MIME multipart or singlepart text
     */
    private function parseMimeBody(string $rawBody): array
    {
        $rawBody = $this->cleanProtocolNoise($rawBody);
        $htmlBody = '';
        $textBody = '';

        // Check if Quoted-Printable
        if (strpos($rawBody, '=3D') !== false || strpos($rawBody, "=\r\n") !== false) {
            $decoded = quoted_printable_decode($rawBody);
        } else {
            $decoded = $rawBody;
        }

        // Extract boundary if multipart
        if (preg_match('/boundary="?([^"\r\n]+)"?/i', $rawBody, $bMatches)) {
            $boundary = $bMatches[1];
            $parts = explode('--' . $boundary, $rawBody);

            foreach ($parts as $part) {
                if (preg_match('/Content-Type:\s*text\/html/i', $part)) {
                    $bodyContent = preg_replace('/^[\s\S]*?\r\n\r\n/', '', $part);
                    if (preg_match('/Content-Transfer-Encoding:\s*base64/i', $part)) {
                        $bodyContent = base64_decode(trim($bodyContent));
                    } elseif (preg_match('/Content-Transfer-Encoding:\s*quoted-printable/i', $part)) {
                        $bodyContent = quoted_printable_decode($bodyContent);
                    }
                    $htmlBody = trim($bodyContent);
                } elseif (preg_match('/Content-Type:\s*text\/plain/i', $part)) {
                    $bodyContent = preg_replace('/^[\s\S]*?\r\n\r\n/', '', $part);
                    if (preg_match('/Content-Transfer-Encoding:\s*base64/i', $part)) {
                        $bodyContent = base64_decode(trim($bodyContent));
                    } elseif (preg_match('/Content-Transfer-Encoding:\s*quoted-printable/i', $part)) {
                        $bodyContent = quoted_printable_decode($bodyContent);
                    }
                    $textBody = trim($bodyContent);
                }
            }
        }

        if (empty($htmlBody) && empty($textBody)) {
            if (preg_match('/<html[\s\S]*<\/html>/i', $decoded, $hMatch)) {
                $htmlBody = $hMatch[0];
            } else {
                $textBody = strip_tags($decoded);
                $htmlBody = "<p>" . nl2br(e($textBody)) . "</p>";
            }
        }

        if (empty($textBody)) {
            $textBody = strip_tags($htmlBody);
        }

        return [
            'html' => $htmlBody ?: "<p>" . nl2br(e($textBody)) . "</p>",
            'text' => $textBody,
        ];
    }

    /**
     * Recursively fetch full body parts via ext-imap
     */
    private function fetchExtImapBody($mbox, int $msgNumber): array
    {
        $structure = @imap_fetchstructure($mbox, $msgNumber);
        $htmlBody = '';
        $textBody = '';

        if (!empty($structure) && !empty($structure->parts)) {
            foreach ($structure->parts as $partNum => $part) {
                $partIndex = (string) ($partNum + 1);
                $data = imap_fetchbody($mbox, $msgNumber, $partIndex);

                if (isset($part->encoding)) {
                    if ($part->encoding === 3) $data = base64_decode($data);
                    elseif ($part->encoding === 4) $data = quoted_printable_decode($data);
                }

                if (isset($part->subtype) && strtolower($part->subtype) === 'html') {
                    $htmlBody .= $data;
                } elseif (isset($part->subtype) && strtolower($part->subtype) === 'plain') {
                    $textBody .= $data;
                }
            }
        }

        if (empty($htmlBody) && empty($textBody)) {
            $data = imap_body($mbox, $msgNumber);
            $parsed = $this->parseMimeBody($data);
            $htmlBody = $parsed['html'];
            $textBody = $parsed['text'];
        }

        return [
            'html' => $htmlBody ?: "<p>" . nl2br(e($textBody)) . "</p>",
            'text' => $textBody ?: strip_tags($htmlBody),
        ];
    }

    /**
     * Sync default folders and fetch full emails (Inbox & Sent) for an EmailAccount
     */
    public function syncAccount(EmailAccount $account): array
    {
        // Ensure default folders exist for this account
        $defaultFolders = [
            ['name' => 'Inbox', 'type' => 'Inbox', 'remote_name' => 'INBOX'],
            ['name' => 'Starred', 'type' => 'Starred', 'remote_name' => 'INBOX'],
            ['name' => 'Sent', 'type' => 'Sent', 'remote_name' => 'Sent'],
            ['name' => 'Drafts', 'type' => 'Drafts', 'remote_name' => 'Drafts'],
            ['name' => 'Archive', 'type' => 'Archive', 'remote_name' => 'Archive'],
            ['name' => 'Spam', 'type' => 'Spam', 'remote_name' => 'Spam'],
            ['name' => 'Trash', 'type' => 'Trash', 'remote_name' => 'Trash'],
        ];

        foreach ($defaultFolders as $df) {
            Folder::firstOrCreate([
                'email_account_id' => $account->id,
                'name' => $df['name'],
            ], [
                'type' => $df['type'],
                'remote_name' => $df['remote_name'],
                'unread_count' => 0,
                'total_count' => 0,
            ]);
        }

        $inboxFolder = Folder::where('email_account_id', $account->id)->where('type', 'Inbox')->first();
        $sentFolder = Folder::where('email_account_id', $account->id)->where('type', 'Sent')->first();
        $fetchedCount = 0;

        $host = $account->imap_host;
        $port = (int) $account->imap_port;
        $encryption = strtolower($account->imap_encryption);
        $username = $account->imap_username;
        $password = $account->decrypted_imap_password;

        // 1. Try php ext-imap if available
        if (function_exists('imap_open')) {
            try {
                $flags = '/imap';
                if ($encryption === 'ssl' || $port == 993) $flags .= '/ssl/novalidate-cert';
                elseif ($encryption === 'tls') $flags .= '/tls/novalidate-cert';
                else $flags .= '/notls';

                $folderTargets = [
                    'INBOX' => ['folder_name' => 'Inbox', 'model' => $inboxFolder],
                    'Sent' => ['folder_name' => 'Sent', 'model' => $sentFolder],
                    'INBOX.Sent' => ['folder_name' => 'Sent', 'model' => $sentFolder],
                ];

                foreach ($folderTargets as $remoteFolder => $targetInfo) {
                    $mailbox = "{" . $host . ":" . $port . $flags . "}" . $remoteFolder;
                    $mbox = @imap_open($mailbox, $username, $password, 0, 1);

                    if ($mbox) {
                        $numMsgs = imap_num_msg($mbox);
                        if ($numMsgs > 0) {
                            $start = max(1, $numMsgs - 25);
                            for ($i = $numMsgs; $i >= $start; $i--) {
                                $header = imap_headerinfo($mbox, $i);
                                $uid = imap_uid($mbox, $i);

                                $rawFrom = isset($header->from[0]->personal) ? $header->from[0]->personal : '';
                                $fallbackEmail = isset($header->from[0]->mailbox) && isset($header->from[0]->host)
                                    ? $header->from[0]->mailbox . '@' . $header->from[0]->host
                                    : $username;

                                [$from, $senderEmail] = $this->cleanSender($rawFrom ?: $fallbackEmail, $fallbackEmail);
                                $subject = isset($header->subject) ? $this->decodeMimeHeader($header->subject) : '(No Subject)';
                                $dateStr = isset($header->date) ? Carbon::parse($header->date) : now();

                                $bodyParsed = $this->fetchExtImapBody($mbox, $i);
                                $bodyText = $bodyParsed['text'];
                                $bodyHtml = $bodyParsed['html'];

                                $existingEmail = Email::where('email_account_id', $account->id)
                                    ->where(function ($q) use ($uid, $subject) {
                                        if ($uid) {
                                            $q->where('uid', $uid);
                                        } else {
                                            $q->where('subject', $subject);
                                        }
                                    })
                                    ->first();

                                $initials = strtoupper(substr($from ?: 'EM', 0, 2));

                                if ($existingEmail) {
                                    // Update existing placeholder with full body if missing
                                    if (strpos($existingEmail->body_html, 'Message synced via IMAP socket.') !== false || strlen($existingEmail->body_html) < 200) {
                                        $existingEmail->update([
                                            'body_html' => $bodyHtml,
                                            'body_text' => $bodyText,
                                            'preview' => substr($bodyText ?: $subject, 0, 120),
                                        ]);
                                    }
                                } else {
                                    Email::create([
                                        'email_account_id' => $account->id,
                                        'folder_id' => $targetInfo['model'] ? $targetInfo['model']->id : null,
                                        'uid' => $uid,
                                        'sender_name' => $from,
                                        'sender_email' => $senderEmail,
                                        'initials' => $initials,
                                        'color' => 'bg-emerald-600',
                                        'recipient_to' => $account->email_address,
                                        'subject' => $subject,
                                        'preview' => substr($bodyText ?: $subject, 0, 120),
                                        'body_html' => $bodyHtml,
                                        'body_text' => $bodyText,
                                        'date_sent' => $dateStr,
                                        'folder' => $targetInfo['folder_name'],
                                        'unread' => ($targetInfo['folder_name'] === 'Inbox'),
                                        'starred' => false,
                                        'tags' => ['Work'],
                                    ]);
                                    $fetchedCount++;
                                }
                            }
                        }
                        imap_close($mbox);
                    }
                }

                $this->updateFolderCounts($account, $inboxFolder);
                return [
                    'success' => true,
                    'message' => "Sync completed via IMAP. $fetchedCount new messages fetched.",
                    'fetched_count' => $fetchedCount,
                ];
            } catch (Exception $e) {
                // Fallback to socket stream
            }
        }

        // 2. Socket Stream IMAP Client with Full Body Fetching
        try {
            $prefix = ($encryption === 'ssl' || $port == 993) ? 'ssl://' : ($encryption === 'tls' ? 'tls://' : '');
            $context = stream_context_create([
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                ]
            ]);

            $stream = @stream_socket_client(
                $prefix . $host . ':' . $port,
                $errno,
                $errstr,
                15,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if ($stream) {
                fgets($stream, 512); // Banner

                fputs($stream, "A001 LOGIN \"$username\" \"$password\"\r\n");
                $loginRes = '';
                while ($line = fgets($stream, 512)) {
                    $loginRes .= $line;
                    if (strpos($line, 'A001') === 0) break;
                }

                if (strpos($loginRes, 'A001 OK') !== false) {
                    $syncFolders = [
                        ['command' => "A002 SELECT INBOX\r\n", 'tag' => 'A002', 'folder_name' => 'Inbox', 'model' => $inboxFolder],
                        ['command' => "A004 SELECT Sent\r\n", 'tag' => 'A004', 'folder_name' => 'Sent', 'model' => $sentFolder],
                    ];

                    foreach ($syncFolders as $sf) {
                        fputs($stream, $sf['command']);
                        $selectRes = '';
                        $totalMessages = 0;
                        while ($line = fgets($stream, 512)) {
                            $selectRes .= $line;
                            if (preg_match('/\* (\d+) EXISTS/i', $line, $matches)) {
                                $totalMessages = (int) $matches[1];
                            }
                            if (strpos($line, $sf['tag']) === 0) break;
                        }

                        if ($totalMessages > 0) {
                            $start = max(1, $totalMessages - 15);
                            $end = $totalMessages;

                            for ($msgNum = $end; $msgNum >= $start; $msgNum--) {
                                $fetchTag = 'A00F' . $msgNum;
                                fputs($stream, "$fetchTag FETCH $msgNum (BODY[HEADER.FIELDS (FROM TO SUBJECT DATE)] BODY[TEXT])\r\n");

                                $rawMsgData = '';
                                while ($line = fgets($stream, 4096)) {
                                    $rawMsgData .= $line;
                                    if (strpos($line, $fetchTag) === 0) break;
                                }

                                $rawFrom = '';
                                $subject = '(No Subject)';
                                $dateStr = now();

                                if (preg_match('/From:\s*(.*?)\r\n/i', $rawMsgData, $m)) {
                                    $rawFrom = trim($m[1]);
                                }

                                if (preg_match('/Subject:\s*(.*?)\r\n/i', $rawMsgData, $m)) {
                                    $subject = $this->decodeMimeHeader(trim($m[1]));
                                }

                                if (preg_match('/Date:\s*(.*?)\r\n/i', $rawMsgData, $m)) {
                                    try {
                                        $dateStr = Carbon::parse(trim($m[1]));
                                    } catch (Exception $e) {
                                        $dateStr = now();
                                    }
                                }

                                [$from, $senderEmail] = $this->cleanSender($rawFrom ?: $username, $username);
                                $initials = strtoupper(substr($from ?: 'EM', 0, 2));

                                $parsedBody = $this->parseMimeBody($rawMsgData);
                                $bodyHtml = $parsedBody['html'];
                                $bodyText = $parsedBody['text'];

                                $existingEmail = Email::where('email_account_id', $account->id)
                                    ->where('subject', $subject)
                                    ->first();

                                if ($existingEmail) {
                                    if (strpos($existingEmail->body_html, 'Message synced via IMAP socket.') !== false || strlen($existingEmail->body_html) < 200) {
                                        $existingEmail->update([
                                            'body_html' => $bodyHtml,
                                            'body_text' => $bodyText,
                                            'preview' => substr($bodyText ?: $subject, 0, 120),
                                        ]);
                                    }
                                } else {
                                    Email::create([
                                        'email_account_id' => $account->id,
                                        'folder_id' => $sf['model'] ? $sf['model']->id : null,
                                        'sender_name' => $from,
                                        'sender_email' => $senderEmail,
                                        'initials' => $initials,
                                        'color' => 'bg-emerald-600',
                                        'recipient_to' => $account->email_address,
                                        'subject' => $subject,
                                        'preview' => substr($bodyText ?: $subject, 0, 120),
                                        'body_html' => $bodyHtml,
                                        'body_text' => $bodyText,
                                        'date_sent' => $dateStr,
                                        'folder' => $sf['folder_name'],
                                        'unread' => ($sf['folder_name'] === 'Inbox'),
                                        'starred' => false,
                                        'tags' => ['Work'],
                                    ]);
                                    $fetchedCount++;
                                }
                            }
                        }
                    }

                    fclose($stream);
                }
            }
        } catch (Exception $e) {
            // Log sync exception
        }

        $this->updateFolderCounts($account, $inboxFolder);

        return [
            'success' => true,
            'message' => "Email sync completed. $fetchedCount new messages fetched.",
            'fetched_count' => $fetchedCount,
        ];
    }

    private function updateFolderCounts(EmailAccount $account, ?Folder $inboxFolder): void
    {
        if (!$inboxFolder) return;

        $totalEmails = Email::where('email_account_id', $account->id)->where('folder', 'Inbox')->count();
        $unreadEmails = Email::where('email_account_id', $account->id)->where('folder', 'Inbox')->where('unread', true)->count();

        $inboxFolder->update([
            'total_count' => $totalEmails,
            'unread_count' => $unreadEmails,
        ]);
    }

    /**
     * Delete email permanently from remote IMAP server (mail.sudhirrajai.com)
     */
    public function deleteFromRemoteImap(EmailAccount $account, Email $email): void
    {
        if (!$email->uid) return;

        try {
            if (function_exists('imap_open')) {
                $host = $account->imap_host;
                $port = $account->imap_port ?: 993;
                $encryption = strtolower($account->imap_encryption) === 'tls' || strtolower($account->imap_encryption) === 'ssl' ? '/ssl/novalidate-cert' : '/novalidate-cert';
                $serverSpec = "{" . $host . ":" . $port . "/imap" . $encryption . "}INBOX";

                $mbox = @imap_open($serverSpec, $account->imap_username, $account->imap_password);
                if ($mbox) {
                    @imap_delete($mbox, (string)$email->uid, FT_UID);
                    @imap_expunge($mbox);
                    @imap_close($mbox);
                }
            }
        } catch (Exception $e) {
            // Log remote IMAP deletion failure silently
        }
    }

    /**
     * Update read/unread flag on remote IMAP server
     */
    public function markReadOnRemoteImap(EmailAccount $account, Email $email, bool $unread): void
    {
        if (!$email->uid) return;

        try {
            if (function_exists('imap_open')) {
                $host = $account->imap_host;
                $port = $account->imap_port ?: 993;
                $encryption = strtolower($account->imap_encryption) === 'tls' || strtolower($account->imap_encryption) === 'ssl' ? '/ssl/novalidate-cert' : '/novalidate-cert';
                $serverSpec = "{" . $host . ":" . $port . "/imap" . $encryption . "}INBOX";

                $mbox = @imap_open($serverSpec, $account->imap_username, $account->imap_password);
                if ($mbox) {
                    $flag = '\\Seen';
                    if ($unread) {
                        @imap_clearflag_full($mbox, (string)$email->uid, $flag, ST_UID);
                    } else {
                        @imap_setflag_full($mbox, (string)$email->uid, $flag, ST_UID);
                    }
                    @imap_close($mbox);
                }
            }
        } catch (Exception $e) {
            // Log remote IMAP flag update failure silently
        }
    }

    /**
     * Update starred/flagged status on remote IMAP server
     */
    public function markStarredOnRemoteImap(EmailAccount $account, Email $email, bool $starred): void
    {
        if (!$email->uid) return;

        try {
            if (function_exists('imap_open')) {
                $host = $account->imap_host;
                $port = $account->imap_port ?: 993;
                $encryption = strtolower($account->imap_encryption) === 'tls' || strtolower($account->imap_encryption) === 'ssl' ? '/ssl/novalidate-cert' : '/novalidate-cert';
                $serverSpec = "{" . $host . ":" . $port . "/imap" . $encryption . "}INBOX";

                $mbox = @imap_open($serverSpec, $account->imap_username, $account->imap_password);
                if ($mbox) {
                    $flag = '\\Flagged';
                    if ($starred) {
                        @imap_setflag_full($mbox, (string)$email->uid, $flag, ST_UID);
                    } else {
                        @imap_clearflag_full($mbox, (string)$email->uid, $flag, ST_UID);
                    }
                    @imap_close($mbox);
                }
            }
        } catch (Exception $e) {
            // Log remote IMAP flag update failure silently
        }
    }
}
