'use client'

/**
 * LocationMap — decorative, self-contained location card.
 *
 * Adapted from 21st.dev `jatin-yadav05/expand-map`. It replaced a Mapbox GL
 * tile: the constructor threw "Failed to initialize WebGL" on browsers without
 * a GPU context (privacy browsers, GPU blocklists) and, because it ran inside a
 * useEffect, took the whole dashboard down to app/(dashboard)/error.tsx. This
 * draws its "map" in SVG, so it has no renderer to fail.
 *
 * Two deliberate deviations from upstream:
 *   1. The size animation is a CSS transition in percentages, not a framer
 *      animation in pixels. Upstream springs 240x140 -> 360x280 in fixed pixels;
 *      360px overflows the 358px content box at a 390px viewport and 280px is
 *      taller than the bento row. The card transitions between
 *      COLLAPSED_WIDTH_PCT/COLLAPSED_HEIGHT_PCT and 100% of its tile instead, on
 *      a back-out easing that overshoots slightly so it still reads as a spring.
 *      The tile's footprint never changes and nothing overflows.
 *   2. Colours come from the brand tokens in styles/brand-tokens.css. Upstream
 *      targets stock shadcn base tokens (--foreground, --muted, --background),
 *      none of which this project defines.
 *
 * Expanded is the default state; a click or Enter/Space collapses it.
 *
 * REDUCED MOTION: this tile deliberately does NOT honour
 * `prefers-reduced-motion` (product decision, 2026-08-06, #700). It used to,
 * via `transition={reduceMotion ? instant : …}` on every animated prop — but
 * `instant` is `{ duration: 0 }`, which keeps the state change and removes only
 * the smoothing. The 4px hover nudge on the location name therefore teleported
 * rather than easing, and the whole card read as a hard on/off. If this is ever
 * reinstated, suppress the movement itself (x: 0, no scale/size change), never
 * merely zero the duration. The repo-wide guard in app/globals.css is scoped to
 * .skeleton-shimmer / .bento-tile / .interactive-lift, none of which this
 * component carries, so it does not re-disable these transitions.
 *
 * Strings are props, not translations — the component stays i18n-agnostic like
 * the rest of components/ui. Callers pass translated text.
 */

import type React from 'react'

