<script>
  import { onDestroy, tick } from 'svelte'

  const TABLAS = Array.from({ length: 12 }, (_, i) => i + 1)
  const MULTIPLICADORES = Array.from({ length: 10 }, (_, i) => i + 1)
  const TIEMPO_MAXIMO = 40

  const mensajesAplauso = [
    '¡Brillas como un sol!',
    '¡Esa respuesta fue de campeona!',
    '¡Súper memoria, Dani!',
    '¡La Instax Mini 12 ya te está guiñando el ojo!',
    '¡Exacto! Tu cerebro es pura chispa.'
  ]

  const mensajesReintento = [
    'Respira hondo y vuelve a intentarlo.',
    'Piensa en grupos de objetos, ¡tú puedes!',
    'Casi, revisa el cálculo con calma.',
    'Imagina los puntos de colores y suma otra vez.',
    'No pasa nada, estamos practicando.'
  ]

  let tablaSeleccionada = 7
  let preguntas = []
  let indiceActual = 0
  let respuesta = ''
  let tiempoRestante = TIEMPO_MAXIMO
  let estado = 'idle' // idle | running | success | timeout
  let mensaje = 'Elige una tabla y presiona comenzar.'
  let intervalo
  let campoRespuesta
  let pantalla = 'intro' // intro | reto
  let practicaFactor = MULTIPLICADORES[0]
  let practicaRespuesta = ''
  let practicaMensaje = 'Escribe la respuesta y presiona comprobar.'

  const metaDescripcion = 'Te hice esta página para que practiques! Completa cada tabla en menos de 40 segundos para demostrar que lograrás ganarte tu premio 📷'

  function nuevaPractica() {
    practicaFactor = MULTIPLICADORES[Math.floor(Math.random() * MULTIPLICADORES.length)]
    practicaRespuesta = ''
    practicaMensaje = 'Piensa en grupos de objetos y escribe el resultado.'
  }

  function verificarPractica() {
    const valor = obtenerNumeroSeguro(practicaRespuesta)
    if (valor === null) {
      practicaMensaje = 'Escribe un número para comprobar la respuesta.'
      return
    }

    const esperado = tablaSeleccionada * practicaFactor
    practicaMensaje =
      valor === esperado
        ? '¡Perfecto! Pide otro ejercicio y sigue practicando.'
        : 'Revisa la multiplicación con calma e inténtalo otra vez.'
  }

  function manejarPracticaTeclado(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      verificarPractica()
    }
  }

  function obtenerNumeroSeguro(valor) {
    if (valor === null || valor === undefined) return null
    if (typeof valor === 'number') {
      return Number.isNaN(valor) ? null : valor
    }
    const texto = `${valor}`.trim()
    if (texto === '') return null
    const convertido = Number(texto)
    return Number.isNaN(convertido) ? null : convertido
  }

  function mezclar(array) {
    return array
      .map((valor) => ({ valor, orden: Math.random() }))
      .sort((a, b) => a.orden - b.orden)
      .map(({ valor }) => valor)
  }

  function limpiarIntervalo() {
    if (intervalo) {
      clearInterval(intervalo)
      intervalo = undefined
    }
  }

  function iniciarReto() {
    preguntas = mezclar(MULTIPLICADORES).map((multiplicador) => ({
      a: tablaSeleccionada,
      b: multiplicador
    }))
    indiceActual = 0
    respuesta = ''
    tiempoRestante = TIEMPO_MAXIMO
    estado = 'running'
    mensaje = '¡Vamos, Daniela! Escucha tu ritmo y responde con calma.'
    limpiarIntervalo()
    intervalo = setInterval(() => {
      tiempoRestante -= 1
      if (tiempoRestante <= 0) {
        tiempoRestante = 0
        terminar(false)
      }
    }, 1000)
    enfocarCampo()
  }

  async function comenzarReto() {
    pantalla = 'reto'
    await tick()
    iniciarReto()
  }

  async function enfocarCampo() {
    await tick()
    campoRespuesta?.focus()
  }

  function terminar(conExito) {
    limpiarIntervalo()
    estado = conExito ? 'success' : 'timeout'
    mensaje = conExito
      ? '¡Tabla completa! Ese Instax Mini 12 ya te “mira” con cariño.'
      : 'El tiempo terminó, pero tu constancia es la magia. ¡Vamos de nuevo!'
  }

  $: preguntaActual = preguntas[indiceActual]
  $: progreso = preguntas.length ? Math.round((indiceActual / preguntas.length) * 100) : 0
  $: porcentajeTiempo = Math.max(0, Math.round((tiempoRestante / TIEMPO_MAXIMO) * 100))

  function enviarRespuesta() {
    if (estado !== 'running' || !preguntaActual) return

    const valor = obtenerNumeroSeguro(respuesta)
    if (valor === null) {
      mensaje = 'Escribe un número para que la magia funcione.'
      return
    }

    const esperado = preguntaActual.a * preguntaActual.b
    if (valor === esperado) {
      indiceActual += 1
      respuesta = ''
      mensaje = mensajesAplauso[Math.floor(Math.random() * mensajesAplauso.length)]
      if (indiceActual >= preguntas.length) {
        terminar(true)
      }
    } else {
      mensaje = mensajesReintento[Math.floor(Math.random() * mensajesReintento.length)]
      respuesta = ''
    }
  }

  function manejarTeclado(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      enviarRespuesta()
    }
  }

  function volverAlIntro() {
    limpiarIntervalo()
    estado = 'idle'
    mensaje = 'Elige una tabla y presiona comenzar.'
    preguntas = []
    indiceActual = 0
    respuesta = ''
    tiempoRestante = TIEMPO_MAXIMO
    pantalla = 'intro'
    nuevaPractica()
  }

  onDestroy(() => {
    limpiarIntervalo()
  })

  nuevaPractica()
