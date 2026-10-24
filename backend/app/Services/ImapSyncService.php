<?php

namespace App\Services;

use App\Models\Email;
use App\Models\EmailAccount;
use App\Models\Folder;
use Exception;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

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
        $text = preg_replace('/BODY\[TEXT\](?:\s*\{\d+\})?\r?\n/i', '', $text);
        $text = preg_replace('/A00F\d+\s+OK[^\r\n]*/i', '', $text);
        $text = preg_replace('/\r?\n\)\s*$/', '', $text);

        // Strip any residual RFC headers accidentally placed in the body
        $text = preg_replace('/^(?:(?:To|From|Subject|Date|Message-ID|MIME-Version|Content-Type|Content-Transfer-Encoding|X-[a-zA-Z0-9-]+):[^\r\n]*\r?\n)+(\r?\n)?/i', '', $text);

        return trim($text);
    }

    /**
     * Extract full HTML and Plain text body from MIME multipart or singlepart text
     */
    private function parseMimeBody(string $rawBody, string $headers = ''): array
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

        $attachments = [];
        $boundary = null;

        // Try extracting boundary from headers or rawBody
        $searchSource = $headers . "\n" . $rawBody;
        if (preg_match('/boundary="?([^"\r\n;]+)"?/i', $searchSource, $bMatches)) {
            $boundary = trim($bMatches[1]);
        } elseif (preg_match('/^--([a-zA-Z0-9_\-\.+=]{8,})\r?$/m', $rawBody, $bMatches)) {
            $boundary = trim($bMatches[1]);
        }

        if ($boundary) {
            $parts = explode('--' . $boundary, $rawBody);

            foreach ($parts as $part) {
                $trimmedPart = trim($part);
                if (empty($trimmedPart) || $trimmedPart === '--') continue;

                if (preg_match('/Content-Disposition:\s*attachment/i', $part) || preg_match('/filename="?([^";\r\n]+)"?/i', $part, $fnMatch)) {
                    $filename = isset($fnMatch[1]) ? trim($fnMatch[1]) : 'attachment';
                    $type = 'pdf';
                    if (preg_match('/\.(jpg|jpeg|png|gif|webp|svg)$/i', $filename)) $type = 'image';
                    elseif (preg_match('/\.(zip|rar|tar|gz|7z)$/i', $filename)) $type = 'zip';

                    $bodyContent = preg_replace('/^[\s\S]*?(?:\r?\n\r?\n)/', '', $part);
                    $bodyContent = trim(preg_replace('/--[\s\S]*$/', '', $bodyContent));
                    $sizeBytes = strlen($bodyContent);
                    $size = $sizeBytes < 1024 ? $sizeBytes . ' B' : ($sizeBytes < 1048576 ? round($sizeBytes / 1024, 1) . ' KB' : round($sizeBytes / 1048576, 1) . ' MB');

                    $attachments[] = [
                        'name' => $filename,
                        'size' => $size,
                        'type' => $type,
                        'content_base64' => preg_match('/Content-Transfer-Encoding:\s*base64/i', $part) ? $bodyContent : base64_encode($bodyContent),
                    ];
                } elseif (preg_match('/Content-Type:\s*text\/html/i', $part)) {
                    $bodyContent = preg_replace('/^[\s\S]*?(?:\r?\n\r?\n)/', '', $part);
                    if (preg_match('/Content-Transfer-Encoding:\s*base64/i', $part)) {
                        $bodyContent = base64_decode(trim($bodyContent));
                    } elseif (preg_match('/Content-Transfer-Encoding:\s*quoted-printable/i', $part)) {
                        $bodyContent = quoted_printable_decode($bodyContent);
                    }
                    $htmlBody = trim($bodyContent);
                } elseif (preg_match('/Content-Type:\s*text\/plain/i', $part)) {
                    $bodyContent = preg_replace('/^[\s\S]*?(?:\r?\n\r?\n)/', '', $part);
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
                $cleanedText = preg_replace('/^(?:(?:To|From|Subject|Date|Message-ID|MIME-Version|Content-Type|Content-Transfer-Encoding|X-[a-zA-Z0-9-]+):[^\r\n]*\r?\n)+(\r?\n)?/i', '', $decoded);
                $textBody = strip_tags(trim($cleanedText));
                $htmlBody = "<p>" . nl2br(e($textBody)) . "</p>";
            }
        }

        if (empty($textBody)) {
            $textBody = strip_tags($htmlBody);
        }

        return [
            'html' => $htmlBody ?: "<p>" . nl2br(e($textBody)) . "</p>",
            'text' => $textBody,
            'attachment' => !empty($attachments) ? (count($attachments) === 1 ? $attachments[0] : $attachments) : null,
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
                    // Dynamic Sent Folder Detection across providers (Gmail, Outlook, Dovecot, etc.)
                    fputs($stream, "A003 LIST \"\" \"*\"\r\n");
                    $listOutput = '';
                    while ($line = fgets($stream, 512)) {
                        $listOutput .= $line;
                        if (strpos($line, 'A003') === 0) break;
                    }

                    $sentRemoteFolder = 'Sent';
                    if (preg_match('/\* LIST \([^\)]*\\\\Sent[^\)]*\)\s+["\S]+\s+"?([^"\r\n]+)"?/i', $listOutput, $m)) {
                        $sentRemoteFolder = trim($m[1]);
                    } elseif (stripos($listOutput, 'Sent Items') !== false) {
                        $sentRemoteFolder = 'Sent Items';
                    } elseif (stripos($listOutput, '[Gmail]/Sent Mail') !== false) {
                        $sentRemoteFolder = '[Gmail]/Sent Mail';
                    } elseif (stripos($listOutput, 'INBOX.Sent') !== false) {
                        $sentRemoteFolder = 'INBOX.Sent';
                    }

                    $syncFolders = [
                        ['command' => "A002 SELECT \"INBOX\"\r\n", 'tag' => 'A002', 'folder_name' => 'Inbox', 'model' => $inboxFolder],
                        ['command' => "A004 SELECT \"$sentRemoteFolder\"\r\n", 'tag' => 'A004', 'folder_name' => 'Sent', 'model' => $sentFolder],
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
                                fputs($stream, "$fetchTag FETCH $msgNum (BODY[HEADER.FIELDS (FROM TO SUBJECT DATE CONTENT-TYPE)] BODY[TEXT])\r\n");

                                $rawMsgData = '';
                                while ($line = fgets($stream, 4096)) {
                                    $rawMsgData .= $line;
                                    if (strpos($line, $fetchTag) === 0) break;
                                }

                                $rawFrom = '';
                                $subject = '(No Subject)';
                                $dateStr = now();
                                $rawHeaders = '';
                                $rawBodyData = $rawMsgData;

                                if (preg_match('/BODY\[HEADER\.FIELDS[^\r\n]*\r?\n([\s\S]*?)(?=\r?\n\s*\)?\s*BODY\[TEXT\]|\r?\n\r?\n)/i', $rawMsgData, $hm)) {
                                    $rawHeaders = $hm[1];
                                } else {
                                    $rawHeaders = $rawMsgData;
                                }

                                if (preg_match('/BODY\[TEXT\](?:\s*\{\d+\})?\r?\n([\s\S]*)/i', $rawMsgData, $bm)) {
                                    $rawBodyData = $bm[1];
                                }

                                // Strip trailing IMAP fetch completion tag and brackets
                                $rawBodyData = preg_replace('/\r?\n\)\s*\r?\n' . preg_quote($fetchTag, '/') . '[\s\S]*$/', '', $rawBodyData);
                                $rawBodyData = preg_replace('/\r?\n\)\s*$/', '', $rawBodyData);

                                if (preg_match('/From:\s*(.*?)\r?\n/i', $rawHeaders, $m)) {
                                    $rawFrom = trim($m[1]);
                                }

                                if (preg_match('/Subject:\s*(.*?)\r?\n/i', $rawHeaders, $m)) {
                                    $subject = $this->decodeMimeHeader(trim($m[1]));
                                }

                                if (preg_match('/Date:\s*(.*?)\r?\n/i', $rawHeaders, $m)) {
                                    try {
                                        $dateStr = Carbon::parse(trim($m[1]));
                                    } catch (Exception $e) {
                                        $dateStr = now();
                                    }
                                }

                                [$from, $senderEmail] = $this->cleanSender($rawFrom ?: $username, $username);
                                $initials = strtoupper(substr($from ?: 'EM', 0, 2));

                                $parsedBody = $this->parseMimeBody($rawBodyData, $rawHeaders);
                                $bodyHtml = $parsedBody['html'];
                                $bodyText = $parsedBody['text'];
                                $attachment = $parsedBody['attachment'] ?? null;

                                $existingEmail = Email::where('email_account_id', $account->id)
                                    ->where('subject', $subject)
                                    ->first();

                                if ($existingEmail) {
                                    if (strpos($existingEmail->body_html, 'Message synced via IMAP socket.') !== false || strlen($existingEmail->body_html) < 200) {
                                        $existingEmail->update([
                                            'body_html' => $bodyHtml,
                                            'body_text' => $bodyText,
                                            'preview' => substr($bodyText ?: $subject, 0, 120),
                                            'attachment' => $attachment ?: $existingEmail->attachment,
                                        ]);
                                    }
                                } else {
                                    Email::create([
                                        'email_account_id' => $account->id,
                                        'folder_id' => $sf['model'] ? $sf['model']->id : null,
                                        'sender_name' => $from,
                                        'sender_email' => $senderEmail,
                                        'initials' => $initials,
                                        'color' => self::generateAvatarColor($senderEmail),
                                        'recipient_to' => $account->email_address,
                                        'subject' => $subject,
                                        'preview' => substr($bodyText ?: $subject, 0, 120),
                                        'body_html' => $bodyHtml,
                                        'body_text' => $bodyText,
                                        'date_sent' => $dateStr,
                                        'folder' => $sf['folder_name'],
                                        'unread' => ($sf['folder_name'] === 'Inbox'),
                                        'starred' => false,
                                        'tags' => self::detectEmailTags($subject, $senderEmail),
                                        'attachment' => $attachment,
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
     * Delete email permanently from remote IMAP server
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

                $mbox = @imap_open($serverSpec, $account->imap_username, $account->decrypted_imap_password);
                if ($mbox) {
                    @imap_delete($mbox, (string)$email->uid, FT_UID);
                    @imap_expunge($mbox);
                    @imap_close($mbox);
                }
            } else {
                $this->sendSocketImapCommand($account, 'INBOX', [
                    "UID STORE {$email->uid} +FLAGS (\\Deleted)",
                    "EXPUNGE"
                ]);
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

                $mbox = @imap_open($serverSpec, $account->imap_username, $account->decrypted_imap_password);
                if ($mbox) {
                    $flag = '\\Seen';
                    if ($unread) {
                        @imap_clearflag_full($mbox, (string)$email->uid, $flag, ST_UID);
                    } else {
                        @imap_setflag_full($mbox, (string)$email->uid, $flag, ST_UID);
                    }
                    @imap_close($mbox);
                }
            } else {
                $action = $unread ? "-FLAGS (\\Seen)" : "+FLAGS (\\Seen)";
                $this->sendSocketImapCommand($account, 'INBOX', [
                    "UID STORE {$email->uid} $action"
                ]);
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

                $mbox = @imap_open($serverSpec, $account->imap_username, $account->decrypted_imap_password);
                if ($mbox) {
                    $flag = '\\Flagged';
                    if ($starred) {
                        @imap_setflag_full($mbox, (string)$email->uid, $flag, ST_UID);
                    } else {
                        @imap_clearflag_full($mbox, (string)$email->uid, $flag, ST_UID);
                    }
                    @imap_close($mbox);
                }
            } else {
                $action = $starred ? "+FLAGS (\\Flagged)" : "-FLAGS (\\Flagged)";
                $this->sendSocketImapCommand($account, 'INBOX', [
                    "UID STORE {$email->uid} $action"
                ]);
            }
        } catch (Exception $e) {
            // Log remote IMAP flag update failure silently
        }
    }

    /**
     * Send arbitrary IMAP commands over secure socket stream
     */
    public function sendSocketImapCommand(EmailAccount $account, string $folder, array $commands): bool
    {
        try {
            $host = $account->imap_host;
            $port = (int) ($account->imap_port ?: 993);
            $encryption = strtolower($account->imap_encryption ?? 'ssl');
            $prefix = ($encryption === 'ssl' || $port == 993) ? 'ssl://' : ($encryption === 'tls' ? 'tls://' : '');
            $username = $account->imap_username;
            $password = $account->decrypted_imap_password;

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

            if (!$stream) return false;

            fgets($stream, 512); // Banner

            fputs($stream, "A001 LOGIN \"$username\" \"$password\"\r\n");
            while ($line = fgets($stream, 512)) {
                if (strpos($line, 'A001') === 0) break;
            }

            fputs($stream, "A002 SELECT \"$folder\"\r\n");
            while ($line = fgets($stream, 512)) {
                if (strpos($line, 'A002') === 0) break;
            }

            $tagIndex = 3;
            foreach ($commands as $cmd) {
                $tag = 'A' . str_pad((string)$tagIndex++, 3, '0', STR_PAD_LEFT);
                fputs($stream, "$tag $cmd\r\n");
                while ($line = fgets($stream, 512)) {
                    if (strpos($line, $tag) === 0) break;
                }
            }

            fputs($stream, "A999 LOGOUT\r\n");
            fclose($stream);
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Deterministically generate vibrant avatar color from email address
     */
    public static function generateAvatarColor(?string $seed): string
    {
        $colors = [
            'bg-indigo-600',
            'bg-sky-600',
            'bg-emerald-600',
            'bg-violet-600',
            'bg-amber-600',
            'bg-rose-600',
            'bg-teal-600',
            'bg-cyan-600',
            'bg-fuchsia-600',
        ];
        $hash = crc32(strtolower(trim($seed ?: 'default')));
        return $colors[abs($hash) % count($colors)];
    }

    /**
     * Intelligent category tag detection
     */
    public static function detectEmailTags(string $subject, string $senderEmail): array
    {
        $lower = strtolower($subject . ' ' . $senderEmail);
        if (preg_match('/(urgent|asap|priority|important|action required)/i', $lower)) {
            return ['Urgent'];
        }
        if (preg_match('/(invoice|payment|receipt|billing|bank|salary|tax|statement)/i', $lower)) {
            return ['Finance'];
        }
        if (preg_match('/@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com)$/i', $senderEmail)) {
            return ['Personal'];
        }
        return ['Work'];
    }

    /**
     * Append a sent email message directly into the remote IMAP "Sent" mailbox
     */
    public function appendSentMessage(EmailAccount $account, string $rawMimeMessage): bool
    {
        try {
            $host = $account->imap_host;
            $port = (int) ($account->imap_port ?: 993);
            $encryption = strtolower($account->imap_encryption ?? 'ssl');
            $prefix = ($encryption === 'ssl' || $port == 993) ? 'ssl://' : ($encryption === 'tls' ? 'tls://' : '');
            $username = $account->imap_username;
            $password = $account->decrypted_imap_password;

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
                12,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if (!$stream) {
                return false;
            }

            fgets($stream, 512); // Banner

            fputs($stream, "A001 LOGIN \"$username\" \"$password\"\r\n");
            $loginRes = '';
            while ($line = fgets($stream, 512)) {
                $loginRes .= $line;
                if (strpos($line, 'A001') === 0) break;
            }

            if (strpos($loginRes, 'A001 OK') === false) {
                fclose($stream);
                return false;
            }

            // Detect Sent folder name
            fputs($stream, "A002 LIST \"\" \"*\"\r\n");
            $listOutput = '';
            while ($line = fgets($stream, 512)) {
                $listOutput .= $line;
                if (strpos($line, 'A002') === 0) break;
            }

            $sentFolder = 'Sent';
            if (preg_match('/\* LIST \([^\)]*\\\\Sent[^\)]*\)\s+["\S]+\s+"?([^"\r\n]+)"?/i', $listOutput, $m)) {
                $sentFolder = trim($m[1]);
            } elseif (stripos($listOutput, 'Sent Items') !== false) {
                $sentFolder = 'Sent Items';
            } elseif (stripos($listOutput, '[Gmail]/Sent Mail') !== false) {
                $sentFolder = '[Gmail]/Sent Mail';
            } elseif (stripos($listOutput, 'INBOX.Sent') !== false) {
                $sentFolder = 'INBOX.Sent';
            }

            $rawLen = strlen($rawMimeMessage);
            fputs($stream, "A003 APPEND \"$sentFolder\" (\\Seen) {" . $rawLen . "}\r\n");
            $readyResp = fgets($stream, 512);

            if (strpos($readyResp, '+') === 0) {
                fputs($stream, $rawMimeMessage . "\r\n");
                $appendRes = '';
                while ($line = fgets($stream, 512)) {
                    $appendRes .= $line;
                    if (strpos($line, 'A003') === 0) break;
                }
                fclose($stream);
                return strpos($appendRes, 'A003 OK') !== false;
            }

            fclose($stream);
            return false;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Query live mailbox quota via IMAP RFC 2087 (GETQUOTAROOT)
     */
    public function getMailboxQuota(EmailAccount $account): ?array
    {
        $cacheKey = "imap_quota_{$account->id}";
        return Cache::remember($cacheKey, 180, function () use ($account) {
            $host = $account->imap_host;
            $port = (int) $account->imap_port;
            $username = $account->imap_username;
            $password = $account->decrypted_imap_password;
            $prefix = ($account->imap_encryption === 'ssl' || $port == 993) ? 'ssl://' : '';

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
                5,
                STREAM_CLIENT_CONNECT,
                $context
            );

            if (!$stream) {
                return null;
            }

            fgets($stream, 512); // Banner
            fputs($stream, "Q001 LOGIN \"$username\" \"$password\"\r\n");
            while ($line = fgets($stream, 512)) {
                if (strpos($line, 'Q001') === 0) break;
            }

            fputs($stream, "Q002 GETQUOTAROOT \"INBOX\"\r\n");
            $quotaRes = '';
            while ($line = fgets($stream, 512)) {
                $quotaRes .= $line;
                if (strpos($line, 'Q002') === 0) break;
            }

            fputs($stream, "Q003 LOGOUT\r\n");
            fclose($stream);

            // Parse: * QUOTA "..." (STORAGE 6647 976563)
            if (preg_match('/\* QUOTA\s+"?[^"\r\n]*"?\s+\([^\)]*STORAGE\s+(\d+)\s+(\d+)/i', $quotaRes, $matches)) {
                $usedKb = (int) $matches[1];
                $limitKb = (int) $matches[2];
                $usedMb = round($usedKb / 1024, 1);
                $limitMb = round($limitKb / 1024, 1);

                if ($limitMb >= 950 && $limitMb <= 1050) {
                    $limitFormatted = '1 GB';
                    $limitGb = 1.0;
                } elseif ($limitMb >= 1050) {
                    $limitFormatted = round($limitMb / 1024, 1) . ' GB';
                    $limitGb = round($limitMb / 1024, 1);
                } else {
                    $limitFormatted = round($limitMb) . ' MB';
                    $limitGb = round($limitMb / 1024, 2);
                }

                $percentage = $limitKb > 0 ? max(1, min(100, round(($usedKb / $limitKb) * 100))) : 0;

                return [
                    'used_mb' => $usedMb,
                    'total_gb' => $limitGb,
                    'formatted' => "{$usedMb} MB / {$limitFormatted}",
                    'percentage' => $percentage,
                ];
            }

            return null;
        });
    }
}
