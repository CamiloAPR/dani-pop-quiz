# Arithmetic Implementation Plan

Technical plan for adding addition and subtraction challenge modes on top of the current multiplication quiz architecture.

## Objective

Add arithmetic challenge modes without breaking the existing `Tablas` experience:

- `Solo sumas`
- `Solo restas`
- `Mixto (+ / -)`

The implementation should preserve the current strengths of the app:

- simple challenge lifecycle
- detailed per-answer persistence
- day-based progress tracking
- stats and family-facing reporting

## Current Architecture Summary

The current app already has a solid challenge loop:

- [src/App.svelte](/Users/camilopr/weeellp/dani-pop-quiz/src/App.svelte) owns the quiz state, screen flow, timer, answer submission, and challenge lifecycle.
- [src/lib/db.js](/Users/camilopr/weeellp/dani-pop-quiz/src/lib/db.js) persists daily progress, challenge attempts, and answer attempts in IndexedDB via Dexie.
- [src/lib/stats.js](/Users/camilopr/weeellp/dani-pop-quiz/src/lib/stats.js) computes summary stats from the persisted data.

That means we do not need a new system. We need to generalize the current one.

## Recommended Delivery Order

### Milestone 1

Generalize the data model and challenge engine so the app can support more than multiplication.

### Milestone 2

Ship `Solo sumas` with 3 levels and controlled randomness.

### Milestone 3

Add arithmetic-aware stats and level recommendations.

### Milestone 4

Ship `Solo restas`.

### Milestone 5

Ship `Mixto (+ / -)`.

## Key Design Choice

The cleanest approach is to move from a multiplication-specific model to a generic challenge-question model.

Today the app assumes:

- one selected multiplication table
- one multiplier per question
- expected answer equals `table * multiplier`

Arithmetic modes need a broader question structure:

- operation type
- two operands
- optional family tag
- optional difficulty metadata

## Data Model Changes

## 1. Challenge Attempts

Current `challengeAttempts` rows are table-centric.

Recommended new fields:

- `mode`
- `skill`
- `difficultyLevel`
- `challengeSeed`
- `questionCount`
- `recommendedLevel`

Suggested meaning:

- `mode`: `tables`, `solo_add`, `solo_subtract`, `mixed`
- `skill`: broad domain like `multiplication` or `arithmetic`
- `difficultyLevel`: `null` for tables, `1 | 2 | 3` for arithmetic
- `challengeSeed`: optional value for deterministic regeneration or debugging
- `questionCount`: number of generated questions
- `recommendedLevel`: level suggested by the app at challenge start

Keep existing fields:

- `dateKey`
- `status`
- `startedAt`
- `endedAt`
- `completedCount`
- `maxTimeMs`

## 2. Answer Attempts

Current `answerAttempts` rows are multiplication-specific because they rely on:

- `table`
- `multiplier`
- `expectedAnswer`

Recommended new fields:

- `mode`
- `skill`
- `difficultyLevel`
- `operation`
- `operandA`
- `operandB`
- `family`
- `questionKey`
- `questionLabel`
- `carryFlag`
- `borrowFlag`
- `crosses10`
- `crosses100`
- `digitsA`
- `digitsB`

Keep existing useful fields:

- `attemptId`
- `dateKey`
- `questionIndex`
- `expectedAnswer`
- `submittedAnswer`
- `outcome`
- `failureType`
- `attemptStartedAt`
- `answeredAt`
- `durationMs`
- `questionElapsedMs`

Compatibility note:

- Keep `table` and `multiplier` for multiplication rows during transition.
- For arithmetic rows, those fields can be `null`.

## 3. Progress Records

Current `tableProgress` is only meaningful for multiplication-table completion.

Do not overload that table for arithmetic.

Recommended new store:

- `skillProgress`

Suggested key shape:

- `[dateKey+mode+difficultyLevel]`

Suggested fields:

- `dateKey`
- `mode`
- `skill`
- `difficultyLevel`
- `strongChallenges`
- `completedChallenges`
- `streak`
- `starUnlocked`
- `trophyUnlocked`
- `recommendedNextLevel`
- `updatedAt`

Why separate it:

- multiplication progress is per table
- arithmetic progress is per mode and level
- mixing them into one store will make stats and UI logic harder

## Dexie Migration Plan