</script>

<main>
  {#if pantalla === 'intro'}
    <section class="hero hero-intro">
      <p class="saludo">¡Hola Daniela! 🌈</p>
      <h1>Reto de Multiplicaciones</h1>
      <p class="meta">{metaDescripcion}</p>
    </section>

    <section class="panel intro-panel">
      <div class="intro-grid">
        <article class="intro-card selector-card">
          <h2>Elige tu tabla favorita</h2>
          <p>Escoge la tabla que quieres dominar hoy. Practica primero, luego corre contra el reloj.</p>
          <div class="tab-grid" aria-label="Selecciona la tabla que quieres practicar">
            {#each TABLAS as tabla}
              <button type="button" class:selected={tabla === tablaSeleccionada} on:click={() => (tablaSeleccionada = tabla)}>
                × {tabla}
              </button>
            {/each}
          </div>
        </article>
      </div>

      <div class="intro-actions">
        <div>
          <p class="mini">Duración del reto</p>
          <strong>{TIEMPO_MAXIMO} segundos</strong>
        </div>
        <button class="boton-accion grande" type="button" on:click={comenzarReto}>
          Comenzar reto
        </button>
      </div>
    </section>
  {:else}
    <section class="panel reto-panel">
      <div class="reto-header">
        <div>
          <p class="etiqueta">Tabla en juego</p>
          <p class="tabla-actual">Tabla del {tablaSeleccionada}</p>
        </div>
        <div class="reto-controls">
          <button class="boton-link" type="button" on:click={volverAlIntro}>Cambiar tabla</button>
          <button class="boton-accion" type="button" on:click={iniciarReto}>
            {estado === 'running' ? 'Reiniciar reto' : 'Intentar de nuevo'}
          </button>
        </div>
      </div>

      <div class="timer" aria-live="off">
        <div class="timer-bar">
          <div class="fill" style={`width: ${porcentajeTiempo}%`}></div>
        </div>
        <span>{tiempoRestante.toString().padStart(2, '0')} seg restantes</span>
      </div>

      <article class="question-box">
        {#if estado === 'running' && preguntaActual}
          <p class="mini">Pregunta {indiceActual + 1} de {preguntas.length}</p>
          <h2>{preguntaActual.a} × {preguntaActual.b} = ?</h2>
          <div class="answer-row">
            <input
              type="number"
              inputmode="numeric"
              placeholder="Escribe la respuesta"
              bind:value={respuesta}
              on:keydown={manejarTeclado}
              bind:this={campoRespuesta}
            />
            <button type="button" class="boton-accion secundario" on:click={enviarRespuesta}>
              ¡Listo!
            </button>
          </div>
        {:else if estado === 'success'}
          <h2>¡Lo lograste!</h2>
          <p>
            Respondiste las {preguntas.length} multiplicaciones sin rendirte. La Instax Mini 12
            ya puede preparar un carrete pastelito.
          </p>
        {:else if estado === 'timeout'}
          <h2>Tiempo fuera</h2>
          <p>
            El reloj llegó a cero, pero cada intento suma. Respira, revisa la tabla y prueba otra vez.
          </p>
        {:else}
          <h2>¿Listísima?</h2>
          <p>
            Pulsa "Intentar de nuevo" para generar 10 multiplicaciones en menos de {TIEMPO_MAXIMO} segundos
            y demuestra que ninguna tabla te gana.
          </p>
        {/if}
      </article>

      <div class="status-strip" aria-live="polite">
        <div>
          <span class="label">Progreso</span>
          <strong>{indiceActual}/{preguntas.length || MULTIPLICADORES.length}</strong>
        </div>
        <div>
          <span class="label">Ánimo</span>
          <strong>{mensaje}</strong>
        </div>
      </div>

      <div class="progress-area">
        <div class="progress-track">
          <div class="progress-fill" style={`width: ${progreso}%`}></div>
        </div>
        <p>{progreso}% de la tabla superada</p>
      </div>
    </section>
  {/if}
</main>
