<script>
  import { onDestroy, onMount, tick } from 'svelte'
  import confetti from 'canvas-confetti'
  import {
    ensureDayDataset,
    finishChallengeAttempt,
    getTodayDateKey,
    loadAvailableDateKeys,
    loadDayProgress,
    loadStatsData,
    migrateLegacyProgressIfNeeded,
    recordAnswerAttempt,
    recordTableFailure,
    recordTableSuccess,
    startChallengeAttempt
  } from './lib/db.js'
  import {
    DEFAULT_STATS_SORT,
    buildStatsSummary,
    challengeStatusLabels,
    createEmptyStatsData,
    sortFailureRows
  } from './lib/stats.js'

  const TABLES = Array.from({ length: 12 }, (_, i) => i + 1)
  const MULTIPLIERS = Array.from({ length: 10 }, (_, i) => i + 1)
  const MAX_TIME = 40
  const MAX_TIME_MS = MAX_TIME * 1000
  const NUMPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  const MAX_RESPONSE_DIGITS = 3
  const IDLE_STATUS_MESSAGE = 'Elige una tabla y presiona comenzar.'
  const CHALLENGE_STATUS_LEGEND = ['success', 'timeout', 'reset', 'running']

  const applauseMessages = [
    '¡Brillas como un sol!',
    '¡Esa respuesta fue de campeona!',
    '¡Súper memoria, Dani!',
    '¡La Instax Mini 12 ya te está guiñando el ojo!',
    '¡Exacto! Tu cerebro es pura chispa.'
  ]

  const retryMessages = [
    'Respira hondo y vuelve a intentarlo.',
    'Piensa en grupos de objetos, ¡tú puedes!',
    'Casi, revisa el cálculo con calma.',
    'Imagina los puntos de colores y suma otra vez.',
    'No pasa nada, estamos practicando.'
  ]

  let selectedTable = 7
  let questions = []
  let currentIndex = 0
  let answer = ''
  let timeLeft = MAX_TIME
  let status = 'idle' // idle | running | success | timeout
  let statusMessage = IDLE_STATUS_MESSAGE
  let intervalId
  let screen = 'intro' // intro | reto | stats
  let practiceFactor = MULTIPLIERS[0]
  let practiceAnswer = ''
  let practiceMessage = 'Escribe la respuesta y presiona comprobar.'
  let errorAnimation = false
  let successAnimation = false
  let errorTimer
  let successTimer
  let tableProgress = {}
  let todayDateKey = ''
  let progressLoading = true
  let activeAttemptId = null
  let challengeStartedAt = null
  let currentQuestionStartedAt = null
  let currentAnswerStartedAt = null
  let finalizingAttempt = false
  let progressInitFailed = false
  let progressSyncPromise = null
  let dayWatcherId
  let statsRangeMode = 'day'
  let statsStartDate = ''
  let statsEndDate = ''
  let statsRows = createEmptyStatsData()
  let statsLoading = false
  let statsError = ''
  let statsSort = { ...DEFAULT_STATS_SORT }
  let availableDateKeys = []

  const metaDescription = 'Te hice esta página para que practiques! Completa cada tabla en menos de 40 segundos para demostrar que lograrás ganarte tu premio 📷'

  $: statsSummary = buildStatsSummary(statsRows, TABLES, MULTIPLIERS)
  $: practicedFailureRows = statsSummary.pairRows.filter((row) => row.totalAttempts > 0)
  $: sortedFailureRows = sortFailureRows(practicedFailureRows, statsSort)
  $: statsRangeLabel = formatStatsRangeLabel(statsRangeMode, statsStartDate, statsEndDate)
  $: completedTables = new Set(
    Object.entries(tableProgress)
      .filter(([, progress]) => progress?.starUnlocked || progress?.completions >= 1 || progress?.trophyUnlocked)
      .map(([table]) => Number(table))
  )
  $: trophyTables = new Set(
    Object.entries(tableProgress)
      .filter(([, progress]) => progress?.trophyUnlocked)
      .map(([table]) => Number(table))
  )

  function launchConfetti() {
    if (typeof window === 'undefined') return
    const base = { particleCount: 80, spread: 70, startVelocity: 40, scalar: 0.85 }
    confetti({ ...base, origin: { x: 0.2, y: 0.6 }, colors: ['#ff8fab', '#ffd6a5', '#8fd3fe', '#a5e8ff'] })
    confetti({ ...base, origin: { x: 0.8, y: 0.6 }, colors: ['#845ef7', '#f783ac', '#ffb347', '#7e6bff'] })
  }

  function generateNewPractice() {
    practiceFactor = MULTIPLIERS[Math.floor(Math.random() * MULTIPLIERS.length)]
    practiceAnswer = ''
    practiceMessage = 'Piensa en grupos de objetos y escribe el resultado.'
  }

  function verifyPractice() {
    const value = parseSafeNumber(practiceAnswer)
    if (value === null) {
      practiceMessage = 'Escribe un número para comprobar la respuesta.'
      return
    }

    const expected = selectedTable * practiceFactor
    practiceMessage =
      value === expected
        ? '¡Perfecto! Pide otro ejercicio y sigue practicando.'
        : 'Revisa la multiplicación con calma e inténtalo otra vez.'
  }

  function handlePracticeKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      verifyPractice()
    }
  }

  function parseSafeNumber(value) {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') {
      return Number.isNaN(value) ? null : value
    }
    const text = `${value}`.trim()
    if (text === '') return null
    const parsed = Number(text)
    return Number.isNaN(parsed) ? null : parsed
  }

  function appendDigit(digit) {
    if (status !== 'running' || finalizingAttempt) return
    if (answer.length >= MAX_RESPONSE_DIGITS) return
    const next = `${answer}${digit}`
    answer = next.replace(/^0+(?=\d)/, '')
  }

  function removeDigit() {
    if (!answer || finalizingAttempt) return
    answer = answer.slice(0, -1)
  }

  function clearAnswer() {
    if (finalizingAttempt) return
    answer = ''
  }

  async function triggerAnimation(type) {
    if (type === 'error') {
      errorAnimation = false
      await tick()
      errorAnimation = true
      if (errorTimer) {
        clearTimeout(errorTimer)
      }
      errorTimer = setTimeout(() => {
        errorAnimation = false
        errorTimer = undefined
      }, 600)
      return
    }

    if (type === 'success') {
      successAnimation = false
      await tick()
      successAnimation = true
      if (successTimer) {
        clearTimeout(successTimer)
      }
      successTimer = setTimeout(() => {
        successAnimation = false
        successTimer = undefined
      }, 650)
    }
  }

  function shuffle(array) {
    return array
      .map((value) => ({ value, order: Math.random() }))
      .sort((a, b) => a.order - b.order)
      .map(({ value }) => value)
  }

  function clearIntervalTimer() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = undefined
    }
  }

  function clearAttemptState() {
    activeAttemptId = null
    challengeStartedAt = null
    currentQuestionStartedAt = null
    currentAnswerStartedAt = null
  }

  function resetChallengeUi() {
    clearIntervalTimer()
    questions = []
    currentIndex = 0
    answer = ''
    timeLeft = MAX_TIME
    errorAnimation = false
    successAnimation = false
    clearAttemptState()
  }

  async function initializeProgress() {
    if (typeof window === 'undefined') {
      progressLoading = false
      return
    }

    await syncTodayProgress({ force: true })
  }

  async function syncTodayProgress({ force = false } = {}) {
    if (typeof window === 'undefined') {
      progressLoading = false
      return false
    }

    if (progressSyncPromise) {
      return progressSyncPromise
    }

    const syncTask = (async () => {
      const nextDateKey = getTodayDateKey()
      if (!force && nextDateKey === todayDateKey && !progressLoading && !progressInitFailed) {
        return true
      }

      progressLoading = true

      try {
        await ensureDayDataset(nextDateKey)
        await migrateLegacyProgressIfNeeded(nextDateKey)
        const nextProgress = await loadDayProgress(nextDateKey)
        todayDateKey = nextDateKey
        tableProgress = nextProgress
        progressInitFailed = false
        if (screen === 'intro' && status !== 'running') {
          status = 'idle'
          statusMessage = IDLE_STATUS_MESSAGE
        }
        return true
      } catch (error) {
        console.warn('No se pudo cargar el progreso diario desde IndexedDB.', error)
        todayDateKey = ''
        tableProgress = {}
        progressInitFailed = true
        status = 'idle'
        statusMessage = 'No se pudo cargar el progreso de hoy. Intenta otra vez.'
        return false
      } finally {
        progressLoading = false
      }
    })()

    progressSyncPromise = syncTask

    try {
      return await syncTask
    } finally {
      if (progressSyncPromise === syncTask) {
        progressSyncPromise = null
      }
    }
  }

  async function refreshDayProgress() {
    if (!todayDateKey) return

    try {
      tableProgress = await loadDayProgress(todayDateKey)
    } catch (error) {
      console.warn('No se pudo refrescar el progreso diario.', error)
    }
  }

  async function refreshVisibleDayIfNeeded() {
    if (screen !== 'intro' || status === 'running' || finalizingAttempt) {
      return false
    }

    if (progressInitFailed || !todayDateKey || getTodayDateKey() !== todayDateKey) {
      return syncTodayProgress({ force: progressInitFailed || !todayDateKey })
    }

    return true
  }

  function ensureStatsDateDefaults() {
    const dateKey = todayDateKey || getTodayDateKey()

    if (!statsStartDate) {
      statsStartDate = dateKey
    }

    if (!statsEndDate) {
      statsEndDate = statsStartDate
    }
  }

  function getStatsRange() {
    ensureStatsDateDefaults()

    if (statsRangeMode === 'all') {
      return {
        allTime: true,
        startDateKey: null,
        endDateKey: null
      }
    }

    if (statsRangeMode === 'range') {
      const start = statsStartDate <= statsEndDate ? statsStartDate : statsEndDate
      const end = statsStartDate <= statsEndDate ? statsEndDate : statsStartDate

      return {
        allTime: false,
        startDateKey: start,
        endDateKey: end
      }
    }

    return {
      allTime: false,
      startDateKey: statsStartDate,
      endDateKey: statsStartDate
    }
  }

  async function loadStatsView() {
    if (typeof window === 'undefined') return

    statsLoading = true
    statsError = ''

    try {
      const range = getStatsRange()
      const [dateKeys, data] = await Promise.all([
        loadAvailableDateKeys(),
        loadStatsData(range)
      ])

      availableDateKeys = dateKeys
      statsRows = data
    } catch (error) {
      console.warn('No se pudieron cargar las estadísticas.', error)
      statsRows = createEmptyStatsData()
      statsError = 'No se pudieron cargar las estadísticas.'
    } finally {
      statsLoading = false
    }
  }

  async function openStats() {
    if (!todayDateKey || getTodayDateKey() !== todayDateKey) {
      await syncTodayProgress()
    }

    statsRangeMode = 'day'
    statsStartDate = todayDateKey || getTodayDateKey()
    statsEndDate = statsStartDate
    screen = 'stats'
    await loadStatsView()
  }

  async function goBackToIntroFromStats() {
    if (!todayDateKey || getTodayDateKey() !== todayDateKey) {
      await syncTodayProgress()
    }

    screen = 'intro'
  }

  function setStatsRangeMode(mode) {
    statsRangeMode = mode
    ensureStatsDateDefaults()

    if (mode === 'day') {
      statsEndDate = statsStartDate
    }

    if (mode === 'range' && !statsEndDate) {
      statsEndDate = statsStartDate
    }

    void loadStatsView()
  }

  function selectStatsDay(dateKey) {
    statsRangeMode = 'day'
    statsStartDate = dateKey
    statsEndDate = dateKey
    void loadStatsView()
  }

  function setFailureSort(key) {
    const ascendingDefaults = ['problem', 'avgCorrectMs', 'avgFailureMs']
    const direction =
      statsSort.key === key
        ? statsSort.direction === 'asc'
          ? 'desc'
          : 'asc'
        : ascendingDefaults.includes(key)
          ? 'asc'
          : 'desc'

    statsSort = { key, direction }
  }

  function getSortMarker(key) {
    if (statsSort.key !== key) return ''
    return statsSort.direction === 'asc' ? ' ↑' : ' ↓'
  }

  function formatPercent(value) {
    if (value === null || value === undefined) return '--'
    return `${Math.round(value * 100)}%`
  }

  function formatDuration(value) {
    if (value === null || value === undefined) return '--'

    const seconds = value / 1000
    if (seconds >= 10) {
      return `${Math.round(seconds)} s`
    }

    return `${seconds.toFixed(1)} s`
  }

  function formatDateKey(dateKey) {
    if (!dateKey) return '--'

    const [year, month, day] = dateKey.split('-').map(Number)
    if (!year || !month || !day) return dateKey

    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(year, month - 1, day))
  }

  function formatStatsRangeLabel(mode, startDateKey, endDateKey) {
    if (mode === 'all') {
      return 'Todo el historial'
    }

    if (!startDateKey) {
      return '--'
    }

    if (mode !== 'range' || !endDateKey || startDateKey === endDateKey) {
      return formatDateKey(startDateKey)
    }

    const start = startDateKey <= endDateKey ? startDateKey : endDateKey
    const end = startDateKey <= endDateKey ? endDateKey : startDateKey

    return `${formatDateKey(start)} - ${formatDateKey(end)}`
  }

  function formatTableTitle(stats) {
    return stats ? `Tabla del ${stats.table}` : 'Sin datos'
  }

  function formatPairTitle(pair) {
    return pair ? `${pair.table} × ${pair.multiplier}` : 'Sin errores'
  }

  function formatCommonWrongAnswer(pair) {
    if (!pair?.commonWrongAnswer) {
      return '--'
    }

    return `${pair.commonWrongAnswer} (${pair.commonWrongAnswerCount})`
  }

  function formatChallengeStatus(status) {
    return challengeStatusLabels[status] ?? challengeStatusLabels.unknown
  }

  function formatChallengeAttemptLabel(attempt, table) {
    const number = attempt?.number ?? '?'
    const status = formatChallengeStatus(attempt?.status)
    const completed = Number.isFinite(attempt?.completedCount) ? attempt.completedCount : 0
    const date = attempt?.dateKey ? ` · ${formatDateKey(attempt.dateKey)}` : ''

    return `Tabla del ${table}, intento ${number}: ${status}, ${completed}/${MULTIPLIERS.length} respuestas${date}`
  }

  function getAnswerTiming(now) {
    const answerStartedAt = currentAnswerStartedAt ?? currentQuestionStartedAt ?? challengeStartedAt ?? now
    const questionStartedAt = currentQuestionStartedAt ?? challengeStartedAt ?? answerStartedAt

    return {
      answerStartedAt,
      questionStartedAt
    }
  }

  function buildAnswerAttemptPayload({
    question,
    questionIndex,
    submittedAnswer,
    outcome,
    failureType,
    answeredAt = Date.now()
  }) {
    const { answerStartedAt, questionStartedAt } = getAnswerTiming(answeredAt)

    return {
      attemptId: activeAttemptId,
      dateKey: todayDateKey,
      table: selectedTable,
      multiplier: question.b,
      questionIndex,
      expectedAnswer: question.a * question.b,
      submittedAnswer,
      outcome,
      failureType,
      attemptStartedAt: answerStartedAt,
      answeredAt,
      durationMs: Math.max(0, answeredAt - answerStartedAt),
      questionElapsedMs: Math.max(0, answeredAt - questionStartedAt)
    }
  }

  async function persistAnswerAttempt(payload) {
    if (!activeAttemptId || !todayDateKey) {
      return false
    }

    try {
      await recordAnswerAttempt(payload)
      return true
    } catch (error) {
      console.warn('No se pudo guardar un intento de respuesta.', error)
      return false
    }
  }

  async function finalizeActiveChallenge({ attemptStatus, succeeded, terminalFailureType = null }) {
    if (finalizingAttempt) {
      return false
    }

    finalizingAttempt = true
    clearIntervalTimer()

    try {
      const finishedAt = Date.now()
      const questionSnapshot = currentQuestion
      const questionIndex = currentIndex
      const completedCount = succeeded ? questions.length : currentIndex
      const attemptId = activeAttemptId
      const table = selectedTable
      const dateKey = todayDateKey

      if (!succeeded && terminalFailureType && questionSnapshot) {
        const recorded = await persistAnswerAttempt(
          buildAnswerAttemptPayload({
            question: questionSnapshot,
            questionIndex,
            submittedAnswer: null,
            outcome: 'terminal_failure',
            failureType: terminalFailureType,
            answeredAt: finishedAt
          })
        )
        if (!recorded) {
          handleChallengeStartFailure('No se pudo cerrar el reto correctamente. Intenta otra vez.')
          return false
        }
      }

      if (attemptId) {
        try {
          await finishChallengeAttempt({
            attemptId,
            status: attemptStatus,
            completedCount
          })
        } catch (error) {
          console.warn('No se pudo cerrar el intento del reto.', error)
          handleChallengeStartFailure('No se pudo cerrar el reto correctamente. Intenta otra vez.')
          return false
        }
      }

      if (dateKey) {
        try {
          if (succeeded) {
            await recordTableSuccess({ dateKey, table })
          } else {
            await recordTableFailure({ dateKey, table })
          }
          await refreshDayProgress()
        } catch (error) {
          console.warn('No se pudo actualizar el progreso de la tabla.', error)
          handleChallengeStartFailure('No se pudo guardar el progreso del reto. Intenta otra vez.')
          return false
        }
      }

      clearAttemptState()
      return true
    } finally {
      finalizingAttempt = false
    }
  }

  function handleChallengeStartFailure(message) {
    resetChallengeUi()
    status = 'idle'
    statusMessage = message
  }

  async function startChallenge() {
    if (progressLoading || finalizingAttempt) return false

    if (status === 'running') {
      const finalized = await finalizeActiveChallenge({
        attemptStatus: 'reset',
        succeeded: false,
        terminalFailureType: 'reset_final'
      })
      if (!finalized) {
        return false
      }
    }

    if (!todayDateKey || getTodayDateKey() !== todayDateKey || progressInitFailed) {
      const synced = await syncTodayProgress({ force: progressInitFailed || !todayDateKey })
      if (!synced) {
        handleChallengeStartFailure('No se pudo cargar el progreso de hoy. Intenta otra vez.')
        return false
      }
    }

    const questionOrder = shuffle(MULTIPLIERS)
    let attempt = null

    try {
      attempt = await startChallengeAttempt({
        dateKey: todayDateKey,
        table: selectedTable,
        questionOrder,
        maxTimeMs: MAX_TIME_MS
      })
    } catch (error) {
      console.warn('No se pudo iniciar el intento en IndexedDB.', error)
    }

    if (!attempt?.id) {
      handleChallengeStartFailure('No se pudo iniciar el registro del reto. Intenta otra vez.')
      return false
    }

    const startedAt = Date.now()

    questions = questionOrder.map((multiplier) => ({
      a: selectedTable,
      b: multiplier
    }))
    currentIndex = 0
    answer = ''
    timeLeft = MAX_TIME
    status = 'running'
    statusMessage = '¡Vamos, Daniela! Escucha tu ritmo y responde con calma.'
    errorAnimation = false
    successAnimation = false
    activeAttemptId = attempt?.id ?? null
    challengeStartedAt = startedAt
    currentQuestionStartedAt = startedAt
    currentAnswerStartedAt = startedAt

    clearIntervalTimer()
    intervalId = setInterval(() => {
      timeLeft -= 1
      if (timeLeft <= 0) {
        timeLeft = 0
        void finishChallenge(false)
      }
    }, 1000)

    return true
  }

  async function beginChallenge() {
    if (progressLoading || finalizingAttempt) return

    const started = await startChallenge()
    if (started) {
      screen = 'reto'
    }
  }

  async function finishChallenge(succeeded) {
    if (status !== 'running' || finalizingAttempt) {
      return
    }

    status = succeeded ? 'success' : 'timeout'
    statusMessage = succeeded
      ? '¡Tabla completa! Ese Instax Mini 12 ya te “mira” con cariño.'
      : 'El tiempo terminó, pero tu constancia es la magia. ¡Vamos de nuevo!'

    if (succeeded) {
      launchConfetti()
    }

    await finalizeActiveChallenge({
      attemptStatus: succeeded ? 'success' : 'timeout',
      succeeded,
      terminalFailureType: succeeded ? null : 'timeout_final'
    })
  }

  $: currentQuestion = questions[currentIndex]
  $: progress = questions.length ? Math.round((currentIndex / questions.length) * 100) : 0
  $: timePercentage = Math.max(0, Math.round((timeLeft / MAX_TIME) * 100))

  async function submitAnswer() {
    if (status !== 'running' || !currentQuestion || finalizingAttempt) return

    const value = parseSafeNumber(answer)
    if (value === null) {
      statusMessage = 'Escribe un número para que la magia funcione.'
      return
    }

    const questionSnapshot = currentQuestion
    const questionIndex = currentIndex
    const answeredAt = Date.now()
    const expected = questionSnapshot.a * questionSnapshot.b

    if (value === expected) {
      const recorded = await persistAnswerAttempt(
        buildAnswerAttemptPayload({
          question: questionSnapshot,
          questionIndex,
          submittedAnswer: value,
          outcome: 'correct',
          failureType: null,
          answeredAt
        })
      )
      if (!recorded) {
        handleChallengeStartFailure('No se pudo guardar tu respuesta. Intenta otra vez.')
        return
      }

      currentIndex += 1
      answer = ''
      void triggerAnimation('success')
      statusMessage = applauseMessages[Math.floor(Math.random() * applauseMessages.length)]

      if (currentIndex >= questions.length) {
        await finishChallenge(true)
        return
      }

      currentQuestionStartedAt = answeredAt
      currentAnswerStartedAt = answeredAt
      return
    }

    const recorded = await persistAnswerAttempt(
      buildAnswerAttemptPayload({
        question: questionSnapshot,
        questionIndex,
        submittedAnswer: value,
        outcome: 'incorrect',
        failureType: 'wrong_answer',
        answeredAt
      })
    )
    if (!recorded) {
      handleChallengeStartFailure('No se pudo guardar tu respuesta. Intenta otra vez.')
      return
    }

    statusMessage = retryMessages[Math.floor(Math.random() * retryMessages.length)]
    answer = ''
    currentAnswerStartedAt = answeredAt
    void triggerAnimation('error')
  }

  onMount(() => {
    void initializeProgress()

    const handleGlobalKeys = (event) => {
      if (screen !== 'reto' || status !== 'running' || finalizingAttempt) return
      if (/^\d$/.test(event.key)) {
        event.preventDefault()
        appendDigit(event.key)
        return
      }
      if (event.key === 'Backspace') {
        event.preventDefault()
        removeDigit()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        void submitAnswer()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        clearAnswer()
      }
    }

    const handleWindowFocus = () => {
      void refreshVisibleDayIfNeeded()
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refreshVisibleDayIfNeeded()
      }
    }

    dayWatcherId = setInterval(() => {
      void refreshVisibleDayIfNeeded()
    }, 60_000)

    window.addEventListener('keydown', handleGlobalKeys)
    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeys)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (dayWatcherId) {
        clearInterval(dayWatcherId)
        dayWatcherId = undefined
      }
    }
  })

  async function goBackToIntro() {
    if (finalizingAttempt) return

    if (status === 'running') {
      const finalized = await finalizeActiveChallenge({
        attemptStatus: 'reset',
        succeeded: false,
        terminalFailureType: 'reset_final'
      })
      if (!finalized) {
        screen = 'intro'
        generateNewPractice()
        return
      }
    }

    status = 'idle'
    screen = 'intro'
    resetChallengeUi()
    generateNewPractice()

    if (!todayDateKey || getTodayDateKey() !== todayDateKey || progressInitFailed) {
      const synced = await syncTodayProgress({ force: progressInitFailed || !todayDateKey })
      if (!synced) {
        return
      }
    }

    statusMessage = IDLE_STATUS_MESSAGE
  }

  onDestroy(() => {
    clearIntervalTimer()
    if (errorTimer) {
      clearTimeout(errorTimer)
    }
    if (successTimer) {
      clearTimeout(successTimer)
    }
  })

  generateNewPractice()
