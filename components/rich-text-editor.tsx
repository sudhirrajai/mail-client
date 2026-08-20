'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Paperclip,
  Heading1,
  Heading2,
  RemoveFormatting,
  X,
  Eye,
  FileText,
  FileArchive,
  FileCode,
  File,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AttachmentItem {
  id: string
  name: string
  size: string
  mime_type: string
  content_base64: string
  isInlineImage?: boolean
}

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onAttachmentsChange?: (attachments: AttachmentItem[]) => void
  placeholder?: string
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  onAttachmentsChange,
  placeholder = 'Write your message...',
  minHeight = '220px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [selectedPreview, setSelectedPreview] = useState<AttachmentItem | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Sync external value changes into editor DOM without losing cursor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (!isFocused) {
        editorRef.current.innerHTML = value
      }
    }
  }, [value, isFocused])

  // Emit attachments update to parent
  useEffect(() => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments)
    }
  }, [attachments, onAttachmentsChange])

  const exec = (command: string, val: string | undefined = undefined) => {
    document.execCommand(command, false, val)
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const insertImageBase64 = (dataUrl: string, fileName = 'Pasted Image') => {
    const id = Math.random().toString(36).substring(7)
    const base64Data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl
    const mimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';')) || 'image/png'

    const imgHtml = `<img src="${dataUrl}" alt="${fileName}" style="max-width: 100%; height: auto; border-radius: 12px; margin: 8px 0; border: 1px solid rgba(255,255,255,0.1); shadow: 0 4px 12px rgba(0,0,0,0.15);" />`

    if (editorRef.current) {
      editorRef.current.focus()
      document.execCommand('insertHTML', false, imgHtml)
      onChange(editorRef.current.innerHTML)
    }

    setAttachments((prev) => [
      ...prev,
      {
        id,
        name: fileName,
        size: formatFileSize(Math.round(base64Data.length * 0.75)),
        mime_type: mimeType,
        content_base64: base64Data,
        isInlineImage: true,
      },
    ])
  }

  const addGeneralAttachment = (file: File) => {
    const id = Math.random().toString(36).substring(7)
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (dataUrl) {
        const base64Data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl
        setAttachments((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            size: formatFileSize(file.size),
            mime_type: file.type || 'application/octet-stream',
            content_base64: base64Data,
            isInlineImage: file.type.startsWith('image/'),
          },
        ])
      }
    }
    reader.readAsDataURL(file)
  }

  // Handle Image Paste from Clipboard
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (blob) {
          const reader = new FileReader()
          reader.onload = (event) => {
            if (event.target?.result) {
              insertImageBase64(event.target.result as string, blob.name || 'Pasted Image')
            }
          }
          reader.readAsDataURL(blob)
        }
      }
    }
  }

  // Handle Drag and Drop Files
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            insertImageBase64(event.target.result as string, file.name)
          }
        }
        reader.readAsDataURL(file)
      } else {
        addGeneralAttachment(file)
      }
    }
  }

  // Handle File Input Select for any attachment type
  const handleGeneralFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            insertImageBase64(event.target.result as string, file.name)
          }
        }
        reader.readAsDataURL(file)
      } else {
        addGeneralAttachment(file)
      }
    }
  }

  const promptLink = () => {
    const url = prompt('Enter URL link:', 'https://')
    if (url) {
      exec('createLink', url)
    }
  }

  const removeAttachment = (id: string, base64Data: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    if (editorRef.current) {
      const imgs = editorRef.current.querySelectorAll('img')
      imgs.forEach((img) => {
        if (img.src.includes(base64Data)) {
          img.remove()
        }
      })
      onChange(editorRef.current.innerHTML)
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('word')) return FileText
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return FileArchive
    if (mimeType.includes('code') || mimeType.includes('json') || mimeType.includes('html')) return FileCode
    return File
  }

  return (
    <div className="flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden transition focus-within:border-primary">
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/40 p-1.5">
        <button
          type="button"
          onClick={() => exec('bold')}
          title="Bold"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          title="Italic"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Italic className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          title="Underline"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Underline className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('strikeThrough')}
          title="Strikethrough"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Strikethrough className="size-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border/80" />

        <button
          type="button"
          onClick={() => exec('formatBlock', '<h1>')}
          title="Heading 1"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Heading1 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', '<h2>')}
          title="Heading 2"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Heading2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          title="Bullet List"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <List className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          title="Numbered List"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <ListOrdered className="size-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border/80" />

        <button
          type="button"
          onClick={() => exec('formatBlock', '<blockquote>')}
          title="Quote Block"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Quote className="size-4" />
        </button>
        <button
          type="button"
          onClick={promptLink}
          title="Insert Link"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <LinkIcon className="size-4" />
        </button>
        
        {/* Attach File Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach PDF, Word, Excel, ZIP or files"
          className="rounded-lg p-1.5 text-primary bg-primary/10 hover:bg-primary/20 transition flex items-center gap-1 font-medium text-xs ml-1"
        >
          <Paperclip className="size-4" />
          <span>Attach File</span>
        </button>

        {/* Add Image Button */}
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          title="Insert Image"
          className="rounded-lg p-1.5 text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 transition flex items-center gap-1 font-medium text-xs"
        >
          <ImageIcon className="size-4" />
          <span>Add Image</span>
        </button>

        <button
          type="button"
          onClick={() => exec('removeFormat')}
          title="Clear Formatting"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition ml-auto"
        >
          <RemoveFormatting className="size-4" />
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleGeneralFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleGeneralFileSelect}
        />
      </div>

      {/* Contenteditable Rich Area */}
      <div className="relative p-4 overflow-y-auto" style={{ minHeight }}>
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="outline-none min-h-[160px] prose prose-sm max-w-none dark:prose-invert text-foreground"
        />

        {(!value || value === '<br>') && !isFocused && (
          <div className="pointer-events-none absolute left-4 top-4 text-xs text-muted-foreground">
            {placeholder} (Tip: You can paste images, drop files, or click Attach File!)
          </div>
        )}
      </div>

      {/* Attachments Tray */}
      {attachments.length > 0 && (
        <div className="border-t border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Attached Files & Images ({attachments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => {
              const FileIcon = getFileIcon(a.mime_type)
              const dataUrl = `data:${a.mime_type};base64,${a.content_base64}`

              return (
                <div
                  key={a.id}
                  className="group relative flex items-center gap-2 rounded-xl border border-border/80 bg-card p-1.5 pr-3 text-xs shadow-sm hover:border-primary/50 transition"
                >
                  {a.isInlineImage ? (
                    <div
                      onClick={() => setSelectedPreview(a)}
                      className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-border cursor-pointer"
                    >
                      <img src={dataUrl} alt={a.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                        <Eye className="size-3.5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileIcon className="size-4" />
                    </div>
                  )}
                  <div className="min-w-0 max-w-[140px]">
                    <p className="truncate font-semibold text-[11px]">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.size}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id, a.content_base64)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-red-500 transition"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal Lightbox for Image Preview */}
      {selectedPreview && (
        <div
          onClick={() => setSelectedPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/70">
              <span className="text-xs font-semibold">{selectedPreview.name} ({selectedPreview.size})</span>
              <button
                onClick={() => setSelectedPreview(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-2 max-h-[75vh] overflow-auto flex items-center justify-center">
              <img
                src={`data:${selectedPreview.mime_type};base64,${selectedPreview.content_base64}`}
                alt={selectedPreview.name}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
