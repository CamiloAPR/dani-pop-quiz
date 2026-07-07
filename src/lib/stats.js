export const DEFAULT_STATS_SORT = {
  key: 'failures',
  direction: 'desc'
}

export const failureTypeLabels = {
  wrong_answer: 'Error',
  timeout_final: 'Tiempo',
  reset_final: 'Reinicio'
}

export const challengeStatusLabels = {
  success: 'Éxito',
  timeout: 'Tiempo agotado',
  reset: 'Reinicio',
  running: 'En curso',
  unknown: 'Sin estado'
}

export const ARITHMETIC_LEVEL_TARGETS = {
  1: 3000,
  2: 4000,
  3: 5500
}

export function createEmptyStatsData() {
  return {
    days: [],
    tableProgress: [],
    challengeAttempts: [],
    answerAttempts: []
  }
}

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function createTableStats(table) {
  return {
    table,
    challenges: 0,
    finishedChallenges: 0,
    successfulChallenges: 0,
    failedChallenges: 0,
    completions: 0,
    starDays: 0,
    trophyDays: 0,
    correct: 0,
    incorrect: 0,
    terminalFailures: 0,
    failures: 0,
    opportunities: 0,
    submittedAnswers: 0,
    correctDurationTotal: 0,
    correctDurationCount: 0,
    submittedDurationTotal: 0,
    submittedDurationCount: 0,
    failureDurationTotal: 0,
    failureDurationCount: 0,
    avgCorrectMs: null,
    avgSubmittedMs: null,
    avgFailureMs: null,
    challengeSuccessRate: null,
    accuracyRate: null,
    masteryRate: null,
    commonFailure: null,
    challengeHistory: []
  }
}

function createPairStats(table, multiplier) {
  return {
    table,
    multiplier,
    problem: `${table} x ${multiplier}`,
    correct: 0,
    incorrect: 0,
    terminalFailures: 0,
    failures: 0,
    totalAttempts: 0,
    submittedAnswers: 0,
    wrongAnswers: {},
    commonWrongAnswer: null,
    commonWrongAnswerCount: 0,
    correctDurationTotal: 0,
    correctDurationCount: 0,
    failureDurationTotal: 0,
    failureDurationCount: 0,
    avgCorrectMs: null,
    avgFailureMs: null,
    accuracyRate: null,
    masteryRate: null,
    failureRate: null,
    lastSeenAt: null,
    lastSeenDateKey: null
  }
}

function average(total, count) {
  return count > 0 ? total / count : null
}

function rate(part, total) {
  return total > 0 ? part / total : null
}

function byTableAndMultiplier(a, b) {
  return a.table - b.table || a.multiplier - b.multiplier
}

function normalizeChallengeStatus(status) {
  return challengeStatusLabels[status] ? status : 'unknown'
}

function compareChallengeAttempts(a, b) {
  const aTime = a.startedAt ?? a.endedAt ?? 0
  const bTime = b.startedAt ?? b.endedAt ?? 0

  if (aTime !== bTime) {
    return aTime - bTime
  }

  return `${a.id ?? ''}`.localeCompare(`${b.id ?? ''}`)
}

function compareNullableNumbers(a, b, direction) {
  const emptyA = a === null || a === undefined
  const emptyB = b === null || b === undefined

  if (emptyA && emptyB) return 0
  if (emptyA) return 1
  if (emptyB) return -1

  return direction === 'asc' ? a - b : b - a
}

function getSortValue(row, key) {
  if (key === 'lastSeenAt') {
    return row.lastSeenAt
  }

  return row[key]
}

function isTablesMode(value) {
  return (value || 'tables') === 'tables'
}

function isArithmeticMode(value) {
  return ['solo_add', 'solo_subtract', 'mixed'].includes(value || '')
}

export function sortFailureRows(rows, sort = DEFAULT_STATS_SORT) {
  const direction = sort.direction === 'asc' ? 'asc' : 'desc'
  const key = sort.key || DEFAULT_STATS_SORT.key

  return [...rows].sort((a, b) => {
    if (key === 'problem') {
      const problemCompare = byTableAndMultiplier(a, b)
      return direction === 'asc' ? problemCompare : -problemCompare
    }

    const valueA = getSortValue(a, key)
    const valueB = getSortValue(b, key)
    const primary = compareNullableNumbers(valueA, valueB, direction)

    if (primary !== 0) {
      return primary
    }

    return b.failures - a.failures || byTableAndMultiplier(a, b)
  })
}

