import { useEffect } from 'react'

/**
 * Injects a "Copy" button into every `pre code` block found inside `ref`.
 * Safe to call on re-renders — guarded by `.tiptap-copy-btn` presence check.
 * Reads codeEl.textContent at click time (never stale on optimistic updates).
 *
 * @param ref   - RefObject pointing at the container element
 * @param deps  - Extra deps that trigger re-injection (e.g. [html])
 */
export function useTiptapCopyButtons(
  ref: React.RefObject<HTMLElement | null>,
  deps: unknown[] = [],
): void {
  useEffect(() => {
    const container = ref.current
    if (!container) return

    const blocks = container.querySelectorAll<HTMLElement>('pre code')
    if (!blocks.length) return

    const cleanups: (() => void)[] = []

    blocks.forEach(codeEl => {
      const pre = codeEl.parentElement
      if (!pre) return
      // Idempotency guard — skip if already injected
      if (pre.querySelector('.tiptap-copy-btn')) return

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tiptap-copy-btn'
      btn.setAttribute('aria-label', 'Copy code')
      btn.textContent = 'Copy'

      let timeout: ReturnType<typeof setTimeout>

      function handleClick() {
        const text = codeEl.textContent ?? ''
        void navigator.clipboard.writeText(text).then(() => {
          btn.textContent = 'Copied!'
          clearTimeout(timeout)
          timeout = setTimeout(() => {
            btn.textContent = 'Copy'
          }, 2000)
        })
      }

      btn.addEventListener('click', handleClick)
      pre.appendChild(btn)

      cleanups.push(() => {
        clearTimeout(timeout)
        btn.removeEventListener('click', handleClick)
        btn.remove()
      })
    })

    return () => {
      cleanups.forEach(fn => fn())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps])
}
