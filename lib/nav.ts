// Single source of truth for all navigation configs.
// Adding, removing, or renaming a route = one edit here, propagates everywhere.
//
// Consumer guide:
//   Header    — PUBLIC_NAV + MEMBER_NAV (filters /los)
//   Footer    — PUBLIC_NAV + FOOTER_MEMBER_NAV (guides + profile, no /los)
//   AdminNav  — ADMIN_NAV

export type NavItem = {
  href: string
  labels: { en: string; bg: string }
  minRole?: 'member' | 'core' | 'admin'
}

export const PUBLIC_NAV: NavItem[] = [
  { href: '/',         labels: { en: 'Home',     bg: 'Начало'    } },
  { href: '/about',    labels: { en: 'About',    bg: 'За нас'    } },
  { href: '/calendar', labels: { en: 'Calendar', bg: 'Календар'  } },
  { href: '/trips',    labels: { en: 'Trips',    bg: 'Пътувания' } },
]

export const MEMBER_NAV: NavItem[] = [
  { href: '/guides',  labels: { en: 'Guides',     bg: 'Ръководства' }, minRole: 'member' },
  { href: '/los',     labels: { en: 'My Network', bg: 'Моята мрежа'  }, minRole: 'member' },
  { href: '/profile', labels: { en: 'Profile',    bg: 'Профил'       }, minRole: 'member' },
]

// Footer shows guides + profile but not /los
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
]