Create a new Dexie version in [src/lib/db.js](/Users/camilopr/weeellp/dani-pop-quiz/src/lib/db.js) rather than rewriting the existing one.

Migration steps:

1. Keep all current stores.
2. Add `skillProgress`.
3. Expand indexes for `challengeAttempts` and `answerAttempts` to include `mode`, `skill`, and `difficultyLevel`.
4. Default old multiplication rows to:
   - `mode: "tables"`
   - `skill: "multiplication"`
5. Preserve backward compatibility for previously stored data.

## Domain Model Changes

Introduce a generic question object used by all challenge modes.

Suggested shape:

```js
{
  mode: 'tables' | 'solo_add' | 'solo_subtract' | 'mixed',
  skill: 'multiplication' | 'arithmetic',
  operation: 'multiply' | 'add' | 'subtract',
  operandA: number,
  operandB: number,
  expectedAnswer: number,
  prompt: string,
  family: string | null,
  difficultyLevel: number | null,
  carryFlag: boolean,
  borrowFlag: boolean,
  crosses10: boolean,
  crosses100: boolean,
  digitsA: number,
  digitsB: number,
  questionKey: string
}
```

Benefits:

- one submission pipeline for all modes
- one persistence payload builder
- one stats pipeline with richer filtering

## Generator Architecture

Create a new library module for challenge generation.

Suggested file:

- `src/lib/challenges.js`

Responsibilities:

- define mode metadata
- define arithmetic family metadata
- generate balanced question sets
- expose question builders for multiplication and arithmetic

Suggested top-level functions:

- `createTablesChallenge(selectedTable)`
- `createAdditionChallenge(level, recentHistory)`
- `createSubtractionChallenge(level, recentHistory)`
- `createMixedArithmeticChallenge(level, recentHistory)`
- `recommendArithmeticLevel(mode, recentStats)`

## Generation Strategy

Use a two-stage generator:

### Stage 1: Build a Balanced Blueprint

Example output:

```js
[
  { family: 'bond_10', difficultyLevel: 1 },
  { family: 'single_cross_10', difficultyLevel: 1 },
  { family: 'single_cross_10', difficultyLevel: 1 },
  { family: 'bond_20', difficultyLevel: 1 }
]
```

This stage applies:

- target/review/stretch distribution
- family repetition limits
- weak-family reinforcement
- recent-history anti-repeat rules

### Stage 2: Materialize Concrete Questions

Turn each blueprint entry into an actual arithmetic question while checking:

- no duplicate prompt in current challenge
- no invalid subtraction result for beginner levels
- carry and borrow flags are correct
- question metadata is attached for stats

This split will make balancing easier to tune later.

## App State Changes

Generalize the current multiplication-only state in [src/App.svelte](/Users/camilopr/weeellp/dani-pop-quiz/src/App.svelte).

### New State

- `selectedMode`
- `selectedDifficultyLevel`
- `recommendedDifficultyLevel`
- `selectedSkill`
- `challengeConfig`

Suggested values:

- `selectedMode`: `tables`, `solo_add`, `solo_subtract`, `mixed`
- `selectedSkill`: derived from mode
- `challengeConfig`: generated settings used to start a challenge

### Replace Table-Specific Assumptions

Today the app uses `selectedTable`, `questions`, and multiplication-specific labels.

Keep:

- `selectedTable` for `tables` mode only

Generalize:

- prompt rendering should use `currentQuestion.prompt`
- answer validation should use `currentQuestion.expectedAnswer`
- persistence should use question metadata instead of recomputing from table and multiplier

## UI Plan

## 1. Intro Screen

Keep the current intro screen structure, but add a mode selector above the current table selector.

Recommended flow:

1. Choose mode
2. If mode is `tables`, show current table picker
3. If mode is arithmetic, show level picker and recommendation
4. Show challenge summary card
5. Start challenge

Suggested arithmetic controls:

- segmented buttons for `Solo sumas`, `Solo restas`, `Mixto`
- 3 level buttons
- small helper line like `Nivel recomendado: 2`

## 2. Challenge Screen

Current challenge UI can mostly stay intact.

Needed changes:

- question prompt becomes generic text instead of multiplication rendering
- progress copy should mention mode where useful
- success/retry messages can be selected by operation or mode

## 3. Stats Screen

Current stats are multiplication-table oriented.

Recommended approach:

