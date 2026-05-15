'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import type { JSONContent } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { uploadToSignedUrl } from '@/lib/utils/uploadToSignedUrl'
import { ImageUploadExtension } from './ImageUploadExtension'

const TOOLBAR_BTN =
  'px-2 py-1 rounded text-xs font-semibold border transition-colors hover:bg-black/5 disabled:opacity-30'

function Toolbar({
  editor,
  onImageClick,
  imageUploading,
}: {
  editor: ReturnType<typeof useEditor>
  onImageClick: () => void
  imageUploading: boolean
}) {
  if (!editor) return null
  return (
    <div
      className="flex flex-wrap gap-1 px-3 py-2 border-b"
      style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={TOOLBAR_BTN}
        style={{
          borderColor: 'var(--border-default)',
          color: editor.isActive('bold') ? 'var(--brand-crimson)' : 'var(--text-secondary)',
        }}
        aria-label="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={TOOLBAR_BTN}
        style={{
          borderColor: 'var(--border-default)',
          color: editor.isActive('italic') ? 'var(--brand-crimson)' : 'var(--text-secondary)',
          fontStyle: 'italic',
        }}
        aria-label="Italic"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={TOOLBAR_BTN}
        style={{
          borderColor: 'var(--border-default)',
          color: editor.isActive('heading', { level: 2 }) ? 'var(--brand-crimson)' : 'var(--text-secondary)',
        }}
        aria-label="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={TOOLBAR_BTN}
        style={{
          borderColor: 'var(--border-default)',
          color: editor.isActive('heading', { level: 3 }) ? 'var(--brand-crimson)' : 'var(--text-secondary)',
        }}
        aria-label="Heading 3"
      >
        H3
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={TOOLBAR_BTN}
        style={{
          borderColor: 'var(--border-default)',
          color: editor.isActive('bulletList') ? 'var(--brand-crimson)' : 'var(--text-secondary)',
        }}
        aria-label="Bullet list"
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={TOOLBAR_BTN}
        style={{
          borderColor: 'var(--border-default)',
          color: editor.isActive('orderedList') ? 'var(--brand-crimson)' : 'var(--text-secondary)',
        }}
        aria-label="Ordered list"
      >
        1. List
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('URL')
          if (!url) return
          editor.chain().focus().setLink({ href: url, target: '_blank' }).run()
        }}
        className={TOOLBAR_BTN}
        style={{
          borderColor: 'var(--border-default)',
          color: editor.isActive('link') ? 'var(--brand-crimson)' : 'var(--text-secondary)',
        }}
        aria-label="Link"
      >
        Link
      </button>
      <button
        type="button"
        onClick={onImageClick}
        disabled={imageUploading}
        className={TOOLBAR_BTN}
        style={{
          borderColor: 'var(--border-default)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Upload image"
      >
        {imageUploading ? '↑' : 'Image'}
      </button>
    </div>
  )
}

export function TiptapEditor({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: JSONContent | null
  onChange: (v: JSONContent) => void
  placeholder?: string
  label?: string
}): React.JSX.Element {
  const [imageUploading, setImageUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write here…' }),
      ImageUploadExtension,
    ],
    content: value ?? undefined,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON())
    },
  })

  // Sync external value changes (e.g. when parent resets)
  useEffect(() => {
    if (!editor) return
    const current = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(value)
    if (current !== next) {
      editor.commands.setContent(value ?? '', false)
    }
  }, [editor, value])

  async function handleImageFileSelected(file: File) {
    if (!editor) return
    setImageUploading(true)
    try {
      const url = await uploadToSignedUrl(
        file,
        '/api/admin/guides/upload-url',
        '/api/admin/guides/upload-url/confirm',
      )
      editor.chain().focus().setImage({ src: url }).run()
    } catch (e) {
      toast.error((e as Error).message ?? 'Image upload failed')
    } finally {
      setImageUploading(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: 'var(--border-default)' }}
    >
      {label && (
        <div
          className="px-3 py-1.5 border-b text-[10px] font-semibold uppercase tracking-widest"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)' }}
        >
          {label}
        </div>
      )}
      <Toolbar
        editor={editor}
        onImageClick={() => imageInputRef.current?.click()}
        imageUploading={imageUploading}
      />
      <EditorContent
        editor={editor}
        className="tiptap-editor min-h-[200px] px-4 py-3 text-sm"
        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) void handleImageFileSelected(file)
          // reset so same file can be re-selected
          e.target.value = ''
        }}
      />
    </div>
  )
}
