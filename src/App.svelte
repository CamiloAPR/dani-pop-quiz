<script>
  import { onDestroy, onMount, tick } from 'svelte'
  import confetti from 'canvas-confetti'

  const TABLES = Array.from({ length: 12 }, (_, i) => i + 1)
  const MULTIPLIERS = Array.from({ length: 10 }, (_, i) => i + 1)
  const MAX_TIME = 40
  const NUMPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  const MAX_RESPONSE_DIGITS = 3

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
  let statusMessage = 'Elige una tabla y presiona comenzar.'
  let intervalId
  let screen = 'intro' // intro | reto
  let practiceFactor = MULTIPLIERS[0]
  let practiceAnswer = ''
  let practiceMessage = 'Escribe la respuesta y presiona comprobar.'
  let errorAnimation = false
  let successAnimation = false
  let errorTimer
  let successTimer

  const metaDescription = 'Te hice esta página para que practiques! Completa cada tabla en menos de 40 segundos para demostrar que lograrás ganarte tu premio 📷'

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
    if (status !== 'running') return
    if (answer.length >= MAX_RESPONSE_DIGITS) return
    const next = `${answer}${digit}`
    answer = next.replace(/^0+(?=\d)/, '')
  }

  function removeDigit() {
    if (!answer) return
    answer = answer.slice(0, -1)
  }

  function clearAnswer() {
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

  function startChallenge() {
    questions = shuffle(MULTIPLIERS).map((multiplier) => ({
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
    clearIntervalTimer()
    intervalId = setInterval(() => {
      timeLeft -= 1
      if (timeLeft <= 0) {
        timeLeft = 0
        finishChallenge(false)
      }
    }, 1000)
  }

  async function beginChallenge() {
    screen = 'reto'
    await tick()
    startChallenge()
  }

  function finishChallenge(succeeded) {
    clearIntervalTimer()
    status = succeeded ? 'success' : 'timeout'
    statusMessage = succeeded
      ? '¡Tabla completa! Ese Instax Mini 12 ya te “mira” con cariño.'
      : 'El tiempo terminó, pero tu constancia es la magia. ¡Vamos de nuevo!'
    if (succeeded) {
      launchConfetti()
    }
  }

  $: currentQuestion = questions[currentIndex]
  $: progress = questions.length ? Math.round((currentIndex / questions.length) * 100) : 0
  $: timePercentage = Math.max(0, Math.round((timeLeft / MAX_TIME) * 100))

  function submitAnswer() {
    if (status !== 'running' || !currentQuestion) return

    const value = parseSafeNumber(answer)
    if (value === null) {
      statusMessage = 'Escribe un número para que la magia funcione.'
      return
    }

    const expected = currentQuestion.a * currentQuestion.b
    if (value === expected) {
      currentIndex += 1
      answer = ''
      triggerAnimation('success')
      statusMessage = applauseMessages[Math.floor(Math.random() * applauseMessages.length)]
      if (currentIndex >= questions.length) {
        finishChallenge(true)
      }
    } else {
      statusMessage = retryMessages[Math.floor(Math.random() * retryMessages.length)]
      answer = ''
      triggerAnimation('error')
    }
  }

  onMount(() => {
    const handleGlobalKeys = (event) => {
      if (screen !== 'reto' || status !== 'running') return
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
        submitAnswer()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        clearAnswer()
      }
    }

    window.addEventListener('keydown', handleGlobalKeys)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeys)
    }
  })

  function goBackToIntro() {
    clearIntervalTimer()
    status = 'idle'
    statusMessage = 'Elige una tabla y presiona comenzar.'
    questions = []
    currentIndex = 0
    answer = ''
    timeLeft = MAX_TIME
    screen = 'intro'
    errorAnimation = false
    successAnimation = false
    generateNewPractice()
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
              <button type="button" class:selected={table === selectedTable} on:click={() => (selectedTable = table)}>
                × {table}
              </button>
            {/each}
          </div>
        </article>
      </div>

      <div class="intro-actions">
        <div>
          <p class="mini">Duración del reto</p>
          <strong>{MAX_TIME} segundos</strong>
        </div>
        <button class="boton-accion grande" type="button" on:click={beginChallenge}>
          Comenzar reto
        </button>
      </div>
    </section>
  {:else}
    <section class="panel reto-panel">
      <header class="reto-banner">
        <div class="reto-banner__info">
          <strong>Tabla del {selectedTable}</strong>
        </div>
        <div class="reto-banner__acciones">
          <button class="boton-link" type="button" on:click={goBackToIntro}>Cambiar tabla</button>
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
      <button class="boton-accion grande" type="button" on:click={startChallenge}>
        {status === 'running' ? 'Reiniciar reto' : 'Intentar de nuevo'}
      </button>
    </section>
  {/if}
</main>