- keep the current multiplication stats view
- add a separate arithmetic stats section or filter

Do not try to force arithmetic into table-based cards.

Useful arithmetic stats views:

- performance by mode
- performance by level
- performance by family
- weakest family
- fastest family
- recommended next level

## Stats Refactor Plan

[src/lib/stats.js](/Users/camilopr/weeellp/dani-pop-quiz/src/lib/stats.js) is currently built around tables and multiplier pairs.

Recommended path:

### Keep Existing Multiplication Stats

Do not break the current `tableRows` and `pairRows` logic.

### Add Parallel Arithmetic Stats Builders

Suggested additions:

- `buildArithmeticStatsSummary(data)`
- `sortArithmeticFamilyRows(rows, sort)`

Suggested arithmetic summary groups:

- `modeRows`
- `levelRows`
- `familyRows`
- `totals`
- `bestMode`
- `focusFamily`
- `fastestFamily`

This is safer than trying to collapse multiplication and arithmetic into one giant summary format.

## Persistence API Changes

Add new DB helpers instead of mutating all current function signatures at once.

Suggested additions in [src/lib/db.js](/Users/camilopr/weeellp/dani-pop-quiz/src/lib/db.js):

- `startSkillChallengeAttempt(config)`
- `recordSkillAnswerAttempt(payload)`
- `finishSkillChallengeAttempt(payload)`
- `recordSkillProgress(payload)`
- `loadSkillProgress(dateKey, filters)`

Transition strategy:

- existing multiplication code can continue using current helpers initially
- new arithmetic mode can use the generalized helpers
- later, multiplication can be migrated onto the same helpers if desired

## Recommended Refactor Strategy

To reduce risk, do not fully abstract everything in one pass.

### Step 1

Extract current multiplication challenge creation into `src/lib/challenges.js`.

This gives one place for question generation before adding arithmetic.

### Step 2

Update the submission flow to rely on generic question metadata:

- prompt
- expectedAnswer
- questionIndex
- mode
- operation

### Step 3

Add arithmetic mode and generation logic while leaving tables intact.

### Step 4

Add arithmetic stats and progress UI.

## Testing Plan

Extend [TESTING.md](/Users/camilopr/weeellp/dani-pop-quiz/TESTING.md) after implementation.

Minimum scenarios to cover:

### Arithmetic Challenge Flow

- start `Solo sumas` Level 1 challenge
- answer correct questions and finish successfully
- answer wrong questions and stay on the same question
- timeout should record terminal failure
- reset should close the previous attempt and start a new one

### Generation Rules

- generated challenge respects target/review/stretch distribution
- no duplicate exact questions in a challenge
- subtraction beginner levels never generate negative answers
- weak-family reinforcement appears when relevant

### Persistence

- arithmetic attempts write `mode`, `operation`, `family`, and `difficultyLevel`
- arithmetic progress is stored in `skillProgress`
- old multiplication data still loads correctly

### Stats

- multiplication stats still render correctly
- arithmetic stats show totals by family and level
- recommended level reflects recent arithmetic performance

## Recommended First Implementation Slice

The lowest-risk slice with the highest learning value is:

1. Add generic question objects.
2. Add generalized challenge-attempt and answer-attempt metadata.
3. Add `Solo sumas`.
4. Support Levels 1 through 3.
5. Keep arithmetic stats minimal at first:
   - total challenges
   - accuracy
   - average response time
   - weakest family

This slice is enough to validate the full product direction before subtraction and mixed mode.

## Concrete Build Sequence

1. Add a new Dexie version and `skillProgress`.
2. Create `src/lib/challenges.js` with generic question builders.
3. Refactor `src/App.svelte` to render generic prompts and validate generic questions.
4. Add arithmetic mode selector and level selector to the intro screen.
5. Implement `Solo sumas` generation and persistence.
6. Add arithmetic summary cards in stats.
7. Extend tests and manual checklist.
8. Only then add `Solo restas`.
9. Add `Mixto` last.

## Decisions To Lock Before Coding

1. Mixed mode unlock:
   Available from day one, or unlock after stable solo performance?

## Recommendation

For the first coded release, I recommend:

- Level 1 includes sums up to 20 from day one
- promotions are automatic
- mixed mode stays locked until solo sums and solo restas both show stable progress

That keeps the first version simpler, kinder, and more adaptive to real kid usage.