export function buildStatsSummary(data, tables, multipliers) {
  const tableStats = new Map(tables.map((table) => [table, createTableStats(table)]))
  const pairStats = new Map()

  tables.forEach((table) => {
    multipliers.forEach((multiplier) => {
      pairStats.set(`${table}-${multiplier}`, createPairStats(table, multiplier))
    })
  })

  const totals = {
    challenges: 0,
    finishedChallenges: 0,
    successfulChallenges: 0,
    failedChallenges: 0,
    correct: 0,
    incorrect: 0,
    terminalFailures: 0,
    failures: 0,
    opportunities: 0,
    submittedAnswers: 0,
    correctDurationTotal: 0,
    correctDurationCount: 0,
    submittedDurationTotal: 0,
    submittedDurationCount: 0,
    failureDurationTotal: 0,
    failureDurationCount: 0,
    avgCorrectMs: null,
    avgSubmittedMs: null,
    avgFailureMs: null,
    challengeSuccessRate: null,
    accuracyRate: null,
    masteryRate: null
  }

  ;(data.tableProgress || []).forEach((progress) => {
    const table = safeNumber(progress.table, null)
    const stats = tableStats.get(table)
    if (!stats) return

    stats.completions += safeNumber(progress.completions)
    if (progress.starUnlocked || progress.completions >= 1 || progress.trophyUnlocked) {
      stats.starDays += 1
    }
    if (progress.trophyUnlocked) {
      stats.trophyDays += 1
    }
  })

  ;(data.challengeAttempts || []).forEach((attempt) => {
    const table = safeNumber(attempt.table, null)
    const stats = tableStats.get(table)
    if (!stats || !isTablesMode(attempt.mode)) return

    const status = attempt.status
    const finished = status && status !== 'running'
    const startedAt = safeNumber(attempt.startedAt, null)
    const endedAt = safeNumber(attempt.endedAt, null)

    totals.challenges += 1
    if (finished) {
      totals.finishedChallenges += 1
    }
    if (status === 'success') {
      totals.successfulChallenges += 1
    } else if (finished) {
      totals.failedChallenges += 1
    }

    stats.challengeHistory.push({
      id: attempt.id,
      dateKey: attempt.dateKey,
      status: normalizeChallengeStatus(status),
      startedAt,
      endedAt,
      completedCount: safeNumber(attempt.completedCount),
      maxTimeMs: safeNumber(attempt.maxTimeMs, null)
    })

    stats.challenges += 1
    if (finished) {
      stats.finishedChallenges += 1
    }
    if (status === 'success') {
      stats.successfulChallenges += 1
    } else if (finished) {
      stats.failedChallenges += 1
    }
  })

  ;(data.answerAttempts || []).forEach((attempt) => {
    const table = safeNumber(attempt.table, null)
    const multiplier = safeNumber(attempt.multiplier, null)
    const stats = tableStats.get(table)
    const pair = pairStats.get(`${table}-${multiplier}`)
    const outcome = attempt.outcome
    const durationMs = Math.max(0, safeNumber(attempt.durationMs))
    const failureDurationMs = Math.max(0, safeNumber(attempt.questionElapsedMs, durationMs))
    const answeredAt = safeNumber(attempt.answeredAt, null)

    if (!stats || !pair) return

    stats.opportunities += 1
    pair.totalAttempts += 1

    if (answeredAt && (!pair.lastSeenAt || answeredAt > pair.lastSeenAt)) {
      pair.lastSeenAt = answeredAt
      pair.lastSeenDateKey = attempt.dateKey
    }

    if (outcome === 'correct') {
      totals.correct += 1
      totals.correctDurationTotal += durationMs
      totals.correctDurationCount += 1
      totals.submittedAnswers += 1
      totals.submittedDurationTotal += durationMs
      totals.submittedDurationCount += 1

      stats.correct += 1
      stats.submittedAnswers += 1
      stats.correctDurationTotal += durationMs
      stats.correctDurationCount += 1
      stats.submittedDurationTotal += durationMs
      stats.submittedDurationCount += 1

      pair.correct += 1
      pair.submittedAnswers += 1
      pair.correctDurationTotal += durationMs
      pair.correctDurationCount += 1
    } else if (outcome === 'incorrect') {
      const submittedAnswer = attempt.submittedAnswer === null || attempt.submittedAnswer === undefined ? 'vacía' : `${attempt.submittedAnswer}`

      totals.incorrect += 1
      totals.failures += 1
      totals.submittedAnswers += 1
      totals.submittedDurationTotal += durationMs
      totals.submittedDurationCount += 1
      totals.failureDurationTotal += failureDurationMs
      totals.failureDurationCount += 1

      stats.incorrect += 1
      stats.failures += 1
      stats.submittedAnswers += 1
      stats.submittedDurationTotal += durationMs
      stats.submittedDurationCount += 1
      stats.failureDurationTotal += failureDurationMs
      stats.failureDurationCount += 1

      pair.incorrect += 1
      pair.failures += 1
      pair.submittedAnswers += 1
      pair.failureDurationTotal += failureDurationMs
      pair.failureDurationCount += 1
      pair.wrongAnswers[submittedAnswer] = (pair.wrongAnswers[submittedAnswer] || 0) + 1
    } else if (outcome === 'terminal_failure') {
      totals.terminalFailures += 1
      totals.failures += 1
      totals.failureDurationTotal += failureDurationMs
      totals.failureDurationCount += 1

      stats.terminalFailures += 1
      stats.failures += 1
      stats.failureDurationTotal += failureDurationMs
      stats.failureDurationCount += 1

      pair.terminalFailures += 1
      pair.failures += 1
      pair.failureDurationTotal += failureDurationMs
      pair.failureDurationCount += 1
    }
  })

  totals.opportunities = totals.correct + totals.incorrect + totals.terminalFailures
  totals.avgCorrectMs = average(totals.correctDurationTotal, totals.correctDurationCount)
  totals.avgSubmittedMs = average(totals.submittedDurationTotal, totals.submittedDurationCount)
  totals.avgFailureMs = average(totals.failureDurationTotal, totals.failureDurationCount)
  totals.challengeSuccessRate = rate(totals.successfulChallenges, totals.finishedChallenges)
  totals.accuracyRate = rate(totals.correct, totals.submittedAnswers)
  totals.masteryRate = rate(totals.correct, totals.opportunities)

  const pairRows = [...pairStats.values()].map((pair) => {
    const wrongEntries = Object.entries(pair.wrongAnswers).sort((a, b) => b[1] - a[1])
    const commonWrong = wrongEntries[0]

    pair.commonWrongAnswer = commonWrong?.[0] ?? null
    pair.commonWrongAnswerCount = commonWrong?.[1] ?? 0
    pair.avgCorrectMs = average(pair.correctDurationTotal, pair.correctDurationCount)
    pair.avgFailureMs = average(pair.failureDurationTotal, pair.failureDurationCount)
    pair.accuracyRate = rate(pair.correct, pair.submittedAnswers)
    pair.masteryRate = rate(pair.correct, pair.totalAttempts)
    pair.failureRate = rate(pair.failures, pair.totalAttempts)

    return pair
  })

  pairRows.forEach((pair) => {
    const stats = tableStats.get(pair.table)
    if (!stats || pair.failures <= 0) return

    const previous = stats.commonFailure
    if (!previous || pair.failures > previous.failures || (pair.failures === previous.failures && pair.totalAttempts > previous.totalAttempts)) {
      stats.commonFailure = pair
    }
  })

  const tableRows = [...tableStats.values()].map((stats) => {
    stats.avgCorrectMs = average(stats.correctDurationTotal, stats.correctDurationCount)
    stats.avgSubmittedMs = average(stats.submittedDurationTotal, stats.submittedDurationCount)
    stats.avgFailureMs = average(stats.failureDurationTotal, stats.failureDurationCount)
    stats.challengeSuccessRate = rate(stats.successfulChallenges, stats.finishedChallenges)
    stats.accuracyRate = rate(stats.correct, stats.submittedAnswers)
    stats.masteryRate = rate(stats.correct, stats.opportunities)
    stats.challengeHistory = stats.challengeHistory
      .sort(compareChallengeAttempts)
      .map((attempt, index) => ({
        ...attempt,
        number: index + 1
      }))
    return stats
  })

  const practicedTables = tableRows.filter((stats) => stats.opportunities > 0 || stats.challenges > 0)
  const bestTable = [...practicedTables].sort(
    (a, b) =>
      compareNullableNumbers(a.masteryRate, b.masteryRate, 'desc') ||
      compareNullableNumbers(a.challengeSuccessRate, b.challengeSuccessRate, 'desc') ||
      compareNullableNumbers(a.avgCorrectMs, b.avgCorrectMs, 'asc') ||
      a.table - b.table
  )[0] ?? null
  const focusTable = [...practicedTables].sort(
    (a, b) =>
      compareNullableNumbers(a.masteryRate, b.masteryRate, 'asc') ||
      b.failures - a.failures ||
      b.failedChallenges - a.failedChallenges ||
      a.table - b.table
  )[0] ?? null
  const fastestTable = [...practicedTables].filter((stats) => stats.avgCorrectMs !== null).sort(
    (a, b) => a.avgCorrectMs - b.avgCorrectMs || b.correct - a.correct || a.table - b.table
  )[0] ?? null
  const commonFailure = [...pairRows].filter((pair) => pair.failures > 0).sort(
    (a, b) => b.failures - a.failures || b.failureRate - a.failureRate || byTableAndMultiplier(a, b)
  )[0] ?? null

  return {
    totals,
    tableRows,
    pairRows,
    practicedPairCount: pairRows.filter((pair) => pair.totalAttempts > 0).length,
    totalPairCount: tables.length * multipliers.length,
    activeDateCount: new Set([
      ...(data.challengeAttempts || []).map((row) => row.dateKey),
      ...(data.answerAttempts || []).map((row) => row.dateKey),
      ...(data.tableProgress || []).map((row) => row.dateKey)
    ].filter(Boolean)).size,
    bestTable,
    focusTable,
    fastestTable,
    commonFailure
  }
}

