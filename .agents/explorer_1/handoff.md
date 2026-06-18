# Roles Page Controls Simplification — Exploration Report

## 1. Observation

During read-only investigation, the following files and code blocks were examined:

### A. `app/(dashboard)/roles/page.tsx`
- **Line 16-22**: Defines search parameters type:
  ```typescript
  searchParams: Promise<{
    tab?: string
    quarter?: string
    year?: string
    page?: string
    search?: string
  }>
  ```
- **Line 40-49**: Awaits and parses parameters:
  ```typescript
  const params = await searchParams
  const tab = params.tab || 'quarter'
  ...
  const year = parseInt(params.year || '') || currentYear
  const quarter = parseInt(params.quarter || '') || currentQuarter
  const page = parseInt(params.page || '') || 1
  const search = params.search || ''
  ```
- **Line 51-62**: Conditionally queries database based on the active tab:
  ```typescript
  if (tab === 'quarter') {
    quarterEvents = await getQuarterEvents(supabase, year, quarter)
  } else if (tab === 'history') {
    historyData = await getHistoryEvents(supabase, page, HISTORY_LIMIT, search)
  } else if (tab === 'leaderboard') {
    leaderboardData = await getLeaderboard(supabase)
  }
  ```

### B. `app/(dashboard)/roles/components/RolesClient.tsx`
- **Line 18**: Imports `HistoryPanel`:
  ```typescript
  import HistoryPanel from './HistoryPanel'
  ```
- **Line 223**: Year options generation is currently hardcoded:
  ```typescript
  // Generate Year options from currentYear - 2 to currentYear + 2
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  ```
- **Line 225-236**: `handleTabChange` resets year and quarter parameters on toggle:
  ```typescript
  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    // Clear other params when changing primary view tabs
    params.delete('page')
    params.delete('search')
    params.delete('quarter')
    params.delete('year')
    startTransition(() => {
      router.replace(`/roles?${params.toString()}`, { scroll: false })
    })
  }
  ```
- **Line 276-282**: Primary view selectors:
  ```tsx
  <Tabs value={tab} onValueChange={handleTabChange}>
    <TabsList>
      <TabsTrigger value="quarter">{t('event.roles.view.quarter')}</TabsTrigger>
      <TabsTrigger value="history">{t('event.roles.view.history')}</TabsTrigger>
      <TabsTrigger value="leaderboard">{t('event.roles.view.leaderboard')}</TabsTrigger>
    </TabsList>
  </Tabs>
  ```
- **Line 290-314**: Inner quarter filters toolbar under Quarterly tab content:
  ```tsx
  <div className="flex flex-wrap items-center gap-4 py-2 border-b pb-4 mb-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
    <div className="w-32">
      <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
        {/* ... */}
      </Select>
    </div>
    <Tabs value={`Q${selectedQuarter}`} onValueChange={handleQuarterChange}>
      {/* Q1-Q4 tabs */}
    </Tabs>
  </div>
  ```

### C. `app/(dashboard)/roles/components/HistoryPanel.tsx`
- A client-side component containing search input and pagination buttons. It uses translations:
  - `event.roles.search.placeholder` (Line 86)
  - `event.roles.search.button` (Line 100)
  - `event.roles.loading` (Line 107)
  - `event.roles.history.empty` (Line 113)
  - `event.roles.history.prev` (Line 248)
  - `event.roles.history.next` (Line 260)

### D. `lib/roles/queries.ts`
- **Line 38-75**: Implements `getHistoryEvents` using pagination (`range`) and `ilike` filters on `v_roles_history`.

### E. `lib/i18n/domains/events.ts`
- Contains translation keys starting with `event.`.
- Multiple keys are defined but unused in the rest of the application (e.g., `event.rolesPageTitle`, `event.requestRole`, `event.submit`, `event.submitting`, `event.cancel`, `event.signInForRole`, `event.notePlaceholder`).

---

## 2. Logic Chain

1. **Orphaned Translation Keys**:
   - Currently, several translation keys in `events.ts` are never queried in code. For instance, grep searches for `event.rolesPageTitle`, `event.requestRole`, `event.submit`, `event.submitting`, `event.cancel`, `event.signInForRole`, and `event.notePlaceholder` returned zero matches outside of `events.ts`.
   - When `HistoryPanel.tsx` is deleted and the history tab is removed from `RolesClient.tsx`, all history-related translations (`event.roles.view.history`, `event.roles.search.placeholder`, `event.roles.search.button`, `event.roles.history.empty`, `event.roles.loading`, `event.roles.history.prev`, `event.roles.history.next`) will also become orphaned.
   - Removing all 14 unused keys simplifies the i18n domain and removes dead translations.

2. **Legacy Parameter Mapping**:
   - In Next.js 15, `RolesPage` parses parameters in the Server Component. If `tab=history` is requested, since this tab is deleted, it should default to the `'quarter'` tab. `tab=leaderboard` should map directly to `'leaderboard'`.

3. **State/Parameter Preservation on Toggle**:
   - `handleTabChange` explicitly deletes `quarter` and `year` query parameters (lines 231-232). By preventing this deletion, the URL will retain `year=YYYY` and `quarter=Q` parameters when switching to the Leaderboard tab and back, ensuring state is preserved.

4. **Dynamic Year Filtering**:
   - The year options list is currently hardcoded to `[currentYear - 2, ..., currentYear + 2]`.
   - The `v_roles_history` view contains the `start_time` field for events.
   - We can fetch all event `start_time` values via a database query, map them to years using JS (`Date.getUTCFullYear()`), and deduplicate using a `Set` to provide a dynamically generated list of year options.

