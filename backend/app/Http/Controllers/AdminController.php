<?php

namespace App\Http\Controllers;

use App\Models\Email;
use App\Models\EmailAccount;
use App\Models\User;
use App\Services\ImapSyncService;
use App\Services\SmtpMailService;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    protected ImapSyncService $imapService;
    protected SmtpMailService $smtpService;

    public function __construct(ImapSyncService $imapService, SmtpMailService $smtpService)
    {
        $this->imapService = $imapService;
        $this->smtpService = $smtpService;
    }

    /**
     * Get platform overview metrics and system diagnostics
     */
    public function metrics()
    {
        $totalUsers = User::count();
        $newUsersThisWeek = User::where('created_at', '>=', now()->subDays(7))->count();
        $activeUsers = User::where('status', 'active')->count();
        $suspendedUsers = User::where('status', 'suspended')->count();

        $plans = [
            'free' => User::where('plan', 'free')->count(),
            'pro' => User::where('plan', 'pro')->count(),
            'enterprise' => User::where('plan', 'enterprise')->count(),
        ];

        $totalAccounts = EmailAccount::count();
        $totalEmails = Email::count();
        $unreadEmails = Email::where('unread', true)->count();

        // Estimated database storage used by emails
        $totalStorageBytes = Email::sum(DB::raw('LENGTH(COALESCE(body_html, "")) + LENGTH(COALESCE(body_text, "")) + 512'));
        $totalStorageMb = round($totalStorageBytes / (1024 * 1024), 2);

        // System information
        $serverInfo = [
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'server_os' => PHP_OS_FAMILY,
            'server_time' => now()->toIso8601String(),
            'memory_usage' => round(memory_get_usage(true) / (1024 * 1024), 2) . ' MB',
            'server_load' => function_exists('sys_getloadavg') ? sys_getloadavg() : [0, 0, 0],
            'socket_extension' => extension_loaded('sockets') || function_exists('fsockopen'),
            'openssl_extension' => extension_loaded('openssl'),
        ];

        // Recent 5 registered users
        $recentUsers = User::latest('id')->take(5)->get(['id', 'name', 'email', 'plan', 'role', 'status', 'created_at']);

        return response()->json([
            'metrics' => [
                'total_users' => $totalUsers,
                'new_users_week' => $newUsersThisWeek,
                'active_users' => $activeUsers,
                'suspended_users' => $suspendedUsers,
                'plans' => $plans,
                'total_accounts' => $totalAccounts,
                'total_emails' => $totalEmails,
                'unread_emails' => $unreadEmails,
                'total_storage_mb' => $totalStorageMb,
            ],
            'server' => $serverInfo,
            'recent_users' => $recentUsers,
        ]);
    }

    /**
     * Get paginated and searchable users list
     */
    public function users(Request $request)
    {
        $query = User::withCount('emailAccounts');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($plan = $request->input('plan')) {
            if ($plan !== 'all') {
                $query->where('plan', $plan);
            }
        }

        if ($status = $request->input('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        if ($role = $request->input('role')) {
            if ($role !== 'all') {
                $query->where('role', $role);
            }
        }

        $users = $query->latest('id')->paginate(15);

        // Append email count and storage calculation per user
        $users->getCollection()->transform(function ($u) {
            $accountIds = $u->emailAccounts->pluck('id');
            $emailCount = Email::whereIn('email_account_id', $accountIds)->count();
            $storageBytes = Email::whereIn('email_account_id', $accountIds)
                ->sum(DB::raw('LENGTH(COALESCE(body_html, "")) + LENGTH(COALESCE(body_text, "")) + 512'));
            
            $u->emails_count = $emailCount;
            $u->used_storage_mb = round($storageBytes / (1024 * 1024), 2);
            $u->quota_percentage = $u->max_storage_mb > 0 
                ? min(100, round(($u->used_storage_mb / $u->max_storage_mb) * 100, 1)) 
                : 0;

            return $u;
        });

        return response()->json([
            'users' => $users,
        ]);
    }

    /**
     * Update user role, plan, status, and quotas
     */
    public function updateUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'role' => 'sometimes|in:admin,user',
            'plan' => 'sometimes|in:free,pro,enterprise',
            'status' => 'sometimes|in:active,suspended',
            'max_storage_mb' => 'sometimes|integer|min:100',
            'max_accounts' => 'sometimes|integer|min:1',
            'ai_credits_remaining' => 'sometimes|integer|min:0',
        ]);

        if (isset($validated['role'])) {
            $validated['is_admin'] = ($validated['role'] === 'admin');
        }

        $user->update($validated);

        return response()->json([
            'message' => "User '{$user->email}' updated successfully.",
            'user' => $user,
        ]);
    }

    /**
     * Delete user
     */
    public function deleteUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'You cannot delete your own admin account.',
            ], 400);
        }

        // Delete user's email accounts and cascade delete emails
        $accounts = $user->emailAccounts;
        foreach ($accounts as $acc) {
            Email::where('email_account_id', $acc->id)->delete();
            $acc->delete();
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'message' => "User '{$user->email}' and all associated accounts were deleted.",
        ]);
    }

    /**
     * Impersonate user - generates an access token for target user
     */
    public function impersonate(Request $request, $id)
    {
        $targetUser = User::findOrFail($id);

        if ($targetUser->isSuspended()) {
            return response()->json([
                'message' => 'Cannot impersonate a suspended user.',
            ], 400);
        }

        $impersonationToken = $targetUser->createToken('admin_impersonate_' . now()->timestamp)->plainTextToken;

        return response()->json([
            'message' => "Impersonating {$targetUser->name} ({$targetUser->email})",
            'token' => $impersonationToken,
            'user' => $targetUser,
        ]);
    }

    /**
     * Diagnostic tool: Test any IMAP or SMTP server connection
     */
    public function testConnection(Request $request)
    {
        $request->validate([
            'type' => 'required|in:imap,smtp',
            'host' => 'required|string',
            'port' => 'required|integer',
            'encryption' => 'required|string',
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $type = $request->type;
        $host = $request->host;
        $port = (int) $request->port;
        $encryption = strtolower($request->encryption);
        $username = $request->username;
        $password = $request->password;

        $startTime = microtime(true);

        try {
            if ($type === 'imap') {
                $prefix = ($encryption === 'ssl' || $port == 993) ? 'ssl://' : '';
                $stream = @fsockopen($prefix . $host, $port, $errno, $errstr, 8);
                if (!$stream) {
                    throw new Exception("Connection to {$host}:{$port} failed: {$errstr} ({$errno})");
                }
                $greeting = fgets($stream, 512);
                fputs($stream, "A001 LOGIN {$username} {$password}\r\n");
                $response = '';
                while ($line = fgets($stream, 512)) {
                    $response .= $line;
                    if (strpos($line, 'A001 ') === 0) break;
                }
                fclose($stream);

                if (stripos($response, 'A001 OK') === false) {
                    throw new Exception("IMAP Login failed: " . trim($response));
                }
            } else {
                $prefix = ($encryption === 'ssl' || $port == 465) ? 'ssl://' : '';
                $stream = @fsockopen($prefix . $host, $port, $errno, $errstr, 8);
                if (!$stream) {
                    throw new Exception("Connection to {$host}:{$port} failed: {$errstr} ({$errno})");
                }
                $greeting = fgets($stream, 512);
                fputs($stream, "EHLO webmail.vmcore.in\r\n");
                $response = '';
                while ($line = fgets($stream, 512)) {
                    $response .= $line;
                    if (substr($line, 3, 1) === ' ') break;
                }
                fputs($stream, "AUTH LOGIN\r\n");
                fgets($stream, 512);
                fputs($stream, base64_encode($username) . "\r\n");
                fgets($stream, 512);
                fputs($stream, base64_encode($password) . "\r\n");
                $authRes = fgets($stream, 512);
                fputs($stream, "QUIT\r\n");
                fclose($stream);

                if (substr($authRes, 0, 3) !== '235') {
                    throw new Exception("SMTP Auth failed: " . trim($authRes));
                }
            }

            $latency = round((microtime(true) - $startTime) * 1000, 2);

            return response()->json([
                'success' => true,
                'message' => strtoupper($type) . " connection to {$host}:{$port} succeeded!",
                'latency_ms' => $latency,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
