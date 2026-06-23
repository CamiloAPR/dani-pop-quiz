# Testing Checklist

Manual test guide for the app's IndexedDB persistence, daily progress behavior, and attempt logging.

## Scope

This checklist focuses on:

- Daily progress stored in IndexedDB through Dexie
- One-time legacy migration from `sessionStorage` / `localStorage`
- Per-challenge and per-answer logging
- Day rollover behavior without a full reload
- Basic regressions in the quiz flow

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Start the app:

```bash
pnpm dev
```

3. Open the app in a browser and keep DevTools available.

## Useful Reset Steps

Use these when you want a clean state before a scenario:

1. In DevTools, open `Application` (or browser equivalent).
2. Delete IndexedDB database `dani-pop-quiz`.
3. Clear these storage keys if they exist:
   - `localStorage.tableProgress`
   - `sessionStorage.tableProgress`
   - `localStorage.completedTables`
   - `sessionStorage.completedTables`
   - `localStorage.dexieMigrationDone`
4. Reload the page.

## Expected IndexedDB Stores

After the app initializes successfully, the `dani-pop-quiz` IndexedDB database should contain:

- `days`
- `tableProgress`
- `challengeAttempts`
- `answerAttempts`

## Core Scenarios

### 1. Initial load creates today's dataset

Steps:

1. Start from a clean state.
2. Load the app.

Expected:

- A `days` row exists for today's local `YYYY-MM-DD` date.
- No stars or trophies are visible yet.
- The app does not show a persistence error message.

### 2. First success unlocks a star for today

Steps:

1. Start from a clean state.
2. Complete one full challenge successfully for any table.
3. Return to the intro screen if needed.

Expected:

- The selected table shows a star.
- `tableProgress` has one row for today's `dateKey` and the selected `table`.
- That row has:
  - `completions: 1`
  - `streak: 1`
  - `starUnlocked: true`
  - `trophyUnlocked: false`

### 3. Second consecutive success unlocks a trophy

Steps:

1. Using the same table and same day, complete a second successful challenge in a row.

Expected:

- The selected table shows a trophy instead of only a star.
- `tableProgress` for that table has:
  - `completions: 2`
  - `streak: 2`
  - `starUnlocked: true`
  - `trophyUnlocked: true`

### 4. Failure resets only the streak

Steps:

1. First earn at least a star on a table.
2. Start another challenge on that same table.
3. Fail by timeout or reset.

Expected:

- The existing star or trophy remains visible.
- `tableProgress.streak` becomes `0`.
- `completions`, `starUnlocked`, and `trophyUnlocked` remain unchanged.

### 5. Wrong answer is logged and the question stays active

Steps:

1. Start a challenge.
2. Submit a wrong answer for the current multiplication.

Expected in UI:

- The challenge stays on the same multiplication.
- The answer field clears.
- A retry message appears.

Expected in `answerAttempts`:

- A new row exists with:
  - `outcome: 'incorrect'`
  - `failureType: 'wrong_answer'`
  - correct `table`
  - correct `multiplier`
  - correct `expectedAnswer`
  - the submitted wrong value in `submittedAnswer`
  - non-negative `durationMs`
  - non-negative `questionElapsedMs`

### 6. Correct answer is logged and timing resets for the next question

Steps:

1. Start a challenge.
2. Submit a correct answer.

Expected:

- A new `answerAttempts` row exists with `outcome: 'correct'`.
- The challenge advances to the next multiplication.
- The next question uses fresh answer timing.
- `questionElapsedMs` for the correct row reflects time spent on the completed question.

### 7. Timeout records a terminal failure

Steps:

1. Start a challenge.
2. Let time run out while a question is active.

Expected in UI:

- The app shows the timeout state.

Expected in data:

- `challengeAttempts.status` becomes `timeout`.
- A terminal `answerAttempts` row exists for the active question with:
  - `outcome: 'terminal_failure'`
  - `failureType: 'timeout_final'`
  - `submittedAnswer: null`

### 8. Reset during a running challenge records a terminal failure

Steps:

1. Start a challenge.
2. While it is running, click `Reiniciar reto`.

Expected:

- The current attempt is closed before the next one starts.
- A terminal `answerAttempts` row exists for the active question with:
  - `outcome: 'terminal_failure'`
  - `failureType: 'reset_final'`
  - `submittedAnswer: null`
- The previous `challengeAttempts` row ends with `status: 'reset'`.
- A new `challengeAttempts` row starts for the restarted run.

### 9. Changing table during a running challenge records a reset

Steps:

1. Start a challenge.
2. Click `Cambiar tabla` while it is running.

Expected:

- The app returns to the intro screen.
- The running attempt is closed with `status: 'reset'`.
- A terminal `answerAttempts` row exists with `failureType: 'reset_final'`.