function createArithmeticLevelStats(level) {
  return {
    level,
    challenges: 0,
    finishedChallenges: 0,
    successfulChallenges: 0,
    failedChallenges: 0,
    correct: 0,
    incorrect: 0,
    terminalFailures: 0,
    failures: 0,
    opportunities: 0,
    submittedAnswers: 0,
    correctDurationTotal: 0,
    correctDurationCount: 0,
    failureDurationTotal: 0,
    failureDurationCount: 0,
    avgCorrectMs: null,
    avgFailureMs: null,
    challengeSuccessRate: null,
    accuracyRate: null,
    masteryRate: null,
    challengeRows: [],
    strongRecentCount: 0
  }
}

function createArithmeticFamilyStats(family) {
  return {
    family,
    correct: 0,
    incorrect: 0,
    terminalFailures: 0,
    failures: 0,
    totalAttempts: 0,
    submittedAnswers: 0,
    correctDurationTotal: 0,
    correctDurationCount: 0,
    failureDurationTotal: 0,
    failureDurationCount: 0,
    avgCorrectMs: null,
    avgFailureMs: null,
    accuracyRate: null,
    masteryRate: null,
    slowRate: null,
    lastSeenAt: null,
    lastSeenDateKey: null
  }
}

function isStrongArithmeticChallenge(challenge) {
  if (!challenge || challenge.status !== 'success') {
    return false
  }

  const target = ARITHMETIC_LEVEL_TARGETS[challenge.difficultyLevel]
  if (!target) {
    return false
  }

  return (challenge.accuracyRate ?? 0) >= 0.9 && (challenge.avgCorrectMs ?? Number.POSITIVE_INFINITY) <= target
}

