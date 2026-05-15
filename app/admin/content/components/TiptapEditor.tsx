'use client'

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import type { JSONContent } from '@tiptap/react'
import { useCallback, useRef } from 'react'

// ── Toolbar icon helpers ──────────────────────────────────────────────────

function BoldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
    </svg>
  )
}

function ItalicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="4" x2="10" y2="4"/>
      <line x1="14" y1="20" x2="5" y2="20"/>
      <line x1="15" y1="4" x2="9" y2="20"/>
    </svg>
  )
}

function H1Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h8"/>
      <path d="M4 4v16"/>
      <path d="M12 4v16"/>
      <path d="M21 20v-6a2 2 0 0 0-4 0v6"/>
      <path d="M17 20h4"/>
    </svg>
  )
}

function H2Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h8"/>
      <path d="M4 4v16"/>
      <path d="M12 4v16"/>
      <path d="M21 18c0-2.5-4-2.5-4 0s4 2 4 4H17"/>
    </svg>
  )
}

function BulletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="6" x2="20" y2="6"/>
      <line x1="9" y1="12" x2="20" y2="12"/>
      <line x1="9" y1="18" x2="20" y2="18"/>
      <circle cx="4" cy="6" r="1" fill="currentColor"/>
      <circle cx="4" cy="12" r="1" fill="currentColor"/>
      <circle cx="4" cy="18" r="1" fill="currentColor"/>
    </svg>
  )
}

function OrderedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="21" y2="6"/>
      <line x1="10" y1="12" x2="21" y2="12"/>
      <line x1="10" y1="18" x2="21" y2="18"/>
      <path d="M4 6h1v4"/>
      <path d="M4 10h2"/>
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
}

// ── ToolbarButton ─────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded transition-colors"
      style={{
        color: active ? 'var(--brand-crimson)' : 'var(--text-secondary)',
        backgroundColor: active ? 'rgba(188,71,73,0.08)' : 'transparent',
      }}
    >
      {children}
    </button>
  )
}

// ── Main export ───────────────────────────────────────────────────────────

export function TiptapEditor({
  doc,
  onChange,
  placeholder,
}: {
  doc: JSONContent | null
  onChange: (doc: JSONContent) => void
  placeholder?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full my-4' },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Start writing…',
      }),
    ],
    content: doc ?? undefined,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
  })

  const handleSetLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', prev ?? '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url }).run()
  }, [editor])

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/guides/upload?type=image', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }))
      window.alert(err.error ?? 'Upload failed')
      return
    }
    const { url } = await res.json() as { url: string }
    editor.chain().focus().setImage({ src: url }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap gap-0.5 px-2 py-1.5 border-b"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <ItalicIcon />
        </ToolbarButton>
        <div className="w-px mx-1 self-stretch" style={{ backgroundColor: 'var(--border-default)' }} />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <H1Icon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <H2Icon />
        </ToolbarButton>
        <div className="w-px mx-1 self-stretch" style={{ backgroundColor: 'var(--border-default)' }} />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <BulletIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
          <OrderedIcon />
        </ToolbarButton>
        <div className="w-px mx-1 self-stretch" style={{ backgroundColor: 'var(--border-default)' }} />
        <ToolbarButton onClick={handleSetLink} active={editor.isActive('link')} title="Insert link">
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          title="Insert image"
        >
          <ImageIcon />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) {
              void handleImageUpload(file)
              e.target.value = ''
            }
          }}
        />
      </div>

      {/* Bubble menu — link actions when selection is inside a link */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor }) => editor.isActive('link')}
        tippyOptions={{ duration: 100 }}
      >
        <div
          className="flex gap-1 px-2 py-1 rounded-lg shadow-lg border text-xs"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        >
          <button
            type="button"
            onClick={handleSetLink}
            className="px-2 py-0.5 rounded hover:bg-black/5 transition-colors"
            style={{ color: 'var(--brand-crimson)' }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="px-2 py-0.5 rounded hover:bg-black/5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Remove
          </button>
        </div>
      </BubbleMenu>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="tiptap-editor px-4 py-3 min-h-[200px] focus-within:outline-none"
      />
    </div>
  )
}
