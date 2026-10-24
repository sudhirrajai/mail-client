const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:8001/api')

export interface User {
  id: number
  name: string
  email: string
  role?: 'admin' | 'user'
  is_admin?: boolean
  plan?: 'free' | 'pro' | 'enterprise'
  status?: 'active' | 'suspended'
  max_storage_mb?: number
  max_accounts?: number
  ai_credits_monthly?: number
  ai_credits_remaining?: number
  created_at?: string
  email_accounts_count?: number
  emails_count?: number
  used_storage_mb?: number
  quota_percentage?: number
}

export interface EmailAccount {
  id: number
  name: string
  email_address: string
  imap_host: string
  imap_port: number
  imap_encryption: string
  imap_username: string
  smtp_host: string
  smtp_port: number
  smtp_encryption: string
  smtp_username: string
  is_default: boolean
  is_active: boolean
}

export interface FolderItem {
  id: number
  email_account_id: number
  name: string
  type: 'Inbox' | 'Starred' | 'Sent' | 'Drafts' | 'Archive' | 'Spam' | 'Trash'
  remote_name: string
  unread_count: number
  total_count: number
}

export interface EmailItem {
  id: number
  email_account_id: number
  folder_id: number
  message_id?: string
  uid?: number
  sender_name: string
  sender_email: string
  initials: string
  color: string
  recipient_to: string
  recipient_cc?: string
  recipient_bcc?: string
  subject: string
  preview: string
  body_html?: string
  body_text?: string
  date_sent: string
  time: string
  folder: 'Inbox' | 'Starred' | 'Sent' | 'Drafts' | 'Archive' | 'Spam' | 'Trash'
  unread: boolean
  starred: boolean
  tags: string[]
  attachment?: { name: string; size: string; type: 'pdf' | 'image' | 'zip'; url?: string }
}

class ApiClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('webmail_token')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('webmail_token', token)
      } else {
        localStorage.removeItem('webmail_token')
      }
    }
  }

  getToken() {
    return this.token
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'An error occurred while fetching data.')
    }

    return data as T
  }

  // Auth API
  async login(email: string, password: string) {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    this.setToken(res.token)
    return res
  }

  async register(name: string, email: string, password: string) {
    const res = await this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    this.setToken(res.token)
    return res
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' })
    } finally {
      this.setToken(null)
    }
  }

  async me() {
    return this.request<{ user: User }>('/auth/me')
  }

  async getMe() {
    if (!this.token) return null
    try {
      return await this.request<{ user: User }>('/auth/me')
    } catch {
      this.setToken(null)
      return null
    }
  }

  // Email Accounts API
  async getAccounts() {
    return this.request<{ accounts: EmailAccount[] }>('/accounts')
  }

  async createAccount(accountData: Partial<EmailAccount> & { imap_password?: string; smtp_password?: string }) {
    return this.request<{ account: EmailAccount }>('/accounts', {
      method: 'POST',
      body: JSON.stringify(accountData),
    })
  }

  async testAccountConnection(accountData: Partial<EmailAccount> & { imap_password?: string; smtp_password?: string }) {
    return this.request<{ success: boolean; message: string }>('/accounts/test-connection', {
      method: 'POST',
      body: JSON.stringify(accountData),
    })
  }

  async deleteAccount(id: number) {
    return this.request<{ success: boolean }>(`/accounts/${id}`, {
      method: 'DELETE',
    })
  }

  async syncAccount(id: number) {
    return this.request<{ success: boolean; message: string; fetched_count: number }>(`/accounts/${id}/sync`, {
      method: 'POST',
    })
  }

  // Emails API
  async getEmails(
    accountId?: number,
    folder?: string,
    query?: string,
    filter?: string,
    tag?: string,
    page?: number,
    perPage?: number
  ) {
    const params = new URLSearchParams()
    if (accountId) params.append('account_id', accountId.toString())
    if (folder) params.append('folder', folder)
    if (query) params.append('query', query)
    if (filter) params.append('filter', filter)
    if (tag) params.append('tag', tag)
    if (page) params.append('page', page.toString())
    if (perPage) params.append('per_page', perPage.toString())

    const queryString = params.toString() ? `?${params.toString()}` : ''
    return this.request<{
      emails: EmailItem[]
      unread_count: number
      folder_counts?: Record<string, number>
      storage?: { formatted: string; percentage: number }
      total?: number
      page?: number
      has_more?: boolean
    }>(`/emails${queryString}`)
  }

  async getEmail(id: number) {
    return this.request<{ email: EmailItem }>(`/emails/${id}`)
  }

  async toggleStar(id: number) {
    return this.request<{ starred: boolean }>(`/emails/${id}/star`, {
      method: 'PATCH',
    })
  }

  async markRead(id: number, unread = false) {
    return this.request<{ unread: boolean }>(`/emails/${id}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ unread }),
    })
  }

  async deleteEmail(id: number) {
    return this.request<{ success: boolean }>(`/emails/${id}`, {
      method: 'DELETE',
    })
  }

  async moveToFolder(id: number, folder: string) {
    return this.request<{ success: boolean; folder: string }>(`/emails/${id}/folder`, {
      method: 'PATCH',
      body: JSON.stringify({ folder }),
    })
  }

  async bulkReadEmails(ids: number[], unread: boolean) {
    return this.request<{ success: boolean; count: number; unread: boolean }>('/emails/bulk-read', {
      method: 'POST',
      body: JSON.stringify({ ids, unread }),
    })
  }

  async bulkDeleteEmails(ids: number[]) {
    return this.request<{ success: boolean; count: number }>('/emails/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }

  async bulkMoveEmails(ids: number[], folder: string) {
    return this.request<{ success: boolean; count: number; folder: string }>('/emails/bulk-folder', {
      method: 'POST',
      body: JSON.stringify({ ids, folder }),
    })
  }

  async bulkStarEmails(ids: number[], starred: boolean) {
    return this.request<{ success: boolean; count: number; starred: boolean }>('/emails/bulk-star', {
      method: 'POST',
      body: JSON.stringify({ ids, starred }),
    })
  }

  async sendEmail(data: {
    account_id: number
    to: string
    cc?: string
    bcc?: string
    subject: string
    body: string
    in_reply_to?: string
    references?: string
    attachments?: Array<{
      name: string
      size: string
      mime_type: string
      content_base64: string
    }>
  }) {
    return this.request<{ success: boolean; message: string; email?: EmailItem }>('/emails/send', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async saveDraft(data: {
    id?: number
    account_id: number
    to?: string
    subject?: string
    body?: string
  }) {
    return this.request<{ success: boolean; message: string; email: EmailItem }>('/emails/draft', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateProfile(data: { name: string; current_password?: string; new_password?: string }) {
    return this.request<{ message: string; user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Admin Methods
  async getAdminMetrics() {
    return this.request<{
      metrics: {
        total_users: number
        new_users_week: number
        active_users: number
        suspended_users: number
        plans: { free: number; pro: number; enterprise: number }
        total_accounts: number
        total_emails: number
        unread_emails: number
        total_storage_mb: number
      }
      server: {
        php_version: string
        laravel_version: string
        server_os: string
        server_time: string
        memory_usage: string
        server_load: number[]
        socket_extension: boolean
        openssl_extension: boolean
      }
      recent_users: User[]
    }>('/admin/metrics')
  }

  async getAdminUsers(params?: { search?: string; plan?: string; status?: string; role?: string; page?: number }) {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.plan) query.set('plan', params.plan)
    if (params?.status) query.set('status', params.status)
    if (params?.role) query.set('role', params.role)
    if (params?.page) query.set('page', String(params.page))
    const qs = query.toString() ? `?${query.toString()}` : ''

    return this.request<{
      users: {
        data: User[]
        current_page: number
        last_page: number
        total: number
      }
    }>(`/admin/users${qs}`)
  }

  async updateAdminUser(id: number, data: Partial<User>) {
    return this.request<{ message: string; user: User }>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteAdminUser(id: number) {
    return this.request<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    })
  }

  async impersonateUser(id: number) {
    return this.request<{ message: string; token: string; user: User }>(`/admin/impersonate/${id}`, {
      method: 'POST',
    })
  }

  async testAdminConnection(data: {
    type: 'imap' | 'smtp'
    host: string
    port: number
    encryption: string
    username: string
    password: string
  }) {
    return this.request<{ success: boolean; message: string; latency_ms?: number }>('/admin/test-connection', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()
