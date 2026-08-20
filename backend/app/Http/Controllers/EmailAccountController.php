<?php

namespace App\Http\Controllers;

use App\Models\EmailAccount;
use App\Services\ImapSyncService;
use App\Services\SmtpMailService;
use Illuminate\Http\Request;

class EmailAccountController extends Controller
{
    protected $imapService;
    protected $smtpService;

    public function __construct(ImapSyncService $imapService, SmtpMailService $smtpService)
    {
        $this->imapService = $imapService;
        $this->smtpService = $smtpService;
    }

    public function index(Request $request)
    {
        $accounts = $request->user()->emailAccounts()->get();

        return response()->json([
            'accounts' => $accounts,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email_address' => 'required|email|max:255',
            'imap_host' => 'required|string',
            'imap_port' => 'required|integer',
            'imap_encryption' => 'required|string',
            'imap_username' => 'required|string',
            'imap_password' => 'required|string',
            'smtp_host' => 'required|string',
            'smtp_port' => 'required|integer',
            'smtp_encryption' => 'required|string',
            'smtp_username' => 'required|string',
            'smtp_password' => 'required|string',
        ]);

        $account = $request->user()->emailAccounts()->create($validated);

        // Auto sync folders
        $this->imapService->syncAccount($account);

        return response()->json([
            'message' => 'Email account added successfully',
            'account' => $account,
        ], 201);
    }

    public function testConnection(Request $request)
    {
        $validated = $request->validate([
            'imap_host' => 'required|string',
            'imap_port' => 'required|integer',
            'imap_encryption' => 'required|string',
            'imap_username' => 'required|string',
            'imap_password' => 'required|string',
            'smtp_host' => 'required|string',
            'smtp_port' => 'required|integer',
            'smtp_encryption' => 'required|string',
            'smtp_username' => 'required|string',
            'smtp_password' => 'required|string',
        ]);

        // Test SMTP
        $smtpResult = $this->smtpService->testConnection($validated);
        if (!$smtpResult['success']) {
            return response()->json($smtpResult, 422);
        }

        // Test IMAP
        $imapResult = $this->imapService->testConnection($validated);
        if (!$imapResult['success']) {
            return response()->json($imapResult, 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Both SMTP and IMAP connection tests passed successfully!',
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $account = $request->user()->emailAccounts()->findOrFail($id);
        $account->delete();

        return response()->json([
            'success' => true,
            'message' => 'Email account removed.',
        ]);
    }

    public function sync(Request $request, $id)
    {
        $account = $request->user()->emailAccounts()->findOrFail($id);
        $res = $this->imapService->syncAccount($account);

        return response()->json($res);
    }
}
