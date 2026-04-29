// Single source of truth for all navigation configs.
// Adding, removing, or renaming a route = one edit here, propagates everywhere.
//
// Consumer guide:
//   Header    — PUBLIC_NAV + FOOTER_MEMBER_NAV (library + profile, no /los)
//   Footer    — PUBLIC_NAV + FOOTER_MEMBER_NAV (library + profile, no /los)
//   AdminNav  — ADMIN_NAV

export type NavItem = {
  href: string
  labels: { en: string; bg: string }
  minRole?: 'member' | 'core' | 'admin'
}

// Role hierarchy — higher rank = more access.
// Signed-out users receive rank -1 (filtered from all member items).
const ROLE_RANK: Record<'guest' | NonNullable<NavItem['minRole']>, number> = {
  guest:  0,
  member: 1,
  core:   2,
  admin:  3,
}

/**
 * Returns only the nav items the given role is permitted to see.
 * Items without minRole are always included.
 * Pass `role = undefined` for signed-out users — they see PUBLIC_NAV only.
 */
export function filterNav(items: NavItem[], role: string | undefined): NavItem[] {
  const rank = role !== undefined ? (ROLE_RANK[role as keyof typeof ROLE_RANK] ?? -1) : -1
  return items.filter(item => !item.minRole || rank >= ROLE_RANK[item.minRole])
}

export const PUBLIC_NAV: NavItem[] = [
  { href: '/',         labels: { en: 'Home',     bg: 'Начало'    } },
  { href: '/about',    labels: { en: 'About',    bg: 'За нас'    } },
  { href: '/calendar', labels: { en: 'Calendar', bg: 'Календар'  } },
  { href: '/trips',    labels: { en: 'Trips',    bg: 'Пътувания' } },
]

export const MEMBER_NAV: NavItem[] = [
  { href: '/library', labels: { en: 'Library',    bg: 'Библиотека'  }, minRole: 'member' },
  { href: '/los',     labels: { en: 'My Network', bg: 'Моята мрежа' }, minRole: 'member' },
  { href: '/profile', labels: { en: 'Profile',    bg: 'Профил'      }, minRole: 'member' },
]

// Footer and Header both show library + profile but not /los
export const FOOTER_MEMBER_NAV: NavItem[] = MEMBER_NAV.filter(
  item => item.href !== '/los'
)

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/approval-hub',  labels: { en: 'Approval Hub',  bg: 'Approval Hub'  } },
  { href: '/admin/operations',    labels: { en: 'Operations',    bg: 'Operations'    } },
  { href: '/admin/calendar',      labels: { en: 'Calendar',      bg: 'Calendar'      } },
  { href: '/admin/content',       labels: { en: 'Content',       bg: 'Content'       } },
  { href: '/admin/notifications', labels: { en: 'Notifications', bg: 'Notifications' } },
  { href: '/admin/members',       labels: { en: 'Members',       bg: 'Members'       } },
  { href: '/admin/settings',      labels: { en: 'Settings',      bg: 'Settings'      } },
]
