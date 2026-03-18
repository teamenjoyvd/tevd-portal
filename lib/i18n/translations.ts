export type Lang = 'en' | 'bg'

export const translations = {
  // Navigation
  'nav.home':          { en: 'Home',          bg: 'Начало'       },
  'nav.about':         { en: 'About',         bg: 'За нас'       },
  'nav.calendar':      { en: 'Calendar',      bg: 'Календар'     },
  'nav.trips':         { en: 'Trips',         bg: 'Пътувания'    },
  'nav.profile':       { en: 'Profile',       bg: 'Профил'       },
  'nav.notifications': { en: 'Notifications', bg: 'Известия'     },
  'nav.admin':         { en: 'Admin',         bg: 'Админ'        },
  'nav.network':       { en: 'My Network',    bg: 'Моята мрежа'  },
  'nav.signIn':        { en: 'Sign in',       bg: 'Вход'         },

  // Notifications page
  'notif.unread':             { en: '{n} unread',           bg: '{n} непрочетени'                  },
  'notif.markAllRead':        { en: 'Mark all as read',     bg: 'Маркирай всички като прочетени'   },
  'notif.allCaughtUp':        { en: 'All caught up',        bg: 'Всичко е прочетено'               },
  'notif.empty':              { en: 'No notifications yet.', bg: 'Все още няма известия.'          },
  'notif.view':               { en: 'View →',               bg: 'Виж →'                           },
  'notif.delete':             { en: 'Delete notification',  bg: 'Изтрий известие'                 },
  'notif.clearAll':           { en: 'Clear all',            bg: 'Изчисти всички'                  },
  'notif.type.roleRequest':   { en: 'Role request',         bg: 'Заявка за роля'                  },
  'notif.type.tripRequest':   { en: 'Trip request',         bg: 'Заявка за пътуване'              },
  'notif.type.tripCreated':   { en: 'New trip',             bg: 'Ново пътуване'                   },
  'notif.type.eventFetched':  { en: 'New event',            bg: 'Ново събитие'                    },
  'notif.type.docExpiry':     { en: 'Document expiry',      bg: 'Изтичане на документ'            },

  // Profile page
  'profile.identity':          { en: 'Identity',                bg: 'Самоличност'              },
  'profile.firstName':         { en: 'First name',              bg: 'Собствено име'            },
  'profile.lastName':          { en: 'Last name',               bg: 'Фамилно име'              },
  'profile.role':              { en: 'Role',                    bg: 'Роля'                     },
  'profile.aboVerification':   { en: 'ABO Verification',        bg: 'ABO Верификация'          },
  'profile.aboVerifDesc':      {
    en: 'Enter your Amway ABO number and your sponsor\'s ABO number to request verification.',
    bg: 'Въведете вашия Amway ABO номер и ABO номера на спонсора, за да заявите верификация.',
  },
  'profile.yourAbo':           { en: 'Your ABO number',         bg: 'Вашият ABO номер'         },
  'profile.sponsorAbo':        { en: "Sponsor's ABO number",    bg: 'ABO номер на спонсора'    },
  'profile.verifPending':      { en: 'Verification pending',    bg: 'Верификацията е в изчакване' },
  'profile.cancelRequest':     { en: 'Cancel request',          bg: 'Отмени заявката'          },
  'profile.submitVerif':       { en: 'Submit for verification', bg: 'Изпрати за верификация'   },
  'profile.submitting':        { en: 'Submitting…',             bg: 'Изпращане…'               },
  'profile.prevDenied':        { en: 'Previous request was not approved', bg: 'Предишната заявка не беше одобрена' },
  'profile.checkDetails':      { en: 'Please check your details and submit again.', bg: 'Моля, проверете данните и опитайте отново.' },
  'profile.travelDoc':         { en: 'Travel document',         bg: 'Документ за пътуване'     },
  'profile.nationalId':        { en: 'National ID',             bg: 'Лична карта'              },
  'profile.passport':          { en: 'Passport',                bg: 'Паспорт'                  },
  'profile.idNumber':          { en: 'ID number',               bg: 'Номер на документа'       },
  'profile.passportNumber':    { en: 'Passport number',         bg: 'Номер на паспорта'        },
  'profile.validThrough':      { en: 'Valid through',           bg: 'Валидно до'               },
  'profile.saveChanges':       { en: 'Save changes',            bg: 'Запази промените'         },
  'profile.saving':            { en: 'Saving…',                 bg: 'Запазване…'               },
  'profile.saved':             { en: 'Saved ✓',                 bg: 'Запазено ✓'               },
  'profile.calSub':            { en: 'Calendar Subscription',   bg: 'Абонамент за календар'    },
  'profile.calSubDesc':        { en: 'Subscribe to your personalised calendar feed on your phone or any calendar app.', bg: 'Абонирайте се за персонализирания си календар на телефона или в приложение за календар.' },
  'profile.calSubInstructions': { en: 'Open your phone calendar app → Add calendar → From URL → Paste the link below. Your calendar will update automatically.', bg: 'Отворете приложението за календар → Добавяне на календар → По URL → Поставете линка по-долу. Календарът ви ще се обновява автоматично.' },
  'profile.calSubCopy':        { en: 'Copy link',               bg: 'Копирай линк'             },
  'profile.calSubCopied':      { en: 'Copied!',                 bg: 'Копирано!'                },
  'profile.calSubRegenerate':  { en: 'Regenerate',              bg: 'Регенерирай'              },
  'profile.expiry.ok':         { en: 'Valid',                   bg: 'Валидно'                  },
  'profile.expiry.warning':    { en: 'Expiring soon — update within 6 months', bg: 'Изтича скоро — обновете в рамките на 6 месеца' },
  'profile.expiry.critical':   { en: 'Expired or expiring very soon — action required', bg: 'Изтекло или изтича много скоро — необходимо е действие' },
  'profile.role.desc.guest':   { en: 'Submit your ABO number below to become a verified Member.', bg: 'Въведете вашия ABO номер по-долу, за да станете верифициран член.' },
  'profile.role.desc.member':  { en: 'Verified member.',        bg: 'Верифициран член.'        },
  'profile.role.desc.core':    { en: 'Core team member.',       bg: 'Член на основния екип.'   },
  'profile.role.desc.admin':   { en: 'Administrator.',          bg: 'Администратор.'           },

  // Trips page
  'trips.registerBtn':       { en: 'Register for this trip',  bg: 'Регистрирай се за пътуването'      },
  'trips.noTrips':           { en: 'No trips yet',            bg: 'Все още няма пътувания'             },
  'trips.noTripsDesc':       { en: 'Check back soon — upcoming trips will appear here.', bg: 'Проверете отново скоро — предстоящи пътувания ще се появят тук.' },
  'trips.payments':          { en: 'Payments',                bg: 'Плащания'                           },
  'trips.paidOf':            { en: 'paid of',                 bg: 'платено от'                         },
  'trips.milestones':        { en: 'Milestones',              bg: 'Етапи'                              },
  'trips.paymentHistory':    { en: 'Payment history',         bg: 'История на плащанията'              },
  'trips.due':               { en: 'Due',                     bg: 'Краен срок'                         },
  'trips.total':             { en: 'total',                   bg: 'общо'                               },
  'trips.paidPercent':       { en: '% paid',                  bg: '% платено'                          },
  'trips.cancel':            { en: 'Cancel',                  bg: 'Откажи'                             },
  'trips.status.pending':    { en: 'Pending approval',        bg: 'Изчаква одобрение'                  },
  'trips.status.approved':   { en: 'Approved',                bg: 'Одобрено'                           },
  'trips.status.denied':     { en: 'Declined',                bg: 'Отказано'                           },

  // Calendar
  'cal.today':     { en: 'Today',   bg: 'Днес'      },
  'cal.month':     { en: 'Month',   bg: 'Месец'     },
  'cal.week':      { en: 'Week',    bg: 'Седмица'   },
  'cal.day':       { en: 'Day',     bg: 'Ден'       },
  'cal.agenda':    { en: 'Agenda',  bg: 'Програма'  },
  'cal.personal':  { en: 'Personal', bg: 'Лично'    },
  'cal.noEvents':  { en: 'No upcoming events.', bg: 'Няма предстоящи събития.' },

  // Event popup
  'event.roles':           { en: 'Roles',             bg: 'Роли'                           },
  'event.requestRole':     { en: '+ Request a role',  bg: '+ Заяви роля'                   },
  'event.submit':          { en: 'Submit',             bg: 'Изпрати'                        },
  'event.submitting':      { en: 'Submitting…',        bg: 'Изпращане…'                     },
  'event.cancel':          { en: 'Cancel',             bg: 'Откажи'                         },
  'event.signInForRole':   { en: 'Sign in to request a role.', bg: 'Влезте, за да заявите роля.' },
  'event.notePlaceholder': { en: 'Note (optional)…',   bg: 'Бележка (по желание)…'          },
  'los.title':             { en: 'My Network',          bg: 'Моята мрежа'                    },
  'los.subtitle':          { en: 'Your position in the line of sponsorship', bg: 'Вашата позиция в линията на спонсорство' },
  'los.upline':            { en: 'Upline',              bg: 'Спонсори'                        },
  'los.you':               { en: 'You',                 bg: 'Вие'                             },
  'los.downlines':         { en: 'Downlines',           bg: 'Низходяща линия'                 },
  'los.level':             { en: 'Level',               bg: 'Ниво'                            },
  'los.noNetwork':         { en: 'No network data found.', bg: 'Няма намерени данни за мрежата.' },
  'los.noDownlines':       { en: 'No downlines yet.',   bg: 'Все още няма низходяща линия.'   },
} as const

export type TranslationKey = keyof typeof translations

export function translate(key: TranslationKey, lang: Lang): string {
  return translations[key][lang]
}

// Day and month arrays for calendar — index-based access
export const DAYS_I18N: Record<Lang, string[]> = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  bg: ['Пон', 'Вт',  'Ср',  'Чет', 'Пет', 'Съб', 'Нед'],
}

export const MONTHS_I18N: Record<Lang, string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  bg: ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'],
}
