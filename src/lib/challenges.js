export const CHALLENGE_MODE_TABLES = 'tables'
export const CHALLENGE_MODE_SOLO_ADD = 'solo_add'
export const ARITHMETIC_LEVELS = [1, 2, 3]

export const ADDITION_FAMILY_LABELS = {
  bond_10: 'Completar 10',
  bond_20: 'Completar 20',
  double: 'Dobles',
  near_double: 'Casi dobles',
  single_no_carry: 'Suma simple',
  single_cross_10: 'Cruza decena',
  two_plus_one_no_carry: '2 cifras + 1 sin cruce',
  two_plus_one_cross_10: '2 cifras + 1 con cruce',
  two_plus_two_no_carry: '2 cifras + 2 sin cruce',
  two_plus_two_cross_10: '2 cifras + 2 con cruce',
  round_anchor_plus: 'Cerca de decena',
  make_10_bridge: 'Puente al 10',
  two_plus_two_multi_carry: 'Doble cruce',
  three_plus_one: '3 cifras + 1',
  three_plus_two: '3 cifras + 2',
  cross_100_add: 'Cruza 100',
  round_anchor_compensation_add: 'Compensacion'
}

const ADDITION_LEVEL_TARGET_FAMILIES = {
  1: ['bond_10', 'bond_20', 'double', 'near_double', 'single_no_carry', 'single_cross_10'],
  2: [
    'two_plus_one_no_carry',
    'two_plus_one_cross_10',
    'two_plus_two_no_carry',
    'two_plus_two_cross_10',
    'round_anchor_plus',
    'make_10_bridge'
  ],
  3: ['two_plus_two_multi_carry', 'three_plus_one', 'three_plus_two', 'cross_100_add', 'round_anchor_compensation_add']
}

const ADDITION_LEVEL_REVIEW_FAMILIES = {
  1: ['bond_10', 'double', 'single_no_carry'],
  2: ['bond_10', 'bond_20', 'double', 'single_cross_10'],
  3: ['two_plus_one_cross_10', 'two_plus_two_cross_10', 'round_anchor_plus', 'make_10_bridge']
}

const ADDITION_LEVEL_STRETCH_FAMILIES = {
  1: ['bond_20', 'near_double', 'single_cross_10'],
  2: ['two_plus_two_cross_10', 'round_anchor_plus', 'make_10_bridge'],
  3: ['two_plus_two_multi_carry', 'cross_100_add', 'round_anchor_compensation_add']
}

