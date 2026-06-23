# Daniela Pop Quiz

Aplicación hecha con Svelte + Vite para que Daniela practique las tablas de multiplicar de forma colorida, cronometrada y llena de mensajes de ánimo en español.

## Características

- Pantalla inicial con práctica libre y selección de la tabla favorita antes de cronometrar nada.
- Selección de tablas del 1 al 12 con botones tipo "pop".
- Diez multiplicaciones por reto, en orden aleatorio, con límite de 40 segundos.
- Mensajes motivacionales diferentes para aciertos y reintentos.
- Barra de tiempo y progreso para que el avance sea visible en todo momento.
- Opción de volver a la pantalla inicial para cambiar de tabla o seguir practicando sin presión.

## Requisitos

- Node.js 20.19 o superior (Vite 7 lo exige). Consulta `node --version` si necesitas actualizar.

## Scripts disponibles

```bash
pnpm install # instala dependencias
pnpm dev     # levanta el entorno de desarrollo en http://localhost:5175
pnpm build   # genera la versión de producción
pnpm preview # sirve la build para revisión final también en http://localhost:5175
```

## Testing

Consulta [TESTING.md](/Users/camilopr/weeellp/dani-pop-quiz/TESTING.md) para el checklist manual de persistencia, migración, logging de intentos y regresiones.

## ¿Cómo practicar?

1. En la pantalla de bienvenida, elige la tabla y usa la tarjeta de **Practica libre** para calentar.
2. Cuando te sientas lista, pulsa **Comenzar reto** para pasar al cronómetro.
3. Usa Enter o el botón **¡Listo!** para enviar cada respuesta.
4. Completa las diez multiplicaciones antes de que termine el reloj para acercarte a esa Instax Mini 12.
5. Si quieres cambiar de tabla, usa **Cambiar tabla** para volver a la pantalla inicial.

¡Listo! Daniela puede repetir el reto cuantas veces quiera hasta que recite la tabla completa sin equivocarse.
