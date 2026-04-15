export const admin = {
  'admin.nav.portal': { en: 'Portal', bg: 'Портал' },
  'admin.nav.openMenu': { en: 'Open admin navigation', bg: 'Отвори навигацията' },

  // -- Members Tab --
  'admin.members.table.name': { en: 'Name', bg: 'Име' },
  'admin.members.table.abo': { en: 'ABO', bg: 'СБА' },
  'admin.members.table.sponsorAbo': { en: 'Sponsor ABO', bg: 'Номер на Спонсор' },
  'admin.members.table.level': { en: 'Level', bg: 'Ниво' },
  'admin.members.table.gpv': { en: 'GPV', bg: 'ГТС' },
  'admin.members.table.bonus': { en: 'Bonus%', bg: 'Бонус%' },
  'admin.members.table.group': { en: 'Group', bg: 'Група' },
  
  'admin.members.btn.toCore': { en: '→ Core', bg: '→ Основен костяк' },
  'admin.members.btn.toMember': { en: '→ Member', bg: '→ Член' },
  'admin.members.noLosData': { en: 'No LOS data. Import a CSV in Data Center.', bg: 'Няма данни за LOS. Импортирайте CSV в Център за данни.' },
  'admin.members.searchPlaceholder': { en: 'Search name or ABO…', bg: 'Търсене на име или СБА…' },
  'admin.members.btn.columns': { en: 'Columns', bg: 'Колони' },
  'admin.members.pageInfo': { en: 'Page {{current}} of {{total}}', bg: 'Страница {{current}} от {{total}}' },
  'admin.members.btn.prev': { en: 'Prev', bg: 'Предишна' },
  'admin.members.btn.next': { en: 'Next', bg: 'Следваща' },
  
  'admin.members.summary.losLinked': { en: '{{total}} in LOS · {{linked}} linked to portal accounts', bg: '{{total}} в LOS · {{linked}} свързани акаунти' },
  'admin.members.pendingVerification': { en: 'Pending verification', bg: 'Чакaщи потвърждение' },
  
  'admin.members.verify.claimsAbo': { en: 'Claims ABO', bg: 'Заявява СБА' },
  'admin.members.verify.upline': { en: 'upline', bg: 'горна линия' },
  'admin.members.verify.los': { en: 'LOS:', bg: 'LOS:' },
  'admin.members.verify.sponsorInLos': { en: 'sponsor in LOS:', bg: 'спонсор в LOS:' },
  'admin.members.verify.losMatch': { en: '✓ LOS match', bg: '✓ LOS съвпадение' },
  'admin.members.verify.uplineMismatch': { en: '⚠ upline mismatch', bg: '⚠ несъвпадение на горна линия' },
  'admin.members.verify.noAboInLos': { en: '✗ ABO not in LOS', bg: '✗ СБА не е в LOS' },
  
  'admin.members.verify.btn.approve': { en: 'Approve', bg: 'Одобри' },
  'admin.members.verify.btn.deny': { en: 'Deny', bg: 'Откажи' },
  'admin.members.verify.reasonPlaceholder': { en: 'Reason (optional)', bg: 'Причина (опционално)' },
  'admin.members.verify.btn.confirm': { en: 'Confirm', bg: 'Потвърди' },
  
  'admin.members.guestsNoAbo': { en: 'Guests — no ABO submitted ({{count}})', bg: 'Гости — без подаден СБА ({{count}})' },
  'admin.members.guestJoined': { en: 'Joined', bg: 'Присъединен' },
  'admin.members.guestRole': { en: 'guest', bg: 'гост' },
  'admin.members.losMapDesc': { en: 'LOS map — {{count}} members', bg: 'LOS карта — {{count}} членове' },

  // -- Data Center Tab --
  'admin.data.title': { en: 'LOS CSV import — upserts on ABO number. Rebuilds LTree paths after every import.', bg: 'LOS CSV импорт — обновява по СБА. Преизгражда LTree пътищата след всеки импорт.' },
  'admin.data.clickToSelect': { en: 'Click to select a CSV file', bg: 'Кликнете за избор на CSV файл' },
  'admin.data.csvOnly': { en: '.csv only', bg: 'само .csv' },
  'admin.data.rowsDetected': { en: '{{count}} rows detected', bg: '{{count}} открити реда' },
  'admin.data.previewTitle': { en: 'Preview (first 5 rows)', bg: 'Преглед (първи 5 реда)' },
  'admin.data.btn.runImport': { en: 'Run Import', bg: 'Стартирай импорт' },
  'admin.data.btn.importing': { en: 'Importing...', bg: 'Импортиране...' },
  
  'admin.data.result.complete': { en: 'Import complete — {{count}} rows upserted', bg: 'Импортът завърши — добавени/обновени {{count}} реда' },
  'admin.data.result.new': { en: '{{count}} new', bg: '{{count}} нови' },
  'admin.data.result.levelChanges': { en: '{{count}} level changes', bg: '{{count}} промени в нивото' },
  'admin.data.result.bonusChanges': { en: '{{count}} bonus changes', bg: '{{count}} промени в бонуса' },
  'admin.data.result.errors': { en: '{{count}} errors', bg: '{{count}} грешки' },
  'admin.data.result.newMembersTitle': { en: 'New members', bg: 'Нови членове' },
  'admin.data.result.rowErrorsTitle': { en: '{{count}} row errors — check for unsanitized data:', bg: '{{count}} грешки в редове — проверете за невалидни данни:' },
  'admin.data.result.levelChangesTitle': { en: 'Level changes', bg: 'Промени в нивото' },
  'admin.data.result.bonusChangesTitle': { en: 'Bonus % changes', bg: 'Промени в % бонус' },
  
  'admin.data.reconciliation.title': { en: 'Reconciliation', bg: 'Свързване' },
  'admin.data.reconciliation.desc': { en: 'Match unrecognized LOS members to manually-verified portal profiles.', bg: 'Свържете неразпознати LOS членове с ръчно верифицирани портал-профили.' },
  'admin.data.reconciliation.btn.link': { en: 'Link', bg: 'Свържи' },
  'admin.data.reconciliation.btn.linking': { en: 'Linking...', bg: 'Свързване...' },
  'admin.data.reconciliation.unrecognizedTitle': { en: 'Unrecognized in LOS — {{count}}', bg: 'Неразпознати в LOS — {{count}}' },
  'admin.data.reconciliation.allMatched': { en: 'All LOS members matched.', bg: 'Всички LOS членове са свързани.' },
  'admin.data.reconciliation.noAboTitle': { en: 'No ABO — awaiting position — {{count}}', bg: 'Без СБА — очаква позиция — {{count}}' },
  'admin.data.reconciliation.noManualMembers': { en: 'No manually-verified members without ABO.', bg: 'Няма ръчно верифицирани членове без СБА.' },
  'admin.data.reconciliation.sponsor': { en: 'Sponsor', bg: 'Спонсор' },
  'admin.data.reconciliation.upline': { en: 'Upline', bg: 'Горна линия' },

  // -- LOS Tab --
  'admin.los.treeDesc': { en: 'Full org tree with vital signs. Click a checkbox to toggle.', bg: 'Пълно организационно дърво с жизнени показатели. Кликнете, за да превключите.' },
  'admin.los.memberCount': { en: '{{count}} members', bg: '{{count}} членове' },
  'admin.los.vitalSigns': { en: 'Vital Signs', bg: 'Жизнени показатели' },
  'admin.los.btn.active': { en: 'Active', bg: 'Активен' },
  'admin.los.btn.inactive': { en: 'Inactive', bg: 'Неактивен' },
  'admin.los.noAccountTooltip': { en: 'No portal account — cannot track vital signs', bg: 'Няма портал-акаунт — не могат да се проследят показатели' },
  'admin.los.noData': { en: 'No LOS data yet.', bg: 'Все още няма LOS данни.' },

  // -- Approval Hub --
  'admin.approval.verify.standardTitle': { en: 'Standard ABO requests — {{count}}', bg: 'Стандартни СБА заявки — {{count}}' },
  'admin.approval.verify.noStandard': { en: 'No pending standard requests.', bg: 'Няма чакащи стандартни заявки.' },
  'admin.approval.verify.manualTitle': { en: 'Manual requests — {{count}}', bg: 'Ръчни заявки — {{count}}' },
  'admin.approval.verify.noManual': { en: 'No pending manual requests.', bg: 'Няма чакащи ръчни заявки.' },
  
  'admin.approval.verify.noAboBadge': { en: 'No ABO', bg: 'Без СБА' },
  'admin.approval.verify.awaitingPosTitle': { en: 'Awaiting LOS positioning — {{count}}', bg: 'Очаква позициониране в LOS — {{count}}' },
  'admin.approval.verify.approvedBadge': { en: 'approved', bg: 'одобрен' },
  
  'admin.approval.verify.directTitle': { en: 'Direct verify', bg: 'Директна верификация' },
  'admin.approval.verify.directDesc': { en: 'Directly promote a guest to member without a prior submission.', bg: 'Пряко повишаване на гост до член без предварителна заявка.' },
  'admin.approval.verify.lbl.guest': { en: 'Guest', bg: 'Гост' },
  'admin.approval.verify.lbl.uplineAbo': { en: 'Upline ABO number', bg: 'СБА номер на горна линия' },
  'admin.approval.verify.opt.selectGuest': { en: 'Select a guest…', bg: 'Избери гост…' },
  'admin.approval.verify.placeholder.upline': { en: 'e.g. 7010970187', bg: 'напр. 7010970187' },
  'admin.approval.verify.btn.approve': { en: 'Approve', bg: 'Одобри' },
  'admin.approval.verify.btn.deny': { en: 'Deny', bg: 'Откажи' },
  'admin.approval.verify.btn.verifyMember': { en: 'Verify member', bg: 'Верифицирай член' },
  'admin.approval.verify.btn.verifying': { en: 'Verifying…', bg: 'Верифициране…' },
  'admin.approval.verify.btn.verified': { en: 'Verified ✓', bg: 'Верифициран ✓' },
  'admin.approval.verify.noGuests': { en: 'No guests without a pending request.', bg: 'Няма гости без чакаща заявка.' },

  'admin.approval.trips.resolvedCollapsible': { en: 'Resolved — {{count}}', bg: 'Разрешени — {{count}}' },
  'admin.approval.trips.btn.allTrips': { en: 'All trips', bg: 'Всички пътувания' },
  'admin.approval.trips.pendingTitle': { en: 'Pending — {{count}}', bg: 'Чакащи — {{count}}' },
  'admin.approval.trips.noPending': { en: 'No pending registrations.', bg: 'Няма чакащи регистрации.' },

  'admin.approval.events.btn.allEvents': { en: 'All events', bg: 'Всички събития' },
  'admin.approval.events.noPending': { en: 'No pending role requests.', bg: 'Няма чакащи заявки за роли.' },

} as const
