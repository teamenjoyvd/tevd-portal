# TEST_READY.md

## Test Execution Command
To run the complete E2E test suite, execute the following command from the project root:

```bash
node scripts/run-e2e-tests.js
```

### Options
- `--mock`: Forces the test suite to run in Mock Simulator Mode. By default, if the database tables `notification_queue`, `member_notifications`, etc. do not exist, the test runner will automatically fall back to Mock Mode.

---

## Test Coverage Breakdown

The E2E test suite contains exactly **71 test cases** distributed across the 4-tier test case design methodology:

| Tier | Category | Description | Count |
|---|---|---|---|
| **Tier 1** | Feature Coverage | Happy path functional testing for all 6 features (5 cases per feature) | 30 |
| **Tier 2** | Boundary & Corner Cases | Boundary, invalid inputs, error handling, and RLS validation (5 cases per feature) | 30 |
| **Tier 3** | Cross-Feature Combinations | Pairwise and integration flows between multiple features | 6 |
| **Tier 4** | Real-World Application Scenarios | End-to-end user lifecycles and recovery workflows | 5 |
| **Total** | | | **71** |

### Feature Matrix Coverage Breakdown
- **Feature 1: Queue-based notification enqueue/claim**: 10 cases (`T1_F1_01`-`T1_F1_05`, `T2_F1_01`-`T2_F1_05`)
- **Feature 2: Renamed member_notifications in-app feed**: 10 cases (`T1_F2_01`-`T1_F2_05`, `T2_F2_01`-`T2_F2_05`)
- **Feature 3: Guest reminder triggers**: 10 cases (`T1_F3_01`-`T1_F3_05`, `T2_F3_01`-`T2_F3_05`)
- **Feature 4: Edge functions delivery with retry/logging**: 10 cases (`T1_F4_01`-`T1_F4_05`, `T2_F4_01`-`T2_F4_05`)
- **Feature 5: Document expiry cron & dedup**: 10 cases (`T1_F5_01`-`T1_F5_05`, `T2_F5_01`-`T2_F5_05`)
- **Feature 6: Admin panel configurations & server actions**: 10 cases (`T1_F6_01`-`T1_F6_05`, `T2_F6_01`-`T2_F6_05`)
- **Cross-Feature Integrations**: 6 cases (`T3_01`-`T3_06`)
- **Real-World Lifecycles**: 5 cases (`T4_01`-`T4_05`)

---

## Feature Checklist
- [x] Feature 1: Queue-based notification enqueue/claim
- [x] Feature 2: Renamed member_notifications in-app feed
- [x] Feature 3: Guest reminder triggers
- [x] Feature 4: Edge functions delivery with retry/logging
- [x] Feature 5: Document expiry cron & dedup
- [x] Feature 6: Admin panel configurations & server actions
