export const events = {
  'event.roles':           { en: 'Roles',             bg: 'Роли'                           },
  'event.requestRole':     { en: '+ Request a role',  bg: '+ Заяви роля'                   },
  'event.submit':          { en: 'Submit',             bg: 'Изпрати'                        },
  'event.submitting':      { en: 'Submitting…',        bg: 'Изпращане…'                     },
  'event.cancel':          { en: 'Cancel',             bg: 'Откажи'                         },
  'event.signInForRole':   { en: 'Sign in to request a role.', bg: 'Влезте, за да заявите роля.' },
  'event.notePlaceholder': { en: 'Note (optional)…',   bg: 'Бележка (по желание)…'          },

  // join page
  'event.join.brandName':          { en: 'TeamEnjoyVD',                                              bg: 'TeamEnjoyVD'                                                    },
  'event.join.linkExpired':        { en: 'This link has expired.',                                   bg: 'Тази връзка е изтекла.'                                         },
  'event.join.linkInvalid':        { en: 'This link is invalid.',                                    bg: 'Тази връзка е невалидна.'                                       },
  'event.join.registerAgainDesc':  { en: 'Please register again to receive a fresh access link.',    bg: 'Моля, регистрирайте се отново, за да получите нова връзка.'      },
  'event.join.registerAgain':      { en: 'Register again',                                           bg: 'Регистрирайте се отново'                                        },
  'event.join.youreJoining':       { en: "You're joining",                                          bg: 'Присъединявате се към'                                          },
  'event.join.hiClick':            { en: 'Hi {name}, click the button below to open the meeting.',   bg: 'Здравейте {name}, натиснете бутона, за да отворите срещата.'      },
  'event.join.hiTap':              { en: 'Hi {name}, tap the button below to open the meeting.',     bg: 'Здравейте {name}, докоснете бутона, за да отворите срещата.'     },
  'event.join.joinMeeting':        { en: 'Join Meeting',                                             bg: 'Присъединете се'                                                },
  'event.join.noMeetingLink':      { en: 'Meeting link not yet available. Check back closer to the event.', bg: 'Връзката към срещата все още не е налична. Проверете по-близо до събитието.' },

  // join/components/JoinActions
  'event.join.copyLinkHint':       { en: "If the button above doesn't open, copy this link directly:", bg: 'Ако бутонът не работи, копирайте тази връзка директно:'         },
  'event.join.addToCalendar':      { en: 'Add to calendar',                                          bg: 'Добави в календар'                                              },
  'event.join.googleCalendar':     { en: 'Google Calendar',                                          bg: 'Google Calendar'                                                },
  'event.join.outlook':            { en: 'Outlook',                                                  bg: 'Outlook'                                                        },
  'event.join.downloadIcs':        { en: 'Download .ics (Apple Calendar & others)',                  bg: 'Изтегли .ics (Apple Calendar и др.)'                            },

  // register page
  'event.register.registerToGet':  { en: 'Register to get your access link',                         bg: 'Регистрирайте се за достъп'                                     },

  // register/components/RegisterForm
  'event.register.checkInbox':     { en: 'Check your inbox',                                         bg: 'Проверете пощата си'                                            },
  'event.register.sentLink':       { en: "We've sent your access link. The link expires in 72 hours.", bg: 'Изпратихме ви връзка за достъп. Тя е валидна 72 часа.'          },
  'event.register.fullName':       { en: 'Full Name',                                                bg: 'Пълно име'                                                      },
  'event.register.yourName':       { en: 'Your name',                                                bg: 'Вашето име'                                                     },
  'event.register.emailAddress':   { en: 'Email Address',                                            bg: 'Имейл адрес'                                                    },
  'event.register.emailPlaceholder': { en: 'you@example.com',                                        bg: 'you@example.com'                                                },
  'event.register.sendingLink':    { en: 'Sending link…',                                            bg: 'Изпращане…'                                                     },
  'event.register.getAccessLink':  { en: 'Get access link',                                          bg: 'Получете връзка за достъп'                                      },
  'event.register.noAccountDesc':  { en: 'No account needed.',                                       bg: 'Не е нужен акаунт.'                                             },
  'event.register.emailDesc':      { en: "We'll email you a personal link to join",                  bg: 'Ще ви изпратим личен линк за присъединяване към'                },
} as const
