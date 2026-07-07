# Arithmetic Challenge Spec

Product direction for adding addition and subtraction challenges to the existing quiz flow.

## Goals

- Improve fast mental addition first, then subtraction.
- Keep the current challenge-based feel of the app.
- Make question selection feel random while staying pedagogically useful.
- Track enough detail to adapt future challenges to weak spots.

## Guiding Principles

- Do not use pure randomness. Use controlled randomness.
- Difficulty is not only about digit count.
- Addition should launch before subtraction.
- Mixed addition and subtraction should come after both single-operation modes feel solid.
- Speed and accuracy should both matter for mastery.

## Rollout

### Phase 1

- Add `Solo sumas`
- Support 3 difficulty levels
- Use controlled randomness and question-family tagging

### Phase 2

- Add `Solo restas`
- Reuse the same challenge structure and mastery logic

### Phase 3

- Add `Mixto (+ / -)`
- Use prior data from sums and subtractions to recommend a level

## Challenge Modes

- `Tablas`
- `Solo sumas`
- `Solo restas`
- `Mixto (+ / -)`

`Tablas` remains unchanged. The new arithmetic modes should feel like parallel tracks, not replacements.

## Difficulty Model

Difficulty should be determined by a mix of:

- number of digits
- carry in addition
- borrow in subtraction
- whether the question crosses 10 or 100
- whether the numbers are near round anchors like 10, 20, 50, 100
- number of mental steps required

## Levels

### Level 1: Basics

Focus:

- instant recall
- number bonds
- simple positive subtraction

Question range:

- 1-digit + 1-digit
- 1-digit - 1-digit
- sums up to 20
- subtraction answers stay non-negative

Examples:

- `4 + 5`
- `7 + 3`
- `9 + 8`
- `10 - 2`
- `9 - 6`

### Level 2: Crossing Tens

Focus:

- making 10
- breaking numbers apart
- early carry and borrow fluency

Question range:

- 2-digit + 1-digit
- 2-digit - 1-digit
- 2-digit + 2-digit
- 2-digit - 2-digit
- mix of crossing-ten and non-crossing-ten questions

Examples:

- `24 + 5`
- `38 + 7`
- `41 + 23`
- `52 - 6`
- `41 - 18`

### Level 3: Crossing Hundreds

Focus:

- decomposition
- compensation
- multi-step mental arithmetic

Question range:

- 2-digit + 2-digit with higher frequency of carry
- 3-digit + 1-digit
- 3-digit + 2-digit
- 2-digit - 2-digit with borrow
- 3-digit - 2-digit

Examples:

- `48 + 27`
- `96 + 18`
- `135 - 58`
- `199 + 36`
- `203 - 7`

## Question Families

Each arithmetic question should belong to a family. Families are the core learning units and should be tagged on every generated question.

### Addition Families

#### Level 1

- `bond_10`: numbers that complete 10
- `bond_20`: numbers that complete 20
- `double`: doubles like `6 + 6`
- `near_double`: near doubles like `6 + 7`
- `single_no_carry`: 1-digit sums that do not cross 10
- `single_cross_10`: 1-digit sums that cross 10

#### Level 2

- `two_plus_one_no_carry`: `24 + 3`
- `two_plus_one_cross_10`: `28 + 5`
- `two_plus_two_no_carry`: `21 + 34`
- `two_plus_two_cross_10`: `27 + 18`
- `round_anchor_plus`: `29 + 4`, `49 + 6`
- `make_10_bridge`: questions that are best solved by reaching the next ten

#### Level 3

- `two_plus_two_multi_carry`: `58 + 37`
- `three_plus_one`: `126 + 8`
- `three_plus_two`: `145 + 28`
- `cross_100_add`: `87 + 15`, `196 + 7`
- `round_anchor_compensation_add`: `199 + 36`, `298 + 17`

### Subtraction Families

#### Level 1

- `within_10`: `8 - 3`
- `within_20`: `14 - 5`
- `bond_subtract`: inverse of number bonds like `10 - 7`
- `single_no_borrow`: small subtraction that stays simple

#### Level 2

- `two_minus_one_no_borrow`: `34 - 2`
- `two_minus_one_borrow`: `30 - 4`, `42 - 7`
- `two_minus_two_no_borrow`: `54 - 21`
- `two_minus_two_borrow`: `41 - 18`
- `bridge_back_10`: subtraction that crosses one ten boundary

#### Level 3

- `three_minus_one`: `203 - 7`
- `three_minus_two_no_borrow`: `154 - 23`
- `three_minus_two_borrow`: `135 - 58`
- `cross_100_subtract`: `203 - 16`
- `round_anchor_compensation_subtract`: `201 - 19`, `300 - 27`

## Challenge Composition

The app should not generate a challenge by sampling questions with no structure. Each challenge should be intentionally balanced.

### Standard Challenge Size

- 8 questions for early Level 1 onboarding
- 10 questions for normal play

### Composition Rule

For a 10-question challenge:

