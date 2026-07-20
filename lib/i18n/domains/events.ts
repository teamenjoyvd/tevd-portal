export const events = {
  'event.roles':           { en: 'Roles',             bg: 'Роли'                           },
  'event.requestRole':     { en: '+ Request a role',  bg: '+ Заяви роля'                   },
  'event.submit':          { en: 'Submit',             bg: 'Изпрати'                        },
  'event.submitting':      { en: 'Submitting…',        bg: 'Изпращане…'                     },
  'event.cancel':          { en: 'Cancel',             bg: 'Откажи'                         },
  'event.signInForRole':   { en: 'Sign in to request a role.', bg: 'Влезте, за да заявите роля.' },
  'event.notePlaceholder': { en: 'Note (optional)…',   bg: 'Бележка (по желание)…'          },

  // slot status labels
  'event.slot.open':        { en: 'Open',              bg: 'Свободна'                        },
  'event.slot.contested':   { en: 'Pending approval',  bg: 'Очаква одобрение'                },
  'event.slot.filled':      { en: 'Filled',            bg: 'Заета'                           },
  'event.slot.yourRequest': { en: 'Your request',      bg: 'Вашата заявка'                   },

  // profile name gate
  'event.nameRequiredToRequest': { en: 'To request a role, please complete your name in your profile.', bg: 'За да заявите роля, моля попълнете името си в профила.' },
  'event.goToProfile':           { en: 'Go to profile',                                                  bg: 'Към профила'                                                                  },

  // roles page
  'event.rolesPageTitle':   { en: 'Roles',             bg: 'Роли'                            },
  'event.rolesEmpty':       { en: 'No events with roles configured this quarter.', bg: 'Няма събития с конфигурирани роли за това тримесечие.' },

  // roles page — table headers
  'event.roles.col.event':    { en: 'Event',    bg: 'Събитие'  },
  'event.roles.col.date':     { en: 'Date',     bg: 'Дата'     },
  'event.roles.col.time':     { en: 'Time',     bg: 'Час'      },

  // roles page — slot role labels
  'event.roles.label.host':     { en: 'Host',     bg: 'Домакин'   },
  'event.roles.label.speaker':  { en: 'Speaker',  bg: 'Говорител' },
  'event.roles.label.products': { en: 'Products', bg: 'Продукти'  },

  // join page
  'event.join.brandName':          { en: 'TeamEnjoyVD',                                              bg: 'TeamEnjoyVD'                                                    },
  'event.join.linkExpired':        { en: 'This link has expired.',                                   bg: 'Тази връзка е изтекла.'                                         },
  'event.join.linkInvalid':        { en: 'This link is invalid.',                                    bg: 'Тази връзка е невалидна.'                                       },
  'event.join.linkRevoked':        { en: 'This link is no longer active.',                           bg: 'Тази връзка вече не е активна.'                                 },
  'event.join.registerAgainDesc':  { en: 'Please register again to receive a fresh access link.',    bg: 'Моля, регистрирайте се отново, за да получите нова връзка.'      },
  'event.join.registerAgain':      { en: 'Register again',                                           bg: 'Регистрирайте се отново'                                        },
  'event.join.youreJoining':       { en: "You're joining",                                          bg: 'Присъединявате се към'                                          },
  'event.join.hiClick':            { en: 'Hi {name}, click the button below to open the meeting.',   bg: 'Здравейте {name}, натиснете бутона, за да отворите срещата.'      },
  'event.join.hiTap':              { en: 'Hi {name}, tap the button below to open the meeting.',     bg: 'Здравейте {name}, докоснете бутона, за да отворите срещата.'     },
  'event.join.joinMeeting':        { en: 'Join Meeting',                                             bg: 'Присъединете се'                                                },
  'event.join.noMeetingLink':      { en: 'Meeting link not yet available. Check back closer to the event.', bg: 'Връзката към срещата все още не е налична. Проверете по-близо до събитието.' },
  'event.join.linkCancelled':      { en: 'You cancelled your registration for this event.',         bg: 'Отказахте регистрацията си за това събитие.'                    },

  // join page — can't-attend / cancel (T4, 2607-DEV-590)
  'event.join.cantAttend':         { en: "Can't attend?",                                            bg: 'Не можете да присъствате?'                                      },
  'event.join.cancelConfirmTitle': { en: 'Cancel your registration?',                                bg: 'Отказ от регистрацията?'                                        },
  'event.join.cancelConfirmDesc':  { en: "We'll let the person who invited you know you can't make it.", bg: 'Ще уведомим поканилия ви, че не можете да присъствате.'      },
  'event.join.cancelSuccess':      { en: "You're marked as unable to attend. See you next time!",    bg: 'Отбелязани сте като неприсъстващ. До скоро!'                    },
  'event.join.cancelError':        { en: 'Could not cancel. Please try again.',                       bg: 'Отказът не бе успешен. Моля, опитайте отново.'                 },

  // join/components/JoinActions
  'event.join.copyLinkHint':       { en: "If the button above doesn't open, copy this link directly:", bg: 'Ако бутонът не работи, копирайте тази връзка директно:'         },
  'event.join.addToCalendar':      { en: 'Add to calendar',                                          bg: 'Добави в календар'                                              },
  'event.join.googleCalendar':     { en: 'Google Calendar',                                          bg: 'Google Calendar'                                                },
  'event.join.outlook':            { en: 'Outlook',                                                  bg: 'Outlook'                                                        },
  'event.join.downloadIcs':        { en: 'Download .ics (Apple Calendar & others)',                  bg: 'Изтегли .ics (Apple Calendar и др.)'                            },

  // register page
  'event.register.registerToGet':  { en: 'Register to get your access link',                         bg: 'Регистрирайте се за достъп'                                     },
  'event.register.eventEnded':     { en: 'This event has already ended. Registration is closed.',   bg: 'Това събитие вече приключи. Регистрацията е затворена.'         },
  'event.register.linkNoLongerActive': { en: 'This share link is no longer active.',                bg: 'Тази връзка за споделяне вече не е активна.'                     },
  'event.register.full':           { en: 'This event has reached its guest capacity.',               bg: 'Това събитие достигна максималния брой гости.'                   },

  // register/components/RegisterForm
  'event.register.checkInbox':     { en: 'Check your inbox',                                         bg: 'Проверете пощата си'                                            },
  'event.register.sentLink':       { en: "We've sent your access link. The link expires after the event ends.", bg: 'Изпратихме ви връзка за достъп. Тя изтича след края на събитието.' },
  'event.register.fullName':       { en: 'Full Name',                                                bg: 'Пълно име'                                                      },
  'event.register.yourName':       { en: 'Your name',                                                bg: 'Вашето име'                                                     },
  'event.register.emailAddress':   { en: 'Email Address',                                            bg: 'Имейл адрес'                                                    },
  'event.register.emailPlaceholder': { en: 'you@example.com',                                        bg: 'you@example.com'                                                },
  'event.register.sendingLink':    { en: 'Sending link…',                                            bg: 'Изпращане…'                                                     },
  'event.register.getAccessLink':  { en: 'Get access link',                                          bg: 'Получете връзка за достъп'                                      },
  'event.register.noAccountDesc':  { en: 'No account needed.',                                       bg: 'Не е нужен акаунт.'                                             },
  'event.register.emailDesc':      { en: "We'll email you a personal link to join",                  bg: 'Ще ви изпратим личен линк за присъединяване към'                },

  // roles page quarters and view controls
  'event.roles.view.history': { en: 'History', bg: 'История' },
  'event.roles.history.empty': { en: 'No participation records found.', bg: 'Няма намерени записи за участие.' },
  'event.roles.history.col.name': { en: 'Name', bg: 'Име' },
  'event.roles.history.col.total': { en: 'Total', bg: 'Общо' },
  'event.roles.updating': { en: 'Updating view...', bg: 'Обновяване...' },

  // register/join page — event-ended-closed state (T3, 2607-DEV-589)
  'event.register.closed': { en: 'This event has ended and registration is closed.', bg: 'Това събитие приключи и регистрацията е затворена.' },

  // resend link (T3, 2607-DEV-589)
  'event.resend.title':     { en: "Didn't get the link?",                              bg: 'Не получихте връзката?' },
  'event.resend.button':    { en: 'Resend access link',                                 bg: 'Изпрати отново връзката' },
  'event.resend.sending':   { en: 'Sending…',                                           bg: 'Изпращане…' },
  'event.resend.sent':      { en: "If that email is registered, we've sent a new link.", bg: 'Ако имейлът е регистриран, изпратихме нова връзка.' },
  'event.resend.emailPlaceholder': { en: 'you@example.com',                             bg: 'you@example.com' },
} as const