import { useId, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'

import { cn } from '@/lib/utils'

// Brand palette, resolved against the forest card this sits on.
const PARCHMENT = 'var(--brand-parchment)'
const STONE = 'var(--brand-stone)'
const MOSS = 'var(--brand-moss)'
const ACCENT = 'var(--brand-sienna)'
const ACCENT_RGB = 'var(--brand-sienna-rgb)'

const stone = (alpha: number) => `rgba(var(--brand-stone-rgb), ${alpha})`

// Skyline blocks: [top, left|right, width, height, fill alpha, entrance delay].
const BUILDINGS: {
  top: string
  left?: string
  right?: string
  width: string
  height: string
  alpha: number
  delay: number
}[] = [
  { top: '40%', left: '10%', width: '15%', height: '20%', alpha: 0.3, delay: 0.5 },
  { top: '15%', left: '35%', width: '12%', height: '15%', alpha: 0.25, delay: 0.6 },
  { top: '70%', left: '75%', width: '18%', height: '18%', alpha: 0.28, delay: 0.7 },
  { top: '20%', right: '10%', width: '10%', height: '25%', alpha: 0.22, delay: 0.55 },
  { top: '55%', left: '5%', width: '8%', height: '12%', alpha: 0.2, delay: 0.65 },
  { top: '8%', left: '75%', width: '14%', height: '10%', alpha: 0.22, delay: 0.75 },
]

const H_STREETS = [20, 50, 80]
const V_STREETS = [15, 45, 55, 85]

// Collapsed size, as a percentage share of the tile. Percentages, not pixels, so
// no state can overflow the tile and the card stays responsive.
const COLLAPSED_WIDTH_PCT = 68
const COLLAPSED_HEIGHT_PCT = 64

interface LocationMapProps {
  location?: string
  coordinates?: string
  className?: string
}

export function LocationMap({
  location = 'Sofia, Bulgaria',
  coordinates = '42.6977° N, 23.3219° E',
  className,
}: LocationMapProps) {
  const [isHovered, setIsHovered] = useState(false)
  // Expanded on load; a click or Enter/Space swaps it.
  const [isExpanded, setIsExpanded] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  // The <pattern> id must be unique: the home page mounts this tile twice
  // (desktop + mobile branches of app/(dashboard)/page.tsx are both in the DOM).
  const gridId = useId()

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-50, 50], [8, -8])
  const rotateY = useTransform(mouseX, [-50, 50], [-8, 8])

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    mouseX.set(e.clientX - centerX)
    mouseY.set(e.clientY - centerY)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
    setIsHovered(false)
  }

  const toggle = () => setIsExpanded((prev) => !prev)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    toggle()
  }

  return (
    <motion.div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={location}
      className={cn(
        'relative flex h-full w-full cursor-pointer items-center justify-center select-none',
        className,
      )}
      style={{ perspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={toggle}
      onKeyDown={handleKeyDown}
    >
      {/* The size is a plain inline value with a CSS transition, NOT a framer
          animation. Routed through framer it never reached the DOM: `animate`
          is not scraped into the first render, and every MotionValue variant
          was defeated by the device's reduced-motion setting. A CSS transition
          is also identical on the server and the client.
          No `motion-reduce:` variant here — see the reduced-motion note in the
          file header for why this tile animates unconditionally. */}
      <motion.div
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'transition-[width,height] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        )}
        style={{
          width: isExpanded === true ? '100%' : `${COLLAPSED_WIDTH_PCT}%`,
          height: isExpanded === true ? '100%' : `${COLLAPSED_HEIGHT_PCT}%`,
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to bottom right, ${stone(0.06)}, transparent, ${stone(0.12)})`,
          }}
        />

        {/* initial={false}: expanded is the mount state, so without this the
            entrance animation runs during hydration and React reports a
            mismatch it refuses to patch (server opacity:0 vs client opacity:1,
            strokeDasharray "0 1" vs "1 1"). Toggling still animates. */}
        <AnimatePresence initial={false}>
          {isExpanded === true && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="absolute inset-0" style={{ backgroundColor: MOSS }} />

              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                {/* Main roads */}
                <motion.line
                  x1="0%" y1="35%" x2="100%" y2="35%"
                  stroke={PARCHMENT} strokeOpacity={0.25} strokeWidth="4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <motion.line
                  x1="0%" y1="65%" x2="100%" y2="65%"
                  stroke={PARCHMENT} strokeOpacity={0.25} strokeWidth="4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                />

                {/* Vertical main roads */}
                <motion.line
                  x1="30%" y1="0%" x2="30%" y2="100%"
                  stroke={PARCHMENT} strokeOpacity={0.2} strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                />
                <motion.line
                  x1="70%" y1="0%" x2="70%" y2="100%"
                  stroke={PARCHMENT} strokeOpacity={0.2} strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />

                {/* Secondary streets */}
                {H_STREETS.map((y, i) => (
                  <motion.line
                    key={`h-${y}`}
                    x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`}
                    stroke={PARCHMENT} strokeOpacity={0.1} strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
                  />
                ))}
                {V_STREETS.map((x, i) => (
                  <motion.line
                    key={`v-${x}`}
                    x1={`${x}%`} y1="0%" x2={`${x}%`} y2="100%"
                    stroke={PARCHMENT} strokeOpacity={0.1} strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
                  />
                ))}
              </svg>

              {/* Buildings */}
              {BUILDINGS.map((b) => (
                <motion.div
                  key={`${b.top}-${b.left ?? b.right}`}
                  className="absolute rounded-sm border"
                  style={{
                    top: b.top,
                    ...(b.left != null ? { left: b.left } : { right: b.right }),
                    width: b.width,
                    height: b.height,
                    backgroundColor: stone(b.alpha),
                    borderColor: stone(b.alpha * 0.65),
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: b.delay }}
                />
              ))}

              {/* Pin */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.3 }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ filter: `drop-shadow(0 0 10px rgba(${ACCENT_RGB}, 0.5))` }}
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                    fill={ACCENT}
                  />
                  <circle cx="12" cy="9" r="2.5" fill={MOSS} />
                </svg>
              </motion.div>

              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage: `linear-gradient(to top, ${MOSS}, transparent, transparent)`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid pattern — collapsed state only */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: isExpanded === true ? 0 : 0.06 }}
          transition={{ duration: 0.3 }}
        >
          <svg width="100%" height="100%" className="absolute inset-0">
            <defs>
              <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke={PARCHMENT} strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${gridId})`} />
          </svg>
        </motion.div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-5">
          {/* Top section */}
          <div className="flex items-start justify-between">
            <motion.div
              animate={{ opacity: isExpanded === true ? 0 : 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{
                  filter:
                    isHovered === true
                      ? `drop-shadow(0 0 8px rgba(${ACCENT_RGB}, 0.6))`
                      : `drop-shadow(0 0 4px rgba(${ACCENT_RGB}, 0.3))`,
                }}
                transition={{ duration: 0.3 }}
              >
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" x2="9" y1="3" y2="18" />
                <line x1="15" x2="15" y1="6" y2="21" />
              </motion.svg>
            </motion.div>
          </div>

          {/* Bottom section */}
          <div className="space-y-1">
            <motion.p
              className="font-body text-sm font-semibold tracking-tight"
              style={{ color: PARCHMENT }}
              animate={{ x: isHovered === true ? 4 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {location}
            </motion.p>

            {/* initial={false} for the same reason as the map layer above: the
                coordinates render on mount now, so an entrance animation here
                is a hydration mismatch. */}
            <AnimatePresence initial={false}>
              {isExpanded === true && (
                <motion.p
                  className="font-mono text-xs"
                  style={{ color: STONE }}
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {coordinates}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Animated underline. initial={false}: the underline renders on
                mount, so an entrance animation here is a hydration mismatch.
                It animates on state changes either way. */}
            <motion.div
              className="h-px"
              style={{
                originX: 0,
                backgroundImage: `linear-gradient(to right, rgba(${ACCENT_RGB}, 0.5), rgba(${ACCENT_RGB}, 0.3), transparent)`,
              }}
              initial={false}
              animate={{ scaleX: isHovered === true || isExpanded === true ? 1 : 0.3 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
