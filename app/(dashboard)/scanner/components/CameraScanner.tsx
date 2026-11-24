'use client'

import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { useLanguage } from '@/lib/hooks/useLanguage'

/** Loaded with ssr: false. Reports one code, then the parent unmounts it. */
export default function CameraScanner({ onScan }: { onScan: (text: string) => void }) {
  const { t } = useLanguage()
  const video = useRef<HTMLVideoElement>(null)
  const report = useRef(onScan)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    report.current = onScan
  }, [onScan])

  useEffect(() => {
    if (video.current === null) return
    let done = false
    const scanner = new QrScanner(
      video.current,
      (result) => {
        if (done) return
        done = true
        report.current(result.data)
      },
      { preferredCamera: 'environment', returnDetailedScanResult: true, highlightScanRegion: true },
    )
    scanner.start().catch(() => {
      if (!done) setFailed(true)
    })
    return () => {
      done = true
      scanner.destroy()
    }
  }, [])

  return failed ? (
    <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>{t('tickets.door.cameraFailed')}</p>
  ) : (
    <div className="relative overflow-hidden rounded-xl">
      <video ref={video} muted playsInline className="block w-full" aria-label={t('tickets.door.camera')} />
    </div>
  )
}