### 10. Reload preserves today's visible progress

Steps:

1. Earn a star or trophy.
2. Reload the page.

Expected:

- The same star or trophy is still visible for today.
- The app reads the state from IndexedDB, not from transient storage.

## Legacy Migration Scenarios

### 11. `tableProgress` migrates once from session or local storage

Steps:

1. Clear IndexedDB and the migration flag.
2. Before reloading, create legacy data in DevTools, for example:

```js
localStorage.setItem(
  'tableProgress',
  JSON.stringify({
    7: { completions: 1, streak: 1, trophyUnlocked: false }
  })
)
```

3. Reload the app.

Expected:

- Today's `tableProgress` in IndexedDB contains the migrated row.
- The table shows a star.
- `localStorage.dexieMigrationDone` is set.
- Old legacy keys are removed only after migration succeeds.

### 12. Legacy `completedTables` migrates to star progress

Steps:

1. Clear IndexedDB and the migration flag.
2. Before reloading, set:

```js
sessionStorage.setItem('completedTables', JSON.stringify([3, 7]))
```

3. Reload the app.

Expected:

- Tables `3` and `7` appear completed for today.
- Each migrated row has at least:
  - `completions: 1`
  - `streak: 1`
  - `starUnlocked: true`

### 13. Migration does not duplicate on later reloads

Steps:

1. Perform a successful legacy migration.
2. Reload the page again without changing storage manually.

Expected:

- `tableProgress` does not double-count completions.
- No duplicate import behavior happens on subsequent reloads.

## Daily Dataset Scenarios

### 14. A new local day shows a fresh dataset

Steps:

1. Have visible progress for one day.
2. Move the browser into the next local day.
   - Preferred real-world check: keep the tab open until the next day.
   - Faster manual check: temporarily change the system date/time carefully, then restore it after the test.
3. Bring the tab back into focus or wait up to one minute.

Expected:

- The intro screen refreshes to the new day without a full reload.
- Visible stars and trophies reset for the new day.
- Older rows remain in IndexedDB for the prior `dateKey`.
- A new `days` row exists for the new date.

### 15. Day rollover should not interrupt a running challenge

Steps:

1. Start a challenge shortly before a local day change, or simulate the day change while the challenge is running.
2. Finish or exit the challenge.

Expected:

- The running attempt continues using the date context it started with.
- The visible day refresh happens when the app returns to the intro screen, not mid-challenge.

## Failure Handling Scenarios

### 16. Challenge start fails closed if required logging cannot start

Purpose:

- Per-attempt logging is mandatory, so the app should not allow a challenge to run if `challengeAttempts` cannot be created.

Suggested approach:

1. Simulate an IndexedDB failure in the browser environment if possible.
2. Try to start a challenge.

Expected:

- The challenge does not begin.
- The app shows an error message instead of running without persistence.
- No partial in-memory-only run is allowed.

### 17. Answer logging failure stops the active run

Purpose:

- Per-answer logging is mandatory, so the app should not keep running if an answer record cannot be written.

Suggested approach:

1. Start a challenge.
2. Simulate an IndexedDB failure before submitting an answer.
3. Submit an answer.

Expected:

- The app stops the run safely.
- The user sees an error message.
- The app does not continue with unlogged answer state.

## Data Inspection Checklist

When inspecting data in DevTools, verify these shapes:

### `days`

- `dateKey`
- `createdAt`
- `updatedAt`

### `tableProgress`

- `dateKey`
- `table`
- `completions`
- `streak`
- `starUnlocked`
- `trophyUnlocked`
- `updatedAt`

### `challengeAttempts`

- `id`
- `dateKey`
- `table`
- `questionOrder`
- `status`
- `startedAt`
- `endedAt`
- `maxTimeMs`
- `completedCount`

### `answerAttempts`

- `id`
- `attemptId`
- `dateKey`
- `table`
- `multiplier`
- `questionIndex`
- `expectedAnswer`
- `submittedAnswer`
- `outcome`
- `failureType`
- `attemptStartedAt`
- `answeredAt`
- `durationMs`
- `questionElapsedMs`

## Regression Checks

Run these after any persistence or quiz-flow change:

1. `pnpm build` succeeds.
2. The intro screen still loads normally.
3. The numpad, keyboard input, and `Enter` submission still work.
4. Confetti still appears on success.
5. Wrong answers still keep the same multiplication active.
6. Timeout and reset still show the expected Spanish copy.
7. Stars and trophies still render correctly on the table buttons.
8. If the stats screen is present, it still loads after completing some attempts and reflects the persisted data.

## Notes

- Prefer testing with DevTools open so IndexedDB rows can be checked immediately after each action.
- For migration scenarios, always clear the IndexedDB database and `dexieMigrationDone` first.
- For date rollover scenarios, restore the system date/time after the test if you changed it manually.
