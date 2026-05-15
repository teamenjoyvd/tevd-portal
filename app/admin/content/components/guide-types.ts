// Shared domain types and utilities for guide/news content.
// No 'use client' — plain TypeScript module.

import type { JSONContent } from '@tiptap/react'

export type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  cover_image_url: string | null
  emoji: string | null
  body: { en: JSONContent; bg: JSONContent } | null
  access_roles: string[]
  is_published: boolean
  created_at: string
  updated_at: string
  sort_order: number
}

export const ALL_ROLES = ['guest', 'member', 'core', 'admin']

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function emptyGuide(): Omit<Guide, 'id' | 'created_at' | 'updated_at'> {
  return {
    slug: '',
    title: { en: '', bg: '' },
    cover_image_url: null,
    emoji: null,
    body: null,
    access_roles: [...ALL_ROLES],
    is_published: false,
    sort_order: 0,
  }
}
