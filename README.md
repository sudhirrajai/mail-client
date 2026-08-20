# Mosaic Mail Client

A modern, fast, event-driven Webmail Client built with **Next.js 16 (React 19)** and **Laravel 13 (SQLite)**, featuring bi-directional IMAP/SMTP integration, Gmail-style conversation threading, rich text editing with image pasting, and zero-flicker observer caching.

---

## ✨ Features

- **📨 Bi-Directional IMAP & SMTP Integration**: Connect any custom email provider or domain mail server (`mail.yourdomain.com`). Actions (read/unread, starring, deleting) sync bi-directionally with remote IMAP servers.
- **💬 Gmail-Style Conversation Threading**: Automatically groups related emails into conversation threads stacked chronologically.
- **⚡ Zero-Flicker Observer Caching**: Instant sub-millisecond folder transitions with Pub/Sub Event Bus and memory observer caching.
- **🎨 Rich Text Editor with Live Image Pasting**: Full HTML formatting toolbar with direct `Ctrl + V` clipboard image pasting and lightbox preview modals.
- **📎 Full File Attachments**: Attach any file type (PDF, Word, Excel, ZIP, images) sent directly over SMTP using Symfony Mailer.
- **⌨️ Keyboard Shortcuts**: Intuitive shortcuts (`C` for Compose, `R` for Reply, `S` for Star, `E` for Archive, `D` for Delete, `Escape` to close).
- **📂 Unified Inbox & Multiple Mailboxes**: Switch between individual email accounts or view all accounts combined in a single Unified Inbox.

---

## 🚀 Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, TailwindCSS 4, Lucide Icons.
- **Backend**: Laravel 13, SQLite Database, Symfony Mailer, PHP IMAP Socket & Extension.
- **Architecture**: Event-Driven Pub/Sub Observer Pattern.

---

## 🛠 Setup & Installation

### 1. Backend Setup (Laravel 13)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve --port=8001
```

### 2. Frontend Setup (Next.js 16)
```bash
# In the project root directory
npm install
npm run dev -- -p 3000
```

---

## 📄 License
MIT License
