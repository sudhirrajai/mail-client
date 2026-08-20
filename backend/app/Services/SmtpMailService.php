<?php

namespace App\Services;

use App\Models\EmailAccount;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Exception;

class SmtpMailService
{
    /**
     * Send email dynamically using custom SMTP credentials
     */
    public function send(EmailAccount $account, string $to, ?string $cc, ?string $bcc, string $subject, string $body, array $attachments = []): bool
    {
        try {
            $host = $account->smtp_host;
            $port = (int) $account->smtp_port;
            $isSsl = strtolower($account->smtp_encryption) === 'ssl' || $port === 465;
            $username = $account->smtp_username;
            $password = $account->decrypted_smtp_password;

            $transport = new EsmtpTransport($host, $port, $isSsl);
            $transport->setUsername($username);
            $transport->setPassword($password);

            $mailer = new Mailer($transport);

            $email = (new Email())
                ->from(new Address($account->email_address, $account->name ?: $account->email_address))
                ->to($to)
                ->subject($subject)
                ->html($body)
                ->text(strip_tags($body));

            if (!empty($cc)) {
                $email->cc($cc);
            }

            if (!empty($bcc)) {
                $email->bcc($bcc);
            }

            if (!empty($attachments)) {
                foreach ($attachments as $att) {
                    if (!empty($att['content_base64'])) {
                        $rawContent = base64_decode($att['content_base64']);
                        $filename = $att['name'] ?? 'attachment';
                        $mimeType = $att['mime_type'] ?? 'application/octet-stream';
                        $email->attach($rawContent, $filename, $mimeType);
                    }
                }
            }

            $mailer->send($email);

            return true;
        } catch (Exception $e) {
            throw new Exception("SMTP Send Failed: " . $e->getMessage());
        }
    }

    /**
     * Test SMTP connection
     */
    public function testConnection(array $config): array
    {
        try {
            $host = $config['smtp_host'];
            $port = (int) $config['smtp_port'];
            $encryption = strtolower($config['smtp_encryption'] ?? 'ssl');
            $scheme = ($encryption === 'ssl' || $port == 465) ? 'ssl://' : '';

            $socket = @fsockopen($scheme . $host, $port, $errno, $errstr, 8);
            if (!$socket) {
                return ['success' => false, 'message' => "SMTP Connection failed to $host:$port — $errstr ($errno)"];
            }

            $response = fgets($socket, 512);
            if (strpos($response, '220') !== 0) {
                fclose($socket);
                return ['success' => false, 'message' => "SMTP Server banner error: $response"];
            }

            fputs($socket, "EHLO webmail.client\r\n");
            $ehloRes = fgets($socket, 512);
            fclose($socket);

            return ['success' => true, 'message' => 'SMTP Host & Port reachable successfully!'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'SMTP Connection Error: ' . $e->getMessage()];
        }
    }
}