export function buildArithmeticStatsSummary(data, { mode = null } = {}) {
  const levelStats = new Map()
  const familyStats = new Map()
  const challengeRowsById = new Map()
  const recentQuestionRows = []

  const totals = {
    challenges: 0,
    finishedChallenges: 0,
    successfulChallenges: 0,
    failedChallenges: 0,
    correct: 0,
    incorrect: 0,
    terminalFailures: 0,
    failures: 0,
    opportunities: 0,
    submittedAnswers: 0,
    correctDurationTotal: 0,
    correctDurationCount: 0,
    failureDurationTotal: 0,
    failureDurationCount: 0,
    avgCorrectMs: null,
    avgFailureMs: null,
    challengeSuccessRate: null,
    accuracyRate: null,
    masteryRate: null
  }

  ;(data.challengeAttempts || []).forEach((attempt) => {
    const attemptMode = attempt.mode || (attempt.skill === 'arithmetic' ? 'solo_add' : 'tables')
    if (!isArithmeticMode(attemptMode) || (mode && attemptMode !== mode)) {
      return
    }

    const level = safeNumber(attempt.difficultyLevel, null)
    if (!level) return

    const stats = levelStats.get(level) || createArithmeticLevelStats(level)
    const status = attempt.status
    const finished = status && status !== 'running'

    totals.challenges += 1
    if (finished) {
      totals.finishedChallenges += 1
    }
    if (status === 'success') {
      totals.successfulChallenges += 1
    } else if (finished) {
      totals.failedChallenges += 1
    }

    stats.challenges += 1
    if (finished) {
      stats.finishedChallenges += 1
    }
    if (status === 'success') {
      stats.successfulChallenges += 1
    } else if (finished) {
      stats.failedChallenges += 1
    }

    const challengeRow = {
      id: attempt.id,
      mode: attemptMode,
      difficultyLevel: level,
      dateKey: attempt.dateKey,
      status: normalizeChallengeStatus(status),
      startedAt: safeNumber(attempt.startedAt, null),
      endedAt: safeNumber(attempt.endedAt, null),
      questionCount: safeNumber(attempt.questionCount, safeNumber(attempt.completedCount, 0)),
      completedCount: safeNumber(attempt.completedCount, 0),
      correct: 0,
      incorrect: 0,
      terminalFailures: 0,
      submittedAnswers: 0,
      opportunities: 0,
      correctDurationTotal: 0,
      correctDurationCount: 0,
      avgCorrectMs: null,
      accuracyRate: null,
      masteryRate: null,
      strong: false
    }

    stats.challengeRows.push(challengeRow)
    challengeRowsById.set(challengeRow.id, challengeRow)
    levelStats.set(level, stats)
  })

  ;(data.answerAttempts || []).forEach((attempt) => {
    const attemptMode = attempt.mode || (attempt.skill === 'arithmetic' ? 'solo_add' : 'tables')
    if (!isArithmeticMode(attemptMode) || (mode && attemptMode !== mode)) {
      return
    }

    const level = safeNumber(attempt.difficultyLevel, null)
    if (!level) return

    const levelRow = levelStats.get(level) || createArithmeticLevelStats(level)
    const family = attempt.family || 'sin_familia'
    const familyRow = familyStats.get(family) || createArithmeticFamilyStats(family)
    const outcome = attempt.outcome
    const durationMs = Math.max(0, safeNumber(attempt.durationMs))
    const failureDurationMs = Math.max(0, safeNumber(attempt.questionElapsedMs, durationMs))
    const answeredAt = safeNumber(attempt.answeredAt, null)
    const challengeRow = challengeRowsById.get(attempt.attemptId)

    levelRow.opportunities += 1
    familyRow.totalAttempts += 1

    if (answeredAt) {
      recentQuestionRows.push({
        questionKey: attempt.questionKey,
        answeredAt
      })
      if (!familyRow.lastSeenAt || answeredAt > familyRow.lastSeenAt) {
        familyRow.lastSeenAt = answeredAt
        familyRow.lastSeenDateKey = attempt.dateKey
      }
    }

    if (challengeRow) {
      challengeRow.opportunities += 1
    }

    if (outcome === 'correct') {
      totals.correct += 1
      totals.correctDurationTotal += durationMs
      totals.correctDurationCount += 1
      totals.submittedAnswers += 1

      levelRow.correct += 1
      levelRow.submittedAnswers += 1
      levelRow.correctDurationTotal += durationMs
      levelRow.correctDurationCount += 1

      familyRow.correct += 1
      familyRow.submittedAnswers += 1
      familyRow.correctDurationTotal += durationMs
      familyRow.correctDurationCount += 1

      if (challengeRow) {
        challengeRow.correct += 1
        challengeRow.submittedAnswers += 1
        challengeRow.correctDurationTotal += durationMs
        challengeRow.correctDurationCount += 1
      }
    } else if (outcome === 'incorrect') {
      totals.incorrect += 1
      totals.failures += 1
      totals.submittedAnswers += 1
      totals.failureDurationTotal += failureDurationMs
      totals.failureDurationCount += 1

      levelRow.incorrect += 1
      levelRow.failures += 1
      levelRow.submittedAnswers += 1
      levelRow.failureDurationTotal += failureDurationMs
      levelRow.failureDurationCount += 1

      familyRow.incorrect += 1
      familyRow.failures += 1
      familyRow.submittedAnswers += 1
      familyRow.failureDurationTotal += failureDurationMs
      familyRow.failureDurationCount += 1

      if (challengeRow) {
        challengeRow.incorrect += 1
        challengeRow.submittedAnswers += 1
      }
    } else if (outcome === 'terminal_failure') {
      totals.terminalFailures += 1
      totals.failures += 1
      totals.failureDurationTotal += failureDurationMs
      totals.failureDurationCount += 1

      levelRow.terminalFailures += 1
      levelRow.failures += 1
      levelRow.failureDurationTotal += failureDurationMs
      levelRow.failureDurationCount += 1

      familyRow.terminalFailures += 1
      familyRow.failures += 1
      familyRow.failureDurationTotal += failureDurationMs
      familyRow.failureDurationCount += 1

      if (challengeRow) {
        challengeRow.terminalFailures += 1
      }
    }

    levelStats.set(level, levelRow)
    familyStats.set(family, familyRow)
  })

  totals.opportunities = totals.correct + totals.incorrect + totals.terminalFailures
  totals.avgCorrectMs = average(totals.correctDurationTotal, totals.correctDurationCount)
  totals.avgFailureMs = average(totals.failureDurationTotal, totals.failureDurationCount)
  totals.challengeSuccessRate = rate(totals.successfulChallenges, totals.finishedChallenges)
  totals.accuracyRate = rate(totals.correct, totals.submittedAnswers)
  totals.masteryRate = rate(totals.correct, totals.opportunities)

  const levelRows = [...levelStats.values()]
    .map((levelRow) => {
      levelRow.avgCorrectMs = average(levelRow.correctDurationTotal, levelRow.correctDurationCount)
      levelRow.avgFailureMs = average(levelRow.failureDurationTotal, levelRow.failureDurationCount)
      levelRow.challengeSuccessRate = rate(levelRow.successfulChallenges, levelRow.finishedChallenges)
      levelRow.accuracyRate = rate(levelRow.correct, levelRow.submittedAnswers)
      levelRow.masteryRate = rate(levelRow.correct, levelRow.opportunities)
      levelRow.challengeRows = levelRow.challengeRows
        .map((challengeRow) => {
          challengeRow.avgCorrectMs = average(challengeRow.correctDurationTotal, challengeRow.correctDurationCount)
          challengeRow.accuracyRate = rate(challengeRow.correct, challengeRow.submittedAnswers)
          challengeRow.masteryRate = rate(challengeRow.correct, challengeRow.opportunities)
          challengeRow.strong = isStrongArithmeticChallenge(challengeRow)
          return challengeRow
        })
        .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
      levelRow.strongRecentCount = levelRow.challengeRows.slice(0, 5).filter((row) => row.strong).length
      return levelRow
    })
    .sort((a, b) => a.level - b.level)

  const familyRows = [...familyStats.values()]
    .map((familyRow) => {
      familyRow.avgCorrectMs = average(familyRow.correctDurationTotal, familyRow.correctDurationCount)
      familyRow.avgFailureMs = average(familyRow.failureDurationTotal, familyRow.failureDurationCount)
      familyRow.accuracyRate = rate(familyRow.correct, familyRow.submittedAnswers)
      familyRow.masteryRate = rate(familyRow.correct, familyRow.totalAttempts)
      familyRow.slowRate =
        familyRow.avgCorrectMs && totals.avgCorrectMs ? familyRow.avgCorrectMs / totals.avgCorrectMs : null
      return familyRow
    })
    .sort(
      (a, b) =>
        compareNullableNumbers(a.masteryRate, b.masteryRate, 'asc') ||
        b.failures - a.failures ||
        compareNullableNumbers(a.avgCorrectMs, b.avgCorrectMs, 'desc') ||
        `${a.family}`.localeCompare(`${b.family}`)
    )

  let recommendedLevel = 1

  for (const levelRow of levelRows) {
    recommendedLevel = Math.max(recommendedLevel, levelRow.level)
    if (levelRow.level >= 3) {
      break
    }
    if (levelRow.strongRecentCount >= 3) {
      recommendedLevel = levelRow.level + 1
      continue
    }
    break
  }

  const recentQuestionKeys = [...recentQuestionRows]
    .sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0))
    .map((row) => row.questionKey)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 20)

  return {
    totals,
    levelRows,
    familyRows,
    practicedFamilyCount: familyRows.filter((row) => row.totalAttempts > 0).length,
    recommendedLevel,
    focusFamily: familyRows[0] ?? null,
    fastestFamily:
      [...familyRows].filter((row) => row.avgCorrectMs !== null).sort((a, b) => a.avgCorrectMs - b.avgCorrectMs)[0] ?? null,
    recentQuestionKeys
  }
}
