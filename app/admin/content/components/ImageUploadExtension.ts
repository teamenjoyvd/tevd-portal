import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { uploadToSignedUrl } from '@/lib/utils/uploadToSignedUrl'
import { toast } from 'sonner'

/**
 * Upload a file and insert an image node at the given position (or current
 * selection if pos is undefined). Exported so TiptapEditor can reuse it
 * for the toolbar file-picker path without duplicating the upload call.
 */
export async function uploadAndInsert(file: File, view: EditorView, pos?: number): Promise<void> {
  try {
    const url = await uploadToSignedUrl(
      file,
      '/api/admin/guides/upload-url',
      '/api/admin/guides/upload-url/confirm',
    )
    const { schema } = view.state
    const node = schema.nodes.image.create({ src: url })
    const tr = view.state.tr
    if (pos !== undefined) {
      tr.insert(pos, node)
    } else {
      tr.replaceSelectionWith(node)
    }
    view.dispatch(tr)
  } catch (e) {
    toast.error((e as Error).message ?? 'Image upload failed')
  }
}

export const ImageUploadExtension = Extension.create({
  name: 'imageUpload',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDrop(view, event) {
            const files = Array.from(event.dataTransfer?.files ?? [])
            const images = files.filter(f => f.type.startsWith('image/'))
            if (images.length === 0) return false

            event.preventDefault()
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            const pos = coords?.pos

            for (const image of images) {
              void uploadAndInsert(image, view, pos)
            }
            return true
          },

          handlePaste(view, event) {
            const items = Array.from(event.clipboardData?.items ?? [])
            const imageItems = items.filter(
              item => item.kind === 'file' && item.type.startsWith('image/'),
            )
            if (imageItems.length === 0) return false

            event.preventDefault()
            for (const item of imageItems) {
              const file = item.getAsFile()
              if (!file) continue
              void uploadAndInsert(file, view)
            }
            return true
          },
        },
      }),
    ]
  },
})