- 6 target questions from the selected level
- 2 review questions from the previous easier level
- 2 stretch questions from the next harder family or from the harder end of the current level

For Level 1, review questions can be replaced with extra target questions because there is no easier level.

### Family Distribution Rules

- No more than 3 questions from the same family in one challenge.
- No more than 2 high-friction questions in a row.
- A subtraction challenge should not overfill with borrow cases.
- A sum challenge should not overfill with crossing-ten or crossing-hundred cases.
- At least 3 distinct families should appear in every 10-question challenge.

### Randomness Rules

- Avoid repeating the exact same question inside the same challenge.
- Avoid repeating a question seen in the last 2 completed challenges if alternatives exist.
- Shuffle question order after building the balanced set.
- Optionally place one easy question first to create momentum.

## Mode-Specific Rules

### Solo Sums

- Prioritize speed and fluency.
- Use more repetition of weak addition families.
- This should be the first arithmetic mode introduced to the child.

### Solo Subtractions

- Start with positive answers only.
- Delay heavy borrow frequency until addition fluency is stable.
- In lower levels, cap the number of borrow questions per challenge.

### Mixed (+ / -)

- Only unlock after the child shows stable performance in both solo modes.
- Keep operation balance close to even.
- Avoid sequences longer than 3 questions of the same operation unless adaptation is targeting a specific weakness.

## Mastery Model

Progress should depend on both accuracy and speed.

### Strong Challenge

A challenge counts as strong when:

- accuracy is at least 90%
- average response time is under the level target

### Level Targets

- Level 1: under 3.0 seconds per question
- Level 2: under 4.0 seconds per question
- Level 3: under 5.5 seconds per question

### Promotion Rule

- Promote after 3 strong challenges in the most recent 5 challenges for that mode and level.

### Stay-and-Practice Rule

- Stay at the current level when accuracy is between 70% and 89%, or when speed is still above target.

### Review Rule

Recommend focused review when either of these is true:

- accuracy falls below 70% in 2 of the most recent 4 challenges
- the same family repeatedly causes slow or wrong answers

The review recommendation should not feel like punishment. It should feel like coaching.

## Adaptation Rules

The app should learn from question-family performance, not just total score.

### Weak Family Detection

Mark a family as weak when any of the following is true:

- accuracy in that family falls below 75% across recent attempts
- average time in that family is 25% slower than the level target
- the family is the most frequent source of wrong answers in the recent window

### Adaptive Next Challenge

When a weak family exists:

- include 2 to 4 extra questions from that family in the next challenge set
- keep at least half of the challenge in non-weak families to avoid frustration
- add one easier confidence-building question before the first weak-family question when possible

## Data To Track

Each arithmetic question attempt should record:

- operation: `add` or `subtract`
- mode: `solo_add`, `solo_subtract`, `mixed`
- difficultyLevel: `1`, `2`, or `3`
- family
- operandA
- operandB
- expectedAnswer
- submittedAnswer
- isCorrect
- responseTimeMs
- questionElapsedMs
- carryFlag
- borrowFlag
- crosses10
- crosses100
- digitsA
- digitsB

This will support:

- speed by family
- accuracy by family
- weakest pattern detection
- better recommended level logic
- parent-facing insights later

## Recommended Feedback Copy

Feedback should be short, encouraging, and specific enough to guide the next action.

### During Challenge

Correct:

- `¡Exacto!`
- `¡Vas rapidísima!`
- `¡Muy bien pensado!`
- `¡Eso fue en un instante!`

Incorrect:

- `Respira y prueba otra vez.`
- `Piensa en llegar al 10.`
- `Separa el número en partes.`
- `Casi. Vamos con calma.`

### End of Challenge

Strong result:

- `¡Qué velocidad! Hoy estuviste muy fuerte en las sumas.`
- `¡Excelente reto! Respondiste rápido y con mucha precisión.`

Needs review:

- `Muy bien intentado. Mañana podemos practicar las que cruzan decena.`
- `Hoy tocó pensar más en algunas restas. La próxima saldrá más rápido.`

Weak-family focused:

- `Las sumas básicas van muy bien. Vamos a practicar un poco más cuando hay que cruzar decena.`
- `Las restas simples ya están saliendo mejor. Seguimos reforzando las que piden prestar.`

### Parent or Family Insights

- `Fortaleza de hoy: sumas básicas rápidas.`
- `Punto a reforzar: restas con préstamo.`
- `Mejor ritmo: operaciones sin cruce de decena.`

## Recommended First Build

The highest-value first version is:

- `Solo sumas`
- 3 levels
- controlled randomness
- question-family tagging
- speed-aware mastery
- weak-family reinforcement

This version is enough to validate the learning model before adding subtraction and mixed play.

## Open Product Decisions

Before implementation, confirm:

1. Whether subtraction launches immediately after addition or after observed addition mastery.
2. Whether mixed mode is locked until both solo modes reach Level 2 or higher.

## Locked Decisions

- Level 1 includes sums up to 20 from day one.
- Level promotion is automatic.