function shuffle(array) {
  return array
    .map((value) => ({ value, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ value }) => value)
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function digitCount(value) {
  return `${Math.abs(Number(value) || 0)}`.length
}

function hasAdditionCarry(a, b) {
  let left = Math.abs(a)
  let right = Math.abs(b)
  let carry = 0

  while (left > 0 || right > 0) {
    const sum = (left % 10) + (right % 10) + carry
    if (sum >= 10) {
      return true
    }
    carry = Math.floor(sum / 10)
    left = Math.floor(left / 10)
    right = Math.floor(right / 10)
  }

  return false
}

function createAdditionQuestion({ operandA, operandB, family, difficultyLevel }) {
  const expectedAnswer = operandA + operandB
  const questionKey = `add:${operandA}:${operandB}`
  const resultBefore = Math.floor(Math.abs(operandA) / 10)
  const resultAfter = Math.floor(Math.abs(expectedAnswer) / 10)
  const hundredBefore = Math.floor(Math.abs(operandA) / 100)
  const hundredAfter = Math.floor(Math.abs(expectedAnswer) / 100)

  return {
    mode: CHALLENGE_MODE_SOLO_ADD,
    skill: 'arithmetic',
    operation: 'add',
    operandA,
    operandB,
    expectedAnswer,
    prompt: `${operandA} + ${operandB} = ?`,
    family,
    difficultyLevel,
    carryFlag: hasAdditionCarry(operandA, operandB),
    borrowFlag: false,
    crosses10: resultBefore !== resultAfter,
    crosses100: hundredBefore !== hundredAfter,
    digitsA: digitCount(operandA),
    digitsB: digitCount(operandB),
    questionKey
  }
}

function createTablesQuestion(table, multiplier) {
  return {
    mode: CHALLENGE_MODE_TABLES,
    skill: 'multiplication',
    operation: 'multiply',
    operandA: table,
    operandB: multiplier,
    expectedAnswer: table * multiplier,
    prompt: `${table} × ${multiplier} = ?`,
    family: `table_${table}`,
    difficultyLevel: null,
    carryFlag: null,
    borrowFlag: null,
    crosses10: null,
    crosses100: null,
    digitsA: digitCount(table),
    digitsB: digitCount(multiplier),
    questionKey: `multiply:${table}:${multiplier}`,
    table,
    multiplier
  }
}

function createQuestionFromFamily(family, difficultyLevel) {
  if (family === 'bond_10') {
    const a = randomInt(1, 9)
    return createAdditionQuestion({ operandA: a, operandB: 10 - a, family, difficultyLevel })
  }

  if (family === 'bond_20') {
    const a = randomInt(10, 19)
    return createAdditionQuestion({ operandA: a, operandB: 20 - a, family, difficultyLevel })
  }

  if (family === 'double') {
    const a = randomInt(1, 9)
    return createAdditionQuestion({ operandA: a, operandB: a, family, difficultyLevel })
  }

  if (family === 'near_double') {
    const a = randomInt(1, 9)
    const operands = Math.random() > 0.5 ? [a, a + 1] : [a + 1, a]
    return createAdditionQuestion({ operandA: operands[0], operandB: operands[1], family, difficultyLevel })
  }

  if (family === 'single_no_carry') {
    const a = randomInt(1, 8)
    const b = randomInt(1, 9 - a)
    return createAdditionQuestion({ operandA: a, operandB: b, family, difficultyLevel })
  }

  if (family === 'single_cross_10') {
    const a = randomInt(2, 10)
    const b = randomInt(Math.max(1, 10 - a), 10)
    return createAdditionQuestion({ operandA: a, operandB: b, family, difficultyLevel })
  }

  if (family === 'two_plus_one_no_carry') {
    const ones = randomInt(0, 8)
    const a = randomInt(1, 8) * 10 + ones
    const b = randomInt(1, 9 - ones)
    return createAdditionQuestion({ operandA: a, operandB: b, family, difficultyLevel })
  }

  if (family === 'two_plus_one_cross_10') {
    const ones = randomInt(1, 9)
    const a = randomInt(1, 8) * 10 + ones
    const b = randomInt(10 - ones, 9)
    return createAdditionQuestion({ operandA: a, operandB: b, family, difficultyLevel })
  }

  if (family === 'two_plus_two_no_carry') {
    const onesA = randomInt(0, 8)
    const onesB = randomInt(0, 9 - onesA)
    const tensA = randomInt(1, 4)
    const tensB = randomInt(1, 4)
    return createAdditionQuestion({
      operandA: tensA * 10 + onesA,
      operandB: tensB * 10 + onesB,
      family,
      difficultyLevel
    })
  }

  if (family === 'two_plus_two_cross_10') {
    const onesA = randomInt(2, 9)
    const onesB = randomInt(10 - onesA, 9)
    const tensA = randomInt(1, 4)
    const tensB = randomInt(1, 4)
    return createAdditionQuestion({
      operandA: tensA * 10 + onesA,
      operandB: tensB * 10 + onesB,
      family,
      difficultyLevel
    })
  }

  if (family === 'round_anchor_plus') {
    const anchor = pickRandom([19, 29, 39, 49, 59, 69, 79, 89])
    const bump = randomInt(2, 9)
    return createAdditionQuestion({ operandA: anchor, operandB: bump, family, difficultyLevel })
  }

  if (family === 'make_10_bridge') {
    const a = randomInt(14, 68)
    const needed = 10 - (a % 10)
    const b = needed + randomInt(1, 3)
    return createAdditionQuestion({ operandA: a, operandB: b, family, difficultyLevel })
  }

  if (family === 'two_plus_two_multi_carry') {
    const onesA = randomInt(6, 9)
    const onesB = randomInt(10 - onesA, 9)
    const tensA = randomInt(4, 8)
    const tensB = randomInt(Math.max(1, 10 - tensA), 9)
    return createAdditionQuestion({
      operandA: tensA * 10 + onesA,
      operandB: tensB * 10 + onesB,
      family,
      difficultyLevel
    })
  }

  if (family === 'three_plus_one') {
    const a = randomInt(100, 899)
    const b = randomInt(2, 9)
    return createAdditionQuestion({ operandA: a, operandB: b, family, difficultyLevel })
  }

  if (family === 'three_plus_two') {
    const a = randomInt(120, 899)
    const b = randomInt(12, 89)
    return createAdditionQuestion({ operandA: a, operandB: b, family, difficultyLevel })
  }

  if (family === 'cross_100_add') {
    const hundred = pickRandom([0, 100, 200, 300, 400, 500, 600, 700])
    const tail = randomInt(85, 99)
    const a = hundred + tail
    const b = randomInt(5, 18)
    return createAdditionQuestion({ operandA: a, operandB: b, family, difficultyLevel })
  }

  if (family === 'round_anchor_compensation_add') {
    const anchor = pickRandom([99, 199, 299, 399, 499, 599, 699, 799])
    const bump = randomInt(12, 39)
    return createAdditionQuestion({ operandA: anchor, operandB: bump, family, difficultyLevel })
  }

  return createAdditionQuestion({ operandA: 4, operandB: 5, family: 'bond_10', difficultyLevel })
}

function chooseFamilies({ level, weakFamily = null }) {
  const targetFamilies = ADDITION_LEVEL_TARGET_FAMILIES[level] || ADDITION_LEVEL_TARGET_FAMILIES[1]
  const reviewFamilies = ADDITION_LEVEL_REVIEW_FAMILIES[level] || targetFamilies
  const stretchFamilies = ADDITION_LEVEL_STRETCH_FAMILIES[level] || targetFamilies
  const blueprint = []
  const familyCounts = new Map()

  function canUseFamily(family) {
    return (familyCounts.get(family) || 0) < 3
  }

  function pushFamily(pool) {
    const available = shuffle(pool).filter(canUseFamily)
    const family = available[0] || pool[0]
    blueprint.push(family)
    familyCounts.set(family, (familyCounts.get(family) || 0) + 1)
  }

  if (weakFamily && [...targetFamilies, ...reviewFamilies, ...stretchFamilies].includes(weakFamily)) {
    pushFamily([weakFamily])
    if (level >= 2) {
      pushFamily([weakFamily])
    }
  }

  const targetCount = level === 1 ? 8 : 6
  const reviewCount = level === 1 ? 0 : 2
  const stretchCount = 10 - targetCount - reviewCount

  while (blueprint.length < targetCount) {
    pushFamily(targetFamilies)
  }

  while (blueprint.length < targetCount + reviewCount) {
    pushFamily(reviewFamilies)
  }

  while (blueprint.length < 10) {
    pushFamily(stretchFamilies)
  }

  return shuffle(blueprint)
}

function buildAdditionQuestions(level, { weakFamily = null, recentQuestionKeys = [] } = {}) {
  const families = chooseFamilies({ level, weakFamily })
  const recentSet = new Set(recentQuestionKeys)
  const usedKeys = new Set()

  return families.map((family) => {
    let question = null
    let fallback = null

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = createQuestionFromFamily(family, level)
      if (!fallback) {
        fallback = candidate
      }
      if (usedKeys.has(candidate.questionKey)) {
        continue
      }
      if (recentSet.has(candidate.questionKey) && attempt < 20) {
        continue
      }
      question = candidate
      break
    }

    question = question || fallback
    usedKeys.add(question.questionKey)
    return question
  })
}