</script>

<main>
  {#if screen === 'intro'}
    <section class="hero hero-intro">
      <p class="saludo">¡Hola Daniela! 🌈</p>
      <h3>Reto de Multiplicaciones</h3>
      <p class="meta">{metaDescription}</p>
    </section>

    <section class="panel intro-panel">
      <div class="intro-grid">
        <article class="intro-card selector-card">
          <h2>Elige tu tabla favorita</h2>
          <p>Escoge la tabla que quieres dominar hoy. Practica primero, luego corre contra el reloj.</p>
          <div class="tab-grid" aria-label="Selecciona la tabla que quieres practicar">
            {#each TABLES as table}
              {@const completed = completedTables.has(table)}
              {@const trophy = trophyTables.has(table)}
              <button
                type="button"
                class:selected={table === selectedTable}
                class:completed={completed}
                class:trophy={trophy}
                disabled={progressLoading || finalizingAttempt}
                on:click={() => (selectedTable = table)}
                aria-label={`Tabla del ${table}${trophy ? ' con trofeo' : completed ? ' completada' : ''}`}
              >
                × {table}
                {#if completed}
                  <span class="tab-check" class:trophy={trophy} aria-hidden="true">
                    {trophy ? '🏆' : '★'}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        </article>
      </div>

      <div class="intro-actions">
        <div>
          <p class="mini">Duración del reto</p>
          <strong>{MAX_TIME} segundos</strong>
          {#if progressLoading}
            <p class="mini">Cargando progreso de hoy...</p>
          {/if}
          {#if !progressLoading && statusMessage !== IDLE_STATUS_MESSAGE}
            <p class="mini" aria-live="polite">{statusMessage}</p>
          {/if}
        </div>
        <div class="intro-button-stack">
          <button
            class="boton-accion grande"
            type="button"
            disabled={progressLoading || finalizingAttempt}
            on:click={beginChallenge}
          >
            Comenzar reto
          </button>
          <button
            class="boton-accion secundario grande"
            type="button"
            disabled={progressLoading || finalizingAttempt}
            on:click={openStats}
          >
            Estadísticas
          </button>
        </div>
      </div>
    </section>
  {:else if screen === 'stats'}
    <section class="panel stats-panel">
      <header class="stats-header">
        <div>
          <p class="mini">Panel familiar</p>
          <h2>Estadísticas</h2>
          <p>Rendimiento de {statsRangeLabel}</p>
        </div>
        <button class="boton-link" type="button" on:click={goBackToIntroFromStats}>Volver al reto</button>
      </header>

      <div class="stats-controls" aria-label="Filtros de estadísticas">
        <div class="segmented-control" role="group" aria-label="Rango de fechas">
          <button
            type="button"
            class:selected={statsRangeMode === 'day'}
            on:click={() => setStatsRangeMode('day')}
          >
            Día
          </button>
          <button
            type="button"
            class:selected={statsRangeMode === 'range'}
            on:click={() => setStatsRangeMode('range')}
          >
            Rango
          </button>
          <button
            type="button"
            class:selected={statsRangeMode === 'all'}
            on:click={() => setStatsRangeMode('all')}
          >
            Todo
          </button>
        </div>

        {#if statsRangeMode !== 'all'}
          <label class="date-field">
            <span>{statsRangeMode === 'range' ? 'Desde' : 'Día'}</span>
            <input type="date" bind:value={statsStartDate} on:change={loadStatsView} />
          </label>
        {/if}

        {#if statsRangeMode === 'range'}
          <label class="date-field">
            <span>Hasta</span>
            <input type="date" bind:value={statsEndDate} on:change={loadStatsView} />
          </label>
        {/if}

        <button class="boton-simple stats-refresh" type="button" disabled={statsLoading} on:click={loadStatsView}>
          Actualizar
        </button>
      </div>

      {#if availableDateKeys.length > 0}
        <div class="date-chip-row" aria-label="Días con datos">
          {#each availableDateKeys.slice(-7).reverse() as dateKey}
            <button
              type="button"
              class:selected={statsRangeMode === 'day' && statsStartDate === dateKey}
              on:click={() => selectStatsDay(dateKey)}
            >
              {formatDateKey(dateKey)}
            </button>
          {/each}
        </div>
      {/if}

      {#if statsLoading}
        <p class="estado-actual">Calculando estadísticas...</p>
      {:else if statsError}
        <p class="estado-actual">{statsError}</p>
      {:else}
        <div class="stats-kpi-grid">
          <article>
            <span>Retos completos</span>
            <strong>{statsSummary.totals.successfulChallenges}/{statsSummary.totals.finishedChallenges}</strong>
            <small>{formatPercent(statsSummary.totals.challengeSuccessRate)} terminados con éxito</small>
          </article>
          <article>
            <span>Precisión</span>
            <strong>{formatPercent(statsSummary.totals.accuracyRate)}</strong>
            <small>{statsSummary.totals.correct}/{statsSummary.totals.submittedAnswers} respuestas enviadas</small>
          </article>
          <article>
            <span>Dominio</span>
            <strong>{formatPercent(statsSummary.totals.masteryRate)}</strong>
            <small>Incluye errores, tiempo agotado y reinicios</small>
          </article>
          <article>
            <span>Tiempo promedio</span>
            <strong>{formatDuration(statsSummary.totals.avgCorrectMs)}</strong>
            <small>En respuestas correctas</small>
          </article>
          <article>
            <span>Cobertura</span>
            <strong>{statsSummary.practicedPairCount}/{statsSummary.totalPairCount}</strong>
            <small>Multiplicaciones practicadas</small>
          </article>
        </div>

        <div class="insight-grid">
          <article>
            <span>Más fuerte</span>
            <strong>{formatTableTitle(statsSummary.bestTable)}</strong>
            <small>{formatPercent(statsSummary.bestTable?.masteryRate)} dominio</small>
          </article>
          <article>
            <span>Para reforzar</span>
            <strong>{formatTableTitle(statsSummary.focusTable)}</strong>
            <small>{statsSummary.focusTable?.failures ?? 0} fallos registrados</small>
          </article>
          <article>
            <span>Más rápida</span>
            <strong>{formatTableTitle(statsSummary.fastestTable)}</strong>
            <small>{formatDuration(statsSummary.fastestTable?.avgCorrectMs)} por acierto</small>
          </article>
          <article>
            <span>Fallo común</span>
            <strong>{formatPairTitle(statsSummary.commonFailure)}</strong>
            <small>{statsSummary.commonFailure?.failures ?? 0} veces</small>
          </article>
        </div>

        <section class="stats-section">
          <div class="stats-section-header">
            <div>
              <p class="mini">Por tabla</p>
              <h3>Rendimiento general</h3>
            </div>
            <div class="attempt-legend" aria-label="Leyenda de intentos">
              {#each CHALLENGE_STATUS_LEGEND as challengeStatus}
                <span>
                  <i class={`challenge-dot ${challengeStatus}`} aria-hidden="true"></i>
                  {formatChallengeStatus(challengeStatus)}
                </span>
              {/each}
            </div>
          </div>

          <div class="table-performance-grid">
            {#each statsSummary.tableRows as tableStats}
              <article class:empty={tableStats.opportunities === 0 && tableStats.challenges === 0}>
                <div class="table-stat-top">
                  <strong>× {tableStats.table}</strong>
                  <span>{formatPercent(tableStats.masteryRate)}</span>
                </div>
                <div class="table-stat-meter" aria-hidden="true">
                  <div style={`width: ${Math.round((tableStats.masteryRate ?? 0) * 100)}%`}></div>
                </div>
                {#if tableStats.challengeHistory.length > 0}
                  <ol class="challenge-timeline" aria-label={`Intentos de la tabla del ${tableStats.table}`}>
                    {#each tableStats.challengeHistory as attempt}
                      <li>
                        <span
                          class={`challenge-dot ${attempt.status}`}
                          role="img"
                          aria-label={formatChallengeAttemptLabel(attempt, tableStats.table)}
                          title={formatChallengeAttemptLabel(attempt, tableStats.table)}
                        ></span>
                      </li>
                    {/each}
                  </ol>
                {/if}
                <dl>
                  <div>
                    <dt>Retos</dt>
                    <dd>{tableStats.successfulChallenges}/{tableStats.finishedChallenges}</dd>
                  </div>
                  <div>
                    <dt>Aciertos</dt>
                    <dd>{tableStats.correct}</dd>
                  </div>
                  <div>
                    <dt>Fallos</dt>
                    <dd>{tableStats.failures}</dd>
                  </div>
                  <div>
                    <dt>Tiempo</dt>
                    <dd>{formatDuration(tableStats.avgCorrectMs)}</dd>
                  </div>
                </dl>
                <p>
                  {#if tableStats.commonFailure}
                    Falla más: {formatPairTitle(tableStats.commonFailure)}
                  {:else if tableStats.opportunities > 0}
                    Sin fallos registrados
                  {:else}
                    Sin práctica todavía
                  {/if}
                </p>
              </article>
            {/each}
          </div>
        </section>

        <section class="stats-section">
          <div class="stats-section-header">
            <div>
              <p class="mini">Detalle</p>
              <h3>Multiplicaciones practicadas</h3>
            </div>
          </div>

          <div class="stats-table-wrap">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" on:click={() => setFailureSort('problem')}>
                      Multiplicación{getSortMarker('problem')}
                    </button>
                  </th>
                  <th>
                    <button type="button" on:click={() => setFailureSort('failures')}>
                      Fallos{getSortMarker('failures')}
                    </button>
                  </th>
                  <th>
                    <button type="button" on:click={() => setFailureSort('incorrect')}>
                      Errores{getSortMarker('incorrect')}
                    </button>
                  </th>
                  <th>
                    <button type="button" on:click={() => setFailureSort('terminalFailures')}>
                      Sin responder{getSortMarker('terminalFailures')}
                    </button>
                  </th>
                  <th>
                    <button type="button" on:click={() => setFailureSort('masteryRate')}>
                      Dominio{getSortMarker('masteryRate')}
                    </button>
                  </th>
                  <th>Respuesta común</th>
                  <th>
                    <button type="button" on:click={() => setFailureSort('avgCorrectMs')}>
                      Tiempo acierto{getSortMarker('avgCorrectMs')}
                    </button>
                  </th>
                  <th>
                    <button type="button" on:click={() => setFailureSort('lastSeenAt')}>
                      Última vez{getSortMarker('lastSeenAt')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {#if sortedFailureRows.length === 0}
                  <tr>
                    <td colspan="8">Sin intentos registrados para este período.</td>
                  </tr>
                {:else}
                  {#each sortedFailureRows as row}
                    <tr class:needs-focus={row.failures > 0 && (row.failureRate ?? 0) >= 0.5}>
                      <td><strong>{formatPairTitle(row)}</strong></td>
                      <td>{row.failures}</td>
                      <td>{row.incorrect}</td>
                      <td>{row.terminalFailures}</td>
                      <td>{formatPercent(row.masteryRate)}</td>
                      <td>{formatCommonWrongAnswer(row)}</td>
                      <td>{formatDuration(row.avgCorrectMs)}</td>
                      <td>{formatDateKey(row.lastSeenDateKey)}</td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </section>
      {/if}
    </section>
  {:else}
    <section class="panel reto-panel">
      <header class="reto-banner">
        <div class="reto-banner__info">
          <strong>Tabla del {selectedTable}</strong>
        </div>
        <div class="reto-banner__acciones">
          <button class="boton-link" type="button" disabled={finalizingAttempt} on:click={goBackToIntro}>
            Cambiar tabla
          </button>
        </div>
      </header>

      <div class="timer" aria-live="off">
        <div class="timer-bar">
          <div class="fill" style={`width: ${timePercentage}%`}></div>
        </div>
        <span>{timeLeft.toString().padStart(2, '0')} seg restantes</span>
      </div>

      <article class="question-box" class:error={errorAnimation} class:success={successAnimation}>
        {#if status === 'running' && currentQuestion}
          <p class="mini">Pregunta {currentIndex + 1} de {questions.length}</p>
          <div class="progress-area inline">
            <div class="progress-track">
              <div class="progress-fill" style={`width: ${progress}%`}></div>
            </div>
            <p>{progress}%</p>
          </div>
          <h2>{currentQuestion.a} × {currentQuestion.b} = ?</h2>
          <div class="answer-row">
            <div class="answer-pad">
              <div class="numpad-display" aria-live="polite" aria-label="Respuesta ingresada">
                <span class:placeholder={!answer}>{answer || '0'}</span>
                {#if answer}
                  <button type="button" class="display-clear" aria-label="Borrar respuesta" on:click={clearAnswer}>
                    ✕
                  </button>
                {/if}
              </div>
              <div class="numpad-grid" role="group" aria-label="Numpad para ingresar la respuesta">
                {#each NUMPAD_DIGITS as digit}
                  <button type="button" class="numpad-key" on:click={() => appendDigit(digit)}>
                    {digit}
                  </button>
                {/each}
                <button type="button" class="numpad-key action" on:click={clearAnswer}>
                  Limpiar
                </button>
                <button type="button" class="numpad-key cero" on:click={() => appendDigit('0')}>
                  0
                </button>
                <button type="button" class="numpad-key action" aria-label="Borrar último número" on:click={removeDigit}>
                  ⌫
                </button>
              </div>
              <button type="button" class="boton-accion secundario full" on:click={submitAnswer}>
                ¡Listo!
              </button>
            </div>
          </div>
        {:else if status === 'success'}
          <h2>¡Lo lograste!</h2>
          <p>
            Respondiste las {questions.length} multiplicaciones sin rendirte. La Instax Mini 12
            ya puede preparar un carrete pastelito.
          </p>
        {:else if status === 'timeout'}
          <h2>Tiempo fuera</h2>
          <p>
            El reloj llegó a cero, pero cada intento suma. Respira, revisa la tabla y prueba otra vez.
          </p>
        {:else}
          <h2>¿Listísima?</h2>
          <p>
            Pulsa "Intentar de nuevo" para generar 10 multiplicaciones en menos de {MAX_TIME} segundos
            y demuestra que ninguna tabla te gana.
          </p>
        {/if}
      </article>

      <p class="estado-actual" aria-live="polite">{statusMessage}</p>
      <button class="boton-accion grande" type="button" disabled={finalizingAttempt} on:click={startChallenge}>
        {status === 'running' ? 'Reiniciar reto' : 'Intentar de nuevo'}
      </button>
    </section>
  {/if}
</main>
