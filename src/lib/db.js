import Dexie from 'dexie'

const DB_NAME = 'dani-pop-quiz'
const MIGRATION_FLAG_KEY = 'dexieMigrationDone'
const TABLE_PROGRESS_KEY = 'tableProgress'
const LEGACY_COMPLETED_TABLES_KEY = 'completedTables'

let db

function isBrowser() {
  return typeof window !== 'undefined'
}

function getDb() {
  if (!isBrowser()) {
    return null
  }

  if (!db) {
    db = new Dexie(DB_NAME)
    db.version(1).stores({
      days: '&dateKey, createdAt, updatedAt',
      tableProgress: '[dateKey+table], dateKey, table',
      challengeAttempts: 'id, dateKey, table, status, startedAt, endedAt',
      answerAttempts: 'id, attemptId, dateKey, table, multiplier, outcome, failureType'
    })
  }

  return db
}

function nowMs() {
  return Date.now()
}

function clampCount(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function buildProgressRecord(table, value) {
  const completions = clampCount(value?.completions ?? 0)
  const streak = clampCount(value?.streak ?? 0)
  const trophyUnlocked = Boolean(value?.trophyUnlocked || streak >= 2)
  const starUnlocked = Boolean(value?.starUnlocked || completions >= 1 || trophyUnlocked)

  return {
    completions: starUnlocked ? Math.max(1, completions) : completions,
    streak,
    starUnlocked,
    trophyUnlocked
  }
}

function normalizeProgressShape(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const normalized = {}

  Object.entries(raw).forEach(([key, value]) => {
    const table = Number(key)
    if (!Number.isInteger(table)) {
      return
    }

    const objectValue = value && typeof value === 'object' && !Array.isArray(value) ? value : null
    const completions = objectValue ? clampCount(Number(objectValue.completions ?? value) || 0) : clampCount(Number(value) || 0)
    const streak = objectValue ? clampCount(Number(objectValue.streak) || 0) : 0
    const trophyUnlocked = Boolean(objectValue?.trophyUnlocked || streak >= 2)

    normalized[table] = buildProgressRecord(table, {
      completions,
      streak,
      trophyUnlocked
    })
  })

  return normalized
}

function normalizeCompletedTables(raw) {
  if (!Array.isArray(raw)) {
    return {}
  }

  const normalized = {}

  raw.forEach((value) => {
    const table = Number(value)
    if (!Number.isInteger(table)) {
      return
    }

    normalized[table] = buildProgressRecord(table, {
      completions: 1,
      streak: 1,
      trophyUnlocked: false
    })
  })

  return normalized
}

function mergeProgressMaps(...maps) {
  const merged = {}

  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([key, value]) => {
      const table = Number(key)
      if (!Number.isInteger(table)) {
        return
      }

      const previous = merged[table] || {
        completions: 0,
        streak: 0,
        starUnlocked: false,
        trophyUnlocked: false
      }

      const completions = Math.max(previous.completions, clampCount(value?.completions ?? 0))
      const streak = Math.max(previous.streak, clampCount(value?.streak ?? 0))
      const trophyUnlocked = Boolean(previous.trophyUnlocked || value?.trophyUnlocked || streak >= 2)
      const starUnlocked = Boolean(previous.starUnlocked || value?.starUnlocked || completions >= 1 || trophyUnlocked)

      merged[table] = buildProgressRecord(table, {
        completions,
        streak,
        starUnlocked,
        trophyUnlocked
      })
    })
  })

  return merged
}

function readStorageItem(storage, key) {
  try {
    return storage.getItem(key)
  } catch (error) {
    console.warn(`No se pudo leer la clave ${key}.`, error)
    return null
  }
}

function setStorageItem(storage, key, value) {
  try {
    storage.setItem(key, value)
  } catch (error) {
    console.warn(`No se pudo escribir la clave ${key}.`, error)
  }
}

function removeStorageItem(storage, key) {
  try {
    storage.removeItem(key)
  } catch (error) {
    console.warn(`No se pudo borrar la clave ${key}.`, error)
  }
}

function parseStoredJSON(raw) {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    console.warn('No se pudo interpretar un dato legado de progreso.', error)
    return null
  }
}