export function createTablesChallenge(selectedTable, { multipliers = [] } = {}) {
  const questionOrder = shuffle(multipliers)
  const questions = questionOrder.map((multiplier) => createTablesQuestion(selectedTable, multiplier))

  return {
    mode: CHALLENGE_MODE_TABLES,
    skill: 'multiplication',
    difficultyLevel: null,
    title: `Tabla del ${selectedTable}`,
    introTitle: 'Reto de Multiplicaciones',
    introDescription: 'Escoge la tabla que quieres dominar hoy. Practica primero, luego corre contra el reloj.',
    startMessage: '¡Vamos, Daniela! Escucha tu ritmo y responde con calma.',
    successTitle: '¡Lo lograste!',
    successDescription: `Respondiste las ${questions.length} multiplicaciones sin rendirte. La Instax Mini 12 ya puede preparar un carrete pastelito.`,
    timeoutTitle: 'Tiempo fuera',
    timeoutDescription: 'El reloj llegó a cero, pero cada intento suma. Respira, revisa la tabla y prueba otra vez.',
    retryDescription: `Pulsa "Intentar de nuevo" para generar ${questions.length} multiplicaciones en menos de 40 segundos y demuestra que ninguna tabla te gana.`,
    questionOrder,
    questions,
    questionCount: questions.length
  }
}

export function createAdditionChallenge(level, { weakFamily = null, recentQuestionKeys = [] } = {}) {
  const questions = buildAdditionQuestions(level, { weakFamily, recentQuestionKeys })

  return {
    mode: CHALLENGE_MODE_SOLO_ADD,
    skill: 'arithmetic',
    difficultyLevel: level,
    title: `Sumas nivel ${level}`,
    introTitle: 'Reto de Sumas',
    introDescription: 'Entrena velocidad mental con sumas variadas y sube de nivel automaticamente.',
    startMessage: '¡A sumar! Busca el camino mas rapido y confia en tu cabeza.',
    successTitle: '¡Sumas completadas!',
    successDescription: `Terminaste ${questions.length} sumas del nivel ${level}. Tu velocidad mental va creciendo reto a reto.`,
    timeoutTitle: 'Tiempo fuera',
    timeoutDescription: 'El reloj llegó a cero, pero tu práctica de sumas ya cuenta. Respira y vuelve a intentarlo.',
    retryDescription: `Pulsa "Intentar de nuevo" para resolver ${questions.length} sumas del nivel ${level} en menos de 40 segundos.`,
    questionOrder: questions.map((question) => question.questionKey),
    questions,
    questionCount: questions.length
  }
}