5. **Single-Row Layout**:
   - Instead of two stacked levels of controls (header toolbar + inner tab toolbar), we can consolidate the controls into a single row on desktop, wrapping on mobile, using unified CSS variables for theme stability.

---

## 3. Caveats

- **Database View Constraints**: The solution assumes `v_roles_history` is a fast view. If there are thousands of events, fetching all start times without pagination might become slow, although for typical organizational portals, the event count is small enough that JS deduplication is highly performant. A fallback array to `[currentYear]` is assumed if the database query fails or returns empty.
- **No Direct Modification**: As a read-only investigator, no files were created or modified in the src tree.

---

## 4. Conclusion

The codebase contains an opportunity to streamline the Roles page controls and clean up deprecated features. 14 orphaned translation keys can be cleaned up, `HistoryPanel.tsx` can be completely deleted, the year selector can query start times dynamically from `v_roles_history`, and URL parameters can be preserved.

Here is the proposed strategy for the implementer:

### R1. Single-row Layout
Merge selectors and tabs on the top bar in `RolesClient.tsx` into a single flex container:
```tsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
  {/* View Tabs Selector */}
  <Tabs value={tab} onValueChange={handleTabChange}>
    <TabsList>
      <TabsTrigger value="quarter">{t('event.roles.view.quarter')}</TabsTrigger>
      <TabsTrigger value="leaderboard">{t('event.roles.view.leaderboard')}</TabsTrigger>
    </TabsList>
  </Tabs>

  {/* Year & Quarter Selector Toolbar (only visible for quarter view) */}
  {tab === 'quarter' && (
    <div className="flex items-center gap-3">
      <div className="w-28">
        <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
          <SelectTrigger>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={`Q${selectedQuarter}`} onValueChange={handleQuarterChange}>
        <TabsList>
          <TabsTrigger value="Q1">Q1</TabsTrigger>
          <TabsTrigger value="Q2">Q2</TabsTrigger>
          <TabsTrigger value="Q3">Q3</TabsTrigger>
          <TabsTrigger value="Q4">Q4</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )}
</div>
```

### R2. State/Parameter Preservation
Modify `handleTabChange` in `RolesClient.tsx` to retain query parameters:
```typescript
function handleTabChange(value: string) {
  const params = new URLSearchParams(searchParams.toString())
  params.set('tab', value)
  // Delete history pagination/search parameters
  params.delete('page')
  params.delete('search')
  // DO NOT delete 'year' and 'quarter' to preserve state!
  startTransition(() => {
    router.replace(`/roles?${params.toString()}`, { scroll: false })
  })
}
```

### R3. Deletion and Translation Cleanup
1. Delete `app/(dashboard)/roles/components/HistoryPanel.tsx`.
2. Delete `getHistoryEvents` in `lib/roles/queries.ts`.
3. Map legacy parameters in `app/(dashboard)/roles/page.tsx`:
   ```typescript
   const params = await searchParams
   const rawTab = params.tab || 'quarter'
   const tab = rawTab === 'history' ? 'quarter' : rawTab
   ```
4. Remove the following 14 keys in `lib/i18n/domains/events.ts`:
   - `event.rolesPageTitle`
   - `event.requestRole`
   - `event.submit`
   - `event.submitting`
   - `event.cancel`
   - `event.signInForRole`
   - `event.notePlaceholder`
   - `event.roles.view.history`
   - `event.roles.search.placeholder`
   - `event.roles.search.button`
   - `event.roles.history.empty`
   - `event.roles.loading`
   - `event.roles.history.prev`
   - `event.roles.history.next`

### R4. Dynamic Year Filtering
1. Add a query helper in `lib/roles/queries.ts`:
   ```typescript
   export async function getEventYears(
     supabase: SupabaseClient<Database>
   ): Promise<number[]> {
     const { data, error } = await supabase
       .from('v_roles_history')
       .select('start_time')

     if (error || !data) return []

     const years = data
       .map(row => row.start_time ? new Date(row.start_time).getUTCFullYear() : null)
       .filter((year): year is number => year !== null)

     return Array.from(new Set(years)).sort((a, b) => b - a)
   }
   ```
2. Call it in `app/(dashboard)/roles/page.tsx` and pass `yearOptions` as a prop:
   ```typescript
   const dbYears = await getEventYears(supabase)
   const yearOptions = dbYears.length > 0 ? dbYears : [currentYear]
   ```

---

## 5. Verification Method

To verify these changes after implementation:
1. **Compilation Check**: Run the project build command:
   ```powershell
   npm run build
   ```
   Ensure no TypeScript compilation errors occur.
2. **Page Rendering**: Visit `/roles` and toggle between the "Quarterly" and "Leaderboard" tabs. Confirm the parameters `year` and `quarter` remain in the URL, and that when returning to the "Quarterly" tab, the selected quarter/year are correctly restored.
3. **Legacy Tab Test**: Manually navigate to `/roles?tab=history` and confirm the application maps the request to the default Quarterly tab (`tab=quarter`) without throwing an error.
4. **Year Dropdown Check**: Check the year dropdown. It should display exactly the years extracted from existing events in the database (ordered descending).
5. **History Deletion Verification**: Verify that `app/(dashboard)/roles/components/HistoryPanel.tsx` has been deleted and no imports remain in `RolesClient.tsx`.