function collectLegacyProgress() {
  if (!isBrowser()) {
    return {}
  }

  const sessionProgress = normalizeProgressShape(parseStoredJSON(readStorageItem(window.sessionStorage, TABLE_PROGRESS_KEY)))
  const localProgress = normalizeProgressShape(parseStoredJSON(readStorageItem(window.localStorage, TABLE_PROGRESS_KEY)))
  const sessionCompleted = normalizeCompletedTables(parseStoredJSON(readStorageItem(window.sessionStorage, LEGACY_COMPLETED_TABLES_KEY)))
  const localCompleted = normalizeCompletedTables(parseStoredJSON(readStorageItem(window.localStorage, LEGACY_COMPLETED_TABLES_KEY)))

  return mergeProgressMaps(sessionProgress, localProgress, sessionCompleted, localCompleted)
}

function createProgressRow(dateKey, table, value, updatedAt) {
  const record = buildProgressRecord(table, value)

  return {
    dateKey,
    table,
    completions: record.completions,
    streak: record.streak,
    starUnlocked: record.starUnlocked,
    trophyUnlocked: record.trophyUnlocked,
    updatedAt
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `id-${nowMs()}-${Math.random().toString(16).slice(2)}`
}

async function touchDay(dateKey, timestamp = nowMs()) {
  const database = getDb()
  if (!database) {
    return null
  }

  const existing = await database.days.get(dateKey)
  const row = {
    dateKey,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  }

  await database.days.put(row)
  return row
}

export function getTodayDateKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = `${today.getMonth() + 1}`.padStart(2, '0')
  const day = `${today.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function ensureDayDataset(dateKey) {
  return touchDay(dateKey)
}

export async function loadDayProgress(dateKey) {
  const database = getDb()
  if (!database) {
    return {}
  }

  const rows = await database.tableProgress.where('dateKey').equals(dateKey).toArray()

  return rows.reduce((accumulator, row) => {
    accumulator[row.table] = {
      completions: clampCount(row.completions),
      streak: clampCount(row.streak),
      starUnlocked: Boolean(row.starUnlocked || row.completions >= 1 || row.trophyUnlocked),
      trophyUnlocked: Boolean(row.trophyUnlocked),
      updatedAt: row.updatedAt
    }
    return accumulator
  }, {})
}

async function loadRowsForDateRange(table, { startDateKey, endDateKey, allTime = false }) {
  if (allTime || !startDateKey || !endDateKey) {
    return table.toArray()
  }

  return table.where('dateKey').between(startDateKey, endDateKey, true, true).toArray()
}

export async function loadAvailableDateKeys() {
  const database = getDb()
  if (!database) {
    return []
  }

  const days = await database.days.orderBy('dateKey').toArray()
  return days.map((day) => day.dateKey)
}

export async function loadStatsData({ startDateKey, endDateKey, allTime = false } = {}) {
  const database = getDb()
  if (!database) {
    return {
      days: [],
      tableProgress: [],
      challengeAttempts: [],
      answerAttempts: []
    }
  }

  const [days, tableProgress, challengeAttempts, answerAttempts] = await Promise.all([
    loadRowsForDateRange(database.days, { startDateKey, endDateKey, allTime }),
    loadRowsForDateRange(database.tableProgress, { startDateKey, endDateKey, allTime }),
    loadRowsForDateRange(database.challengeAttempts, { startDateKey, endDateKey, allTime }),
    loadRowsForDateRange(database.answerAttempts, { startDateKey, endDateKey, allTime })
  ])

  return {
    days,
    tableProgress,
    challengeAttempts,
    answerAttempts
  }
}

export async function startChallengeAttempt({ dateKey, table, questionOrder, maxTimeMs }) {
  const database = getDb()
  if (!database) {
    return null
  }

  const startedAt = nowMs()
  const row = {
    id: createId(),
    dateKey,
    table,
    questionOrder: Array.isArray(questionOrder) ? [...questionOrder] : [],
    status: 'running',
    startedAt,
    endedAt: null,
    maxTimeMs,
    completedCount: 0
  }

  await database.transaction('rw', database.days, database.challengeAttempts, async () => {
    await touchDay(dateKey, startedAt)
    await database.challengeAttempts.put(row)
  })

  return row
}

export async function recordAnswerAttempt(answerAttempt) {
  const database = getDb()
  if (!database || !answerAttempt?.attemptId) {
    return null
  }

  const answeredAt = answerAttempt.answeredAt ?? nowMs()
  const row = {
    id: answerAttempt.id || createId(),
    attemptId: answerAttempt.attemptId,
    dateKey: answerAttempt.dateKey,
    table: answerAttempt.table,
    multiplier: answerAttempt.multiplier,
    questionIndex: answerAttempt.questionIndex,
    expectedAnswer: answerAttempt.expectedAnswer,
    submittedAnswer: answerAttempt.submittedAnswer ?? null,
    outcome: answerAttempt.outcome,
    failureType: answerAttempt.failureType ?? null,
    attemptStartedAt: answerAttempt.attemptStartedAt ?? answeredAt,
    answeredAt,
    durationMs: Math.max(0, Number(answerAttempt.durationMs) || 0),
    questionElapsedMs: Math.max(0, Number(answerAttempt.questionElapsedMs) || 0)
  }

  await database.transaction('rw', database.days, database.answerAttempts, async () => {
    await touchDay(row.dateKey, answeredAt)
    await database.answerAttempts.put(row)
  })

  return row
}

export async function finishChallengeAttempt({ attemptId, status, completedCount }) {
  const database = getDb()
  if (!database || !attemptId) {
    return null
  }

  const existing = await database.challengeAttempts.get(attemptId)
  if (!existing) {
    return null
  }

  const endedAt = nowMs()
  const row = {
    ...existing,
    status,
    completedCount: clampCount(completedCount),
    endedAt
  }

  await database.transaction('rw', database.days, database.challengeAttempts, async () => {
    await touchDay(existing.dateKey, endedAt)
    await database.challengeAttempts.put(row)
  })

  return row
}

export async function recordTableSuccess({ dateKey, table }) {
  const database = getDb()
  if (!database) {
    return null
  }

  const updatedAt = nowMs()
  let row

  await database.transaction('rw', database.days, database.tableProgress, async () => {
    await touchDay(dateKey, updatedAt)
    const existing = await database.tableProgress.get([dateKey, table])
    const previous = buildProgressRecord(table, existing)
    const nextStreak = previous.streak + 1

    row = createProgressRow(
      dateKey,
      table,
      {
        completions: previous.completions + 1,
        streak: nextStreak,
        starUnlocked: true,
        trophyUnlocked: previous.trophyUnlocked || nextStreak >= 2
      },
      updatedAt
    )

    await database.tableProgress.put(row)
  })

  return row
}

export async function recordTableFailure({ dateKey, table }) {
  const database = getDb()
  if (!database) {
    return null
  }

  const updatedAt = nowMs()
  let row = null

  await database.transaction('rw', database.days, database.tableProgress, async () => {
    await touchDay(dateKey, updatedAt)
    const existing = await database.tableProgress.get([dateKey, table])
    if (!existing) {
      return
    }

    row = createProgressRow(
      dateKey,
      table,
      {
        completions: existing.completions,
        streak: 0,
        starUnlocked: Boolean(existing.starUnlocked || existing.completions >= 1 || existing.trophyUnlocked),
        trophyUnlocked: Boolean(existing.trophyUnlocked)
      },
      updatedAt
    )

    await database.tableProgress.put(row)
  })

  return row
}

export async function migrateLegacyProgressIfNeeded(dateKey) {
  if (!isBrowser()) {
    return false
  }

  const migrationDone = readStorageItem(window.localStorage, MIGRATION_FLAG_KEY)
  if (migrationDone === '1') {
    return false
  }

  const legacyProgress = collectLegacyProgress()
  if (Object.keys(legacyProgress).length === 0) {
    setStorageItem(window.localStorage, MIGRATION_FLAG_KEY, '1')
    return false
  }

  const database = getDb()
  if (!database) {
    return false
  }

  const updatedAt = nowMs()

  await database.transaction('rw', database.days, database.tableProgress, async () => {
    await touchDay(dateKey, updatedAt)

    const existingRows = await database.tableProgress.where('dateKey').equals(dateKey).toArray()
    const existingProgress = existingRows.reduce((accumulator, row) => {
      accumulator[row.table] = {
        completions: row.completions,
        streak: row.streak,
        starUnlocked: row.starUnlocked,
        trophyUnlocked: row.trophyUnlocked
      }
      return accumulator
    }, {})

    const mergedProgress = mergeProgressMaps(existingProgress, legacyProgress)
    const rows = Object.entries(mergedProgress).map(([tableKey, value]) =>
      createProgressRow(dateKey, Number(tableKey), value, updatedAt)
    )

    if (rows.length > 0) {
      await database.tableProgress.bulkPut(rows)
    }
  })

  setStorageItem(window.localStorage, MIGRATION_FLAG_KEY, '1')
  removeStorageItem(window.sessionStorage, TABLE_PROGRESS_KEY)
  removeStorageItem(window.localStorage, TABLE_PROGRESS_KEY)
  removeStorageItem(window.sessionStorage, LEGACY_COMPLETED_TABLES_KEY)
  removeStorageItem(window.localStorage, LEGACY_COMPLETED_TABLES_KEY)

  return true
}
