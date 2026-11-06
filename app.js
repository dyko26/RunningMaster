/**
 * ============================================================================
 * RUNPULSE PRO - MOTOR CIENTÍFICO Y CONTROLADOR CENTRAL (app.js)
 * ============================================================================
 * Arquitectura: Vanilla ES6+, localStorage / IndexedDB, Chart.js.
 * Enfoque: Atletismo de Ruta Científico, Carga de Entrenamiento (ACWR),
 * Fisiología Cardiovascular (Karvonen), Modelos VDOT (Jack Daniels),
 * Ajuste de Ritmo por Pendiente (Minetti GAP), Termorregulación y Nutrición.
 * ============================================================================
 */

// ============================================================================
// 1. GESTIÓN DE ESTADO Y PERFILES MULTI-USUARIO (CON PIN DE 4 DÍGITOS)
// ============================================================================

const DEFAULT_PROFILES = [
  {
    id: 'elite',
    name: 'Entrenador / Élite',
    category: 'Alto Rendimiento (Sub-38 10K)',
    pin: '1111',
    weight: 62.0,      // kg
    hrRest: 42,        // Frecuencia Cardíaca en Reposo (bpm)
    hrMax: 195,        // Frecuencia Cardíaca Máxima (bpm)
    vdot: 58.5,        // VDOT actual estimado
    target10k: '38:00',
    target5k: '18:00',
    planType: 'elite'
  },
  {
    id: 'progression',
    name: 'Atleta Progresión',
    category: 'Sub-60 10K (Transición y Periostitis Free)',
    pin: '2222',
    weight: 74.5,
    hrRest: 56,
    hrMax: 188,
    vdot: 35.8,
    target10k: '59:59',
    target5k: '28:30',
    planType: 'progression'
  },
  {
    id: 'marathon',
    name: 'Atleta 3 (Fondo & Maratón)',
    category: 'Resistencia Aeróbica (Sub-3h30)',
    pin: '3333',
    weight: 68.0,
    hrRest: 48,
    hrMax: 184,
    vdot: 47.0,
    target10k: '45:00',
    target5k: '21:30',
    planType: 'elite'
  },
  {
    id: 'initiation',
    name: 'Atleta 4 (Iniciación / Salud)',
    category: 'Salud Cardiovascular & Base Aeróbica',
    pin: '4444',
    weight: 81.0,
    hrRest: 64,
    hrMax: 178,
    vdot: 29.5,
    target10k: '1:15:00',
    target5k: '36:00',
    planType: 'progression'
  }
];

const DEFAULT_SHOES = [
  {
    id: 'shoe-1',
    profileId: 'elite',
    brand: 'Nike',
    model: 'Vaporfly 3',
    foam: 'ZoomX + Placa de Fibra de Carbono',
    usage: 'Competición & Series Rápidas',
    currentKm: 142.5,
    maxKm: 450,
    active: true
  },
  {
    id: 'shoe-2',
    profileId: 'elite',
    brand: 'Saucony',
    model: 'Endorphin Speed 4',
    foam: 'PWRRUN PB + Placa Nylon Alado',
    usage: 'Tempo / Umbral Lactato',
    currentKm: 310.0,
    maxKm: 650,
    active: false
  },
  {
    id: 'shoe-3',
    profileId: 'progression',
    brand: 'Asics',
    model: 'Novablast 4',
    foam: 'FF BLAST+ ECO (Máxima Amortiguación)',
    usage: 'Rodajes Largos Z2 & Prevención Periostitis',
    currentKm: 280.0,
    maxKm: 800,
    active: true
  },
  {
    id: 'shoe-4',
    profileId: 'progression',
    brand: 'Brooks',
    model: 'Ghost 15',
    foam: 'DNA Loft v2 (EVA Alta Densidad)',
    usage: 'Rodajes Regenerativos Z1',
    currentKm: 620.0,
    maxKm: 750,
    active: false
  }
];

// Estado global de la aplicación
const AppState = {
  currentProfileId: 'progression',
  isUnlocked: false,          // Bloqueado para edición por defecto (Solo lectura)
  activeTab: 'dashboard',     // 'dashboard', 'ingest', 'scientific', 'planner', 'nutrition', 'shoes'
  profiles: [],
  workouts: [],
  shoes: [],
  chartInstance: null
};

// ============================================================================
// 2. FORMULACIONES MATEMÁTICAS Y FISIOLÓGICAS COMENTADAS EN DETALLE
// ============================================================================

/**
 * ----------------------------------------------------------------------------
 * A. FÓRMULA DE FRECUENCIA CARDÍACA DE RESERVA (FÓRMULA DE KARVONEN)
 * ----------------------------------------------------------------------------
 * A diferencia del cálculo simple %FC_max (que subestima las zonas de baja intensidad),
 * el Dr. Martti Karvonen introdujo la Frecuencia Cardíaca de Reserva (HRR):
 *
 *   HRR = HR_max - HR_rest
 *   HR_target = HR_rest + (%Intensidad * HRR)
 *
 * Donde:
 * - HR_max: Frecuencia Cardíaca Máxima alcanzada en prueba de esfuerzo o test de campo.
 * - HR_rest: Frecuencia Cardíaca al despertar en reposo absoluto.
 *
 * ZONAS ESTÁNDAR:
 * - Zona 1 (50% - 60% HRR): Recuperación activa, reciclaje de lactato residual.
 * - Zona 2 (60% - 70% HRR): Base aeróbica fundamental, máxima tasa de oxidación de ácidos grasos (FatMax), biogénesis mitocondrial.
 * - Zona 3 (70% - 80% HRR): Tempo / Sub-umbral aeróbico, eficiencia glucolítica con estado estable.
 * - Zona 4 (80% - 90% HRR): Umbral de Lactato (LT2 / OBLA), punto de equilibrio donde la producción iguala a la depuración (~4 mmol/L).
 * - Zona 5 (90% - 100% HRR): Consumo Máximo de Oxígeno (VO2máx) y esfuerzo anaeróbico aláctico/láctico.
 */
function calculateKarvonenZones(hrRest, hrMax) {
  const hrr = Math.max(0, hrMax - hrRest);
  const zones = [
    {
      zone: 'Z1',
      name: 'Recuperación Activa',
      pctRange: '50% - 60%',
      min: Math.round(hrRest + 0.50 * hrr),
      max: Math.round(hrRest + 0.60 * hrr),
      color: '#38bdf8', // Sky
      desc: 'Regeneración tisular y aclaramiento metabólico.'
    },
    {
      zone: 'Z2',
      name: 'Base Aeróbica (FatMax)',
      pctRange: '60% - 70%',
      min: Math.round(hrRest + 0.60 * hrr),
      max: Math.round(hrRest + 0.70 * hrr),
      color: '#a3e635', // Lime
      desc: 'Densidad mitocondrial y economía de carrera sin estrés articular.'
    },
    {
      zone: 'Z3',
      name: 'Tempo / Sub-Umbral',
      pctRange: '70% - 80%',
      min: Math.round(hrRest + 0.70 * hrr),
      max: Math.round(hrRest + 0.80 * hrr),
      color: '#fbbf24', // Amber
      desc: 'Resistencia a la fatiga glucolítica en distancias largas.'
    },
    {
      zone: 'Z4',
      name: 'Umbral de Lactato (LT2)',
      pctRange: '80% - 90%',
      min: Math.round(hrRest + 0.80 * hrr),
      max: Math.round(hrRest + 0.90 * hrr),
      color: '#fb923c', // Orange
      desc: 'Ritmo de crucero sostenible por 60 min (máximo estado estable).'
    },
    {
      zone: 'Z5',
      name: 'VO2 Máx & Anaeróbico',
      pctRange: '90% - 100%',
      min: Math.round(hrRest + 0.90 * hrr),
      max: hrMax,
      color: '#ef4444', // Red
      desc: 'Máxima potencia cardiovascular, series cortas de 400m - 1200m.'
    }
  ];
  return zones;
}

/**
 * ----------------------------------------------------------------------------
 * B. MODELO VDOT DE JACK DANIELS (ECUACIONES AERÓBICAS)
 * ----------------------------------------------------------------------------
 * Dr. Jack Daniels & Jimmy Gilbert formalizaron la relación matemática entre
 * el costo de oxígeno del desplazamiento humano y la fracción de VO2máx sostenible:
 *
 * 1. Costo de O2 (VO2 en ml/kg/min) a velocidad v (en metros/minuto):
 *    VO2(v) = -4.60 + 0.182258 * v + 0.000104 * v^2
 *
 * 2. Fracción de VO2máx sostenible para una duración t (en minutos):
 *    f(t) = 0.8 + 0.1894393 * exp(-0.012778 * t) + 0.2989558 * exp(-0.1932605 * t)
 *
 * 3. VDOT resultante:
 *    VDOT = VO2(v) / f(t)
 *
 * 4. Para calcular los ritmos de entrenamiento según %VDOT:
 *    - Ritmo Easy (E): 65% - 74% VDOT
 *    - Ritmo Marathon (M): 75% - 84% VDOT
 *    - Ritmo Threshold / Umbral (T): 88% - 92% VDOT
 *    - Ritmo Interval / VO2máx (I): 95% - 100% VDOT
 *    - Ritmo Repetition (R): 105% - 110% VDOT
 *
 * Despejando velocidad v a partir del VO2 deseado con la fórmula cuadrática:
 *   0.000104 * v^2 + 0.182258 * v - (VO2_target + 4.60) = 0
 *   v = [ -0.182258 + sqrt(0.182258^2 - 4 * 0.000104 * (-VO2_target - 4.60)) ] / (2 * 0.000104)
 *   Pace (min/km) = 1000 / v
 */
function calculateVDOTFromRace(distanceMeters, timeMinutes) {
  const v = distanceMeters / timeMinutes; // metros por minuto
  const vo2 = -4.60 + (0.182258 * v) + (0.000104 * Math.pow(v, 2));
  const fract = 0.80 + 0.1894393 * Math.exp(-0.012778 * timeMinutes) + 0.2989558 * Math.exp(-0.1932605 * timeMinutes);
  if (fract <= 0) return 30;
  const vdot = vo2 / fract;
  return Math.min(85, Math.max(25, Number(vdot.toFixed(1))));
}

function getVelocityFromVO2(vo2Target) {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(vo2Target + 4.60);
  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0) return 150;
  const v = (-b + Math.sqrt(discriminant)) / (2 * a); // m/min
  return v;
}

function paceFromVelocity(vMetersPerMin) {
  if (vMetersPerMin <= 0) return '0:00';
  const paceMinutes = 1000 / vMetersPerMin;
  const mins = Math.floor(paceMinutes);
  const secs = Math.round((paceMinutes - mins) * 60);
  const paddedSecs = secs < 10 ? `0${secs}` : (secs === 60 ? '00' : secs);
  const adjustedMins = secs === 60 ? mins + 1 : mins;
  return `${adjustedMins}:${paddedSecs}`;
}

function getDanielsTrainingPaces(vdot) {
  // Porcentajes canónicos de la fisiología de Jack Daniels
  const easyVO2 = vdot * 0.70;        // 70% VDOT
  const marathonVO2 = vdot * 0.80;    // 80% VDOT
  const thresholdVO2 = vdot * 0.88;   // 88% VDOT
  const intervalVO2 = vdot * 0.975;   // 97.5% VDOT
  const repetitionVO2 = vdot * 1.07;  // 107% VDOT

  return {
    easy: paceFromVelocity(getVelocityFromVO2(easyVO2)),
    marathon: paceFromVelocity(getVelocityFromVO2(marathonVO2)),
    threshold: paceFromVelocity(getVelocityFromVO2(thresholdVO2)),
    interval: paceFromVelocity(getVelocityFromVO2(intervalVO2)),
    repetition: paceFromVelocity(getVelocityFromVO2(repetitionVO2))
  };
}

/**
 * ----------------------------------------------------------------------------
 * C. GAP (GRADE ADJUSTED PACE) - MODELO BIOMECÁNICO DE MINETTI ET AL. (2002)
 * ----------------------------------------------------------------------------
 * El profesor Alberto Minetti determinó experimentalmente el Costo Metabólico (Cr)
 * de correr en diferentes pendientes i (donde i = gradiente decimal = elevación / distancia):
 *
 *   Cr(i) = 155.4 * i^5 - 30.4 * i^4 - 43.3 * i^3 + 46.3 * i^2 + 19.5 * i + 3.6
 *   (en Joules por kilogramo por metro: J / kg / m)
 *
 * En superficie completamente plana (i = 0):
 *   Cr(0) = 3.6 J / kg / m
 *
 * Por lo tanto, el Factor de Costo Metabólico relativo es:
 *   Factor = Cr(i) / Cr(0)
 *
 * El Ritmo Ajustado por Pendiente (GAP) calcula el ritmo equivalente en terreno plano:
 *   Velocidad_GAP = Velocidad_Real * Factor
 *   Pace_GAP (seg/km) = Pace_Real (seg/km) / Factor
 *
 * Esto permite comparar objetivamente sesiones con cuestas frente a sesiones planas.
 */
function calculateMinettiGAP(paceSecPerKm, elevationGainMeters, distanceKm) {
  if (!distanceKm || distanceKm <= 0 || !paceSecPerKm || paceSecPerKm <= 0) {
    return paceSecPerKm;
  }
  const distanceMeters = distanceKm * 1000;
  // Gradiente medio de ascenso neto
  const gradient = Math.max(-0.45, Math.min(0.45, elevationGainMeters / distanceMeters));

  const i = gradient;
  // Polinomio quíntico de Minetti (2002)
  const cr = (155.4 * Math.pow(i, 5)) -
             (30.4 * Math.pow(i, 4)) -
             (43.3 * Math.pow(i, 3)) +
             (46.3 * Math.pow(i, 2)) +
             (19.5 * i) +
             3.6;

  const costRatio = Math.max(0.65, cr / 3.6);
  // El ritmo GAP es más rápido en subida (menor tiempo por km) porque el esfuerzo equivale a correr más rápido en llano
  const gapSecPerKm = Math.round(paceSecPerKm / costRatio);
  return gapSecPerKm;
}

/**
 * ----------------------------------------------------------------------------
 * D. TERMORREGULACIÓN Y PENALIZACIÓN POR PUNTO DE ROCÍO (MAGNUS-TETENS)
 * ----------------------------------------------------------------------------
 * La capacidad del cuerpo humano para disipar calor metabólico depende críticamente
 * de la presión de vapor de agua en el aire. La humedad relativa (RH) y la temperatura
 * ambiente (T en °C) determinan el Punto de Rocío (Dew Point, Td).
 *
 * Ecuación de Magnus-Tetens:
 *   alpha(T, RH) = [ (17.27 * T) / (237.7 + T) ] + ln(RH / 100)
 *   Td = (237.7 * alpha) / (17.27 - alpha)
 *
 * Índice Fisiológico Térmico Combinado = T + Td (en °C)
 *
 * Escala de Penalización Científica sobre el Ritmo (segundos por km):
 * - Suma < 38°C: Condiciones óptimas (0% penalización)
 * - Suma 38°C a 43°C: Leve estrés térmico -> 1.5% a 2% de penalización (~4 a 6 s/km)
 * - Suma 44°C a 49°C: Estrés moderado -> 3% a 4.5% de penalización (~10 a 14 s/km)
 * - Suma 50°C a 55°C: Estrés severo, reducción del volumen plasmático -> 5.5% a 7% (~18 a 25 s/km)
 * - Suma > 55°C: Peligro de golpe de calor -> >8% a 12% penalización (>30 s/km)
 */
function calculateDewPointAndPenalty(tempC, humidityPct, paceSecPerKm) {
  if (tempC === undefined || humidityPct === undefined || isNaN(tempC) || isNaN(humidityPct)) {
    return { dewPoint: null, combinedIndex: null, penaltyPct: 0, penaltySecPerKm: 0, adjustedPaceSec: paceSecPerKm };
  }

  const rhClamped = Math.max(1, Math.min(100, humidityPct));
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(rhClamped / 100);
  const dewPoint = (b * alpha) / (a - alpha);
  const combined = tempC + dewPoint;

  let penaltyPct = 0;
  if (combined < 38) {
    penaltyPct = 0;
  } else if (combined <= 43) {
    penaltyPct = 1.8;
  } else if (combined <= 49) {
    penaltyPct = 3.8;
  } else if (combined <= 55) {
    penaltyPct = 6.5;
  } else {
    penaltyPct = 10.0;
  }

  const penaltySecPerKm = Math.round((paceSecPerKm * penaltyPct) / 100);
  // El ritmo fisiológico equivalente en condiciones ideales sería más rápido
  const adjustedPaceSec = Math.max(120, paceSecPerKm - penaltySecPerKm);

  return {
    dewPoint: Number(dewPoint.toFixed(1)),
    combinedIndex: Number(combined.toFixed(1)),
    penaltyPct,
    penaltySecPerKm,
    adjustedPaceSec
  };
}

/**
 * ----------------------------------------------------------------------------
 * E. RATIO DE CARGA AGUDA : CRÓNICA (ACWR - GABBETT MODEL)
 * ----------------------------------------------------------------------------
 * El modelo de Tim Gabbett previene lesiones musculoesqueléticas cuantificando
 * el equilibrio entre la fatiga reciente y la aptitud física consolidada:
 *
 * 1. Carga Diaria de Entrenamiento (Session Load en Arbitrary Units, AU):
 *    Carga = Duración (minutos) * RPE (Escala de Borg CR-10 modificada)
 *    (Opcionalmente ponderada por Distancia * Intensidad)
 *
 * 2. Carga Aguda (Fatiga acumulada a corto plazo):
 *    Media móvil de los últimos 7 días.
 *
 * 3. Carga Crónica (Aptitud / Fitness acumulado a largo plazo):
 *    Media móvil de los últimos 28 días.
 *
 * 4. ACWR = Carga Aguda / Carga Crónica
 *
 * ZONAS DE RIESGO DE LESIÓN:
 * - < 0.8: Zona de Sub-entrenamiento. Riesgo de desadaptación.
 * - 0.8 a 1.3: "SWEET SPOT" (Zona Óptima). Máxima ganancia de rendimiento con mínimo riesgo de lesión.
 * - 1.3 a 1.5: Zona de Peligro / Alerta Amarilla. Riesgo moderado-alto de lesión por picos de fatiga.
 * - > 1.5: "DANGER ZONE" (Alerta Roja). Riesgo exponencial de sobreentrenamiento, periostitis y tendinopatías.
 */
function calculateACWR(workouts, targetDate = new Date()) {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const targetTime = new Date(targetDate).setHours(23, 59, 59, 999);

  // Mapear días de los últimos 28 días
  let acuteSum = 0;
  let chronicSum = 0;

  for (let d = 0; d < 28; d++) {
    const dayStart = targetTime - ((d + 1) * ONE_DAY_MS);
    const dayEnd = targetTime - (d * ONE_DAY_MS);

    // Sumar carga de entrenamientos en ese intervalo de 24h
    const dayWorkouts = workouts.filter(w => {
      const wTime = new Date(w.date).getTime();
      return wTime >= dayStart && wTime < dayEnd;
    });

    const dayLoad = dayWorkouts.reduce((sum, w) => {
      const durationMin = timeStringToMinutes(w.duration);
      const rpe = w.rpe || 5;
      // Carga sRPE = minutos * RPE
      return sum + (durationMin * rpe);
    }, 0);

    if (d < 7) {
      acuteSum += dayLoad;
    }
    chronicSum += dayLoad;
  }

  const acuteLoad = acuteSum / 7;
  const chronicLoad = chronicSum / 28;
  const acwr = chronicLoad > 0 ? Number((acuteLoad / chronicLoad).toFixed(2)) : (acuteLoad > 0 ? 1.5 : 1.0);

  let status = 'optimal';
  let badgeText = 'Óptimo (0.8 - 1.3)';
  let color = '#a3e635'; // Lime

  if (acwr < 0.8) {
    status = 'undertraining';
    badgeText = 'Sub-entrenamiento (< 0.8)';
    color = '#38bdf8'; // Sky
  } else if (acwr > 1.5) {
    status = 'danger';
    badgeText = 'Zona de Peligro (> 1.5)';
    color = '#ef4444'; // Red
  } else if (acwr > 1.3) {
    status = 'warning';
    badgeText = 'Sobrecarga / Alerta (1.3 - 1.5)';
    color = '#fbbf24'; // Amber
  }

  return {
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    acwr,
    status,
    badgeText,
    color
  };
}

/**
 * ----------------------------------------------------------------------------
 * F. LABORATORIO DE NUTRICIÓN: TEST DE SUDORACIÓN Y ELECTROLITOS
 * ----------------------------------------------------------------------------
 * La tasa de sudoración cuantifica la pérdida de volumen intravascular para
 * evitar que la deshidratación exceda el 2% del peso corporal (umbral crítico
 * donde el rendimiento cardiovascular decae notablemente).
 *
 * FÓRMULAS:
 * 1. Pérdida Neta de Sudor (Litros):
 *    Pérdida = (Peso_Pre - Peso_Post) + (Líquido_Ingerido_L) - (Orina_Excretada_L)
 *
 * 2. Tasa de Sudoración Horaria (L/h):
 *    Tasa = Pérdida_L / (Duración_Minutos / 60)
 *
 * 3. Porcentaje de Pérdida de Masa Corporal (% Deshidratación):
 *    % Deshidratación = [ (Peso_Pre - Peso_Post) / Peso_Pre ] * 100
 *
 * 4. Reposición Recomendada:
 *    - Líquido post-entreno: 150% del déficit de peso en las próximas 2-4 horas.
 *    - Sodio (Na+): Pérdida promedio de 800 a 1000 mg de sodio por litro de sudor.
 */
function calculateSweatTest(preWeightKg, postWeightKg, fluidConsumedMl, durationMin) {
  const pre = parseFloat(preWeightKg);
  const post = parseFloat(postWeightKg);
  const fluidL = parseFloat(fluidConsumedMl) / 1000;
  const durMin = parseFloat(durationMin);

  if (isNaN(pre) || isNaN(post) || isNaN(fluidL) || isNaN(durMin) || durMin <= 0) {
    return null;
  }

  const weightDeficitKg = pre - post;
  const totalSweatLostL = weightDeficitKg + fluidL;
  const hours = durMin / 60;
  const sweatRatePerHourL = totalSweatLostL / hours;
  const dehydrationPct = (weightDeficitKg / pre) * 100;
  const rehydrationNeededMl = Math.round(weightDeficitKg * 1500); // 150% de la masa perdida
  const sodiumReplenishmentMg = Math.round(totalSweatLostL * 850); // 850mg Na+/L de sudor promedio

  return {
    totalSweatLostL: Number(totalSweatLostL.toFixed(2)),
    sweatRatePerHourL: Number(sweatRatePerHourL.toFixed(2)),
    dehydrationPct: Number(dehydrationPct.toFixed(1)),
    rehydrationNeededMl: Math.max(0, rehydrationNeededMl),
    sodiumReplenishmentMg: Math.max(0, sodiumReplenishmentMg)
  };
}

/**
 * ----------------------------------------------------------------------------
 * G. VENTANA METABÓLICA Y RECUPERACIÓN DE SUSTRATOS ENERGÉTICOS
 * ----------------------------------------------------------------------------
 * Tras el vaciamiento de glucógeno muscular y hepático inducido por el running:
 * - Sensibilidad a la Insulina y transportadores GLUT-4 maximizados en los primeros 45 min.
 * - Carbohidratos (CHO): 1.0 a 1.2 g / kg de peso corporal (intensidad alta)
 * - Proteínas (PRO): 0.3 a 0.4 g / kg de peso corporal (con ~2.5 - 3.0g de leucina para activar mTORC1)
 * - Ratio Óptimo de Resíntesis: 3:1 o 4:1 (CHO:PRO)
 */
function calculateMetabolicWindow(weightKg, durationMin, intensityLevel) {
  const weight = parseFloat(weightKg);
  const min = parseFloat(durationMin);
  if (isNaN(weight) || isNaN(min) || weight <= 0) return null;

  let choPerKg = 1.0;
  let proPerKg = 0.35;
  let ratioStr = '3:1';

  if (intensityLevel === 'high') {
    choPerKg = 1.2;
    proPerKg = 0.35;
    ratioStr = '3.5:1';
  } else if (intensityLevel === 'low') {
    choPerKg = 0.8;
    proPerKg = 0.30;
    ratioStr = '2.7:1';
  }

  const totalCHO = Math.round(weight * choPerKg);
  const totalPRO = Math.round(weight * proPerKg);
  const totalKcal = (totalCHO * 4) + (totalPRO * 4);

  return {
    choGrams: totalCHO,
    proGrams: totalPRO,
    ratio: ratioStr,
    totalKcal,
    foodSuggestions: [
      `Opción A: Batido con 350ml de leche deslactosada o avena + 1 plátano maduro + ${Math.round(totalPRO * 0.9)}g proteína aislada de suero.`,
      `Opción B: 1 tazón de arroz blanco cocido (aprox. ${Math.round(totalCHO * 3.5)}g cocido) con pechuga de pollo deshebrada (${Math.round(totalPRO * 3.3)}g de pechuga).`,
      `Opción C: 2 rebanadas de pan tostado con miel de abeja + 2 huevos cocidos y 2 claras.`
    ]
  };
}

// ============================================================================
// 3. UTILIDADES DE TIEMPO, RITMOS Y FORMATEO
// ============================================================================

function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 60) + parts[1] + (parts[2] / 60);
  } else if (parts.length === 2) {
    return parts[0] + (parts[1] / 60);
  }
  return Number(timeStr) || 0;
}

function timeStringToSeconds(timeStr) {
  return Math.round(timeStringToMinutes(timeStr) * 60);
}

function secondsToPaceString(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  const paddedSecs = secs < 10 ? `0${secs}` : (secs === 60 ? '00' : secs);
  const adjustedMins = secs === 60 ? mins + 1 : mins;
  return `${adjustedMins}:${paddedSecs}`;
}

function calculatePace(distanceKm, durationTimeStr) {
  const km = parseFloat(distanceKm);
  const totalSecs = timeStringToSeconds(durationTimeStr);
  if (isNaN(km) || km <= 0 || totalSecs <= 0) return { paceSec: 0, paceStr: '--:--' };
  const secPerKm = Math.round(totalSecs / km);
  return {
    paceSec: secPerKm,
    paceStr: secondsToPaceString(secPerKm)
  };
}

// ============================================================================
// 4. PERSISTENCIA EN LOCALSTORAGE Y DATOS SEMILLA
// ============================================================================

const STORAGE_KEYS = {
  PROFILES: 'runpulse_profiles_v1',
  WORKOUTS: 'runpulse_workouts_v1',
  SHOES: 'runpulse_shoes_v1',
  ACTIVE_PROFILE: 'runpulse_active_profile_v1'
};

function initializeStorage() {
  // 1. Perfiles
  const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
  if (!storedProfiles) {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(DEFAULT_PROFILES));
    AppState.profiles = [...DEFAULT_PROFILES];
  } else {
    try {
      AppState.profiles = JSON.parse(storedProfiles);
    } catch (e) {
      AppState.profiles = [...DEFAULT_PROFILES];
    }
  }

  // 2. Perfil Activo
  const savedProfileId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
  if (savedProfileId && AppState.profiles.some(p => p.id === savedProfileId)) {
    AppState.currentProfileId = savedProfileId;
  } else {
    AppState.currentProfileId = AppState.profiles[0].id;
  }

  // 3. Zapatillas
  const storedShoes = localStorage.getItem(STORAGE_KEYS.SHOES);
  if (!storedShoes) {
    localStorage.setItem(STORAGE_KEYS.SHOES, JSON.stringify(DEFAULT_SHOES));
    AppState.shoes = [...DEFAULT_SHOES];
  } else {
    try {
      AppState.shoes = JSON.parse(storedShoes);
    } catch (e) {
      AppState.shoes = [...DEFAULT_SHOES];
    }
  }

  // 4. Entrenamientos (Cargar o generar historial semilla para demostración de ACWR)
  const storedWorkouts = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
  if (!storedWorkouts) {
    const seedWorkouts = generateSeedWorkouts();
    localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(seedWorkouts));
    AppState.workouts = seedWorkouts;
  } else {
    try {
      AppState.workouts = JSON.parse(storedWorkouts);
    } catch (e) {
      AppState.workouts = generateSeedWorkouts();
    }
  }
}

function saveProfiles() {
  localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(AppState.profiles));
}

function saveWorkouts() {
  localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(AppState.workouts));
}

function saveShoes() {
  localStorage.setItem(STORAGE_KEYS.SHOES, JSON.stringify(AppState.shoes));
}

/**
 * Genera un historial de 28 días con datos realistas para que el gráfico de ACWR
 * y las estadísticas arranquen con visualizaciones completas.
 */
function generateSeedWorkouts() {
  const seed = [];
  const now = new Date();
  const sampleDistances = [8.5, 12.0, 6.0, 10.5, 0, 14.0, 5.0, 7.5, 9.0, 0, 15.0, 8.0, 11.0, 0];
  const sampleRpes = [6, 7, 5, 8, 0, 7, 4, 6, 7, 0, 8, 5, 7, 0];

  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const idx = i % sampleDistances.length;
    const distance = sampleDistances[idx];
    if (distance === 0) continue; // Día de descanso

    const rpe = sampleRpes[idx];
    const paceSec = 360 - (rpe * 10); // ej 300s = 5:00/km
    const totalSec = Math.round(distance * paceSec);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const durationStr = `${hours > 0 ? hours + ':' : ''}${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;

    seed.push({
      id: `seed-${Date.now()}-${i}`,
      profileId: i % 2 === 0 ? 'elite' : 'progression',
      date: dateStr,
      distance: distance,
      duration: durationStr,
      elevationGain: Math.round(distance * 8),
      tempC: 22 + (i % 6),
      humidityPct: 65 + (i % 15),
      avgHr: 145 + (rpe * 4),
      maxHr: 172 + (rpe * 2),
      cadence: 174 + (i % 6),
      vo2MaxEstimate: 54.2,
      rpe: rpe,
      shoeId: 'shoe-1',
      brandPreset: 'Garmin Forerunner 965',
      notes: 'Sesión progresiva con buenas sensaciones musculares.'
    });
  }
  return seed;
}

// ============================================================================
// 5. CONTROL DE ACCESO MULTI-USUARIO (SISTEMA DE PIN DE 4 DÍGITOS)
// ============================================================================

function getCurrentProfile() {
  return AppState.profiles.find(p => p.id === AppState.currentProfileId) || AppState.profiles[0];
}

function switchProfile(profileId) {
  if (AppState.currentProfileId !== profileId) {
    AppState.currentProfileId = profileId;
    AppState.isUnlocked = false; // Bloquear permisos de edición al cambiar de perfil
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
    renderAll();
  }
}

function verifyPin(inputPin) {
  const profile = getCurrentProfile();
  if (profile && profile.pin === inputPin) {
    AppState.isUnlocked = true;
    updateLockBadge();
    closePinModal();
    showToast(`🔓 Acceso concedido como ${profile.name}. Modo Edición habilitado.`, 'success');
    return true;
  } else {
    showToast('❌ PIN incorrecto. Acceso en solo lectura.', 'error');
    return false;
  }
}

function lockProfile() {
  AppState.isUnlocked = false;
  updateLockBadge();
  showToast('🔒 Modo Solo Lectura activado.', 'info');
}

function checkPermissionOrPrompt(callback) {
  if (AppState.isUnlocked) {
    callback();
  } else {
    openPinModal(callback);
  }
}

// ============================================================================
// 6. MOTOR DE INTERFAZ GRÁFICA Y CONTROLADORES
// ============================================================================

function switchTab(tabName) {
  AppState.activeTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const activeEl = document.getElementById(`tab-${tabName}`);
  if (activeEl) activeEl.classList.remove('hidden');

  // Actualizar botones de navegación
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const target = btn.dataset.tab;
    if (target === tabName) {
      btn.classList.add('text-lime-400', 'border-b-2', 'border-lime-400', 'bg-slate-800/60');
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('text-lime-400', 'border-b-2', 'border-lime-400', 'bg-slate-800/60');
      btn.classList.add('text-slate-400');
    }
  });

  // Re-renderizado específico si es necesario
  if (tabName === 'dashboard') {
    renderACWRChart();
  } else if (tabName === 'scientific') {
    renderScientificCalcs();
  } else if (tabName === 'planner') {
    renderTrainingPlan();
  } else if (tabName === 'shoes') {
    renderShoes();
  }
}

function updateLockBadge() {
  const badge = document.getElementById('lockBadge');
  const btn = document.getElementById('lockToggleBtn');
  if (!badge || !btn) return;

  if (AppState.isUnlocked) {
    badge.className = 'px-2 py-0.5 text-xs font-mono rounded-full bg-lime-950 text-lime-400 border border-lime-500/40 flex items-center gap-1';
    badge.innerHTML = `<span>🔓</span><span>EDICIÓN HABILITADA</span>`;
    btn.innerHTML = `<span>🔒 Bloquear</span>`;
    btn.className = 'text-xs text-slate-400 hover:text-rose-400 transition underline cursor-pointer';
  } else {
    badge.className = 'px-2 py-0.5 text-xs font-mono rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1';
    badge.innerHTML = `<span>🔒</span><span>SOLO LECTURA</span>`;
    btn.innerHTML = `<span>Ingresar PIN</span>`;
    btn.className = 'text-xs text-lime-400 hover:text-lime-300 font-semibold underline cursor-pointer';
  }
}

function renderProfileSelector() {
  const select = document.getElementById('profileSelector');
  if (!select) return;
  select.innerHTML = '';

  AppState.profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} [PIN: ${p.pin}]`;
    if (p.id === AppState.currentProfileId) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderDashboardStats() {
  const profile = getCurrentProfile();
  const profileWorkouts = AppState.workouts.filter(w => w.profileId === profile.id);

  // Totales
  const totalKm = profileWorkouts.reduce((acc, w) => acc + (parseFloat(w.distance) || 0), 0);
  const totalRuns = profileWorkouts.length;
  const acwrData = calculateACWR(profileWorkouts);

  // KPIs
  document.getElementById('kpiTotalKm').textContent = totalKm.toFixed(1);
  document.getElementById('kpiTotalRuns').textContent = totalRuns;
  document.getElementById('kpiAcwrVal').textContent = acwrData.acwr.toFixed(2);
  document.getElementById('kpiAcwrBadge').textContent = acwrData.badgeText;
  document.getElementById('kpiAcwrBadge').style.borderColor = acwrData.color;
  document.getElementById('kpiAcwrBadge').style.color = acwrData.color;

  document.getElementById('kpiAcuteLoad').textContent = `${acwrData.acuteLoad} AU`;
  document.getElementById('kpiChronicLoad').textContent = `${acwrData.chronicLoad} AU`;

  // Render tabla de entrenamientos recientes
  const tbody = document.getElementById('recentWorkoutsTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    const sorted = [...profileWorkouts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 7);

    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500 font-mono text-xs">No hay entrenamientos registrados para este perfil.</td></tr>`;
      return;
    }

    sorted.forEach(w => {
      const pace = calculatePace(w.distance, w.duration);
      const gapSec = calculateMinettiGAP(pace.paceSec, w.elevationGain || 0, w.distance);
      const gapStr = secondsToPaceString(gapSec);
      const weather = calculateDewPointAndPenalty(w.tempC, w.humidityPct, pace.paceSec);

      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs font-mono';
      tr.innerHTML = `
        <td class="py-2.5 px-3 text-slate-300">${w.date}</td>
        <td class="py-2.5 px-3 text-lime-400 font-bold">${w.distance} km</td>
        <td class="py-2.5 px-3 text-slate-300">${w.duration}</td>
        <td class="py-2.5 px-3 text-cyan-400 font-semibold">${pace.paceStr} <span class="text-[10px] text-slate-500">GAP: ${gapStr}</span></td>
        <td class="py-2.5 px-3 text-slate-400">${w.avgHr || '--'} bpm</td>
        <td class="py-2.5 px-3 text-slate-400">
          <span class="px-1.5 py-0.5 rounded text-[10px] ${w.rpe >= 8 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-slate-800 text-slate-300'}">RPE ${w.rpe || '--'}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function renderACWRChart() {
  const canvas = document.getElementById('acwrChartCanvas');
  if (!canvas) return;

  const profile = getCurrentProfile();
  const profileWorkouts = AppState.workouts.filter(w => w.profileId === profile.id);

  // Generar etiquetas de los últimos 28 días
  const labels = [];
  const acuteData = [];
  const chronicData = [];
  const ratioData = [];
  const safeZoneUpper = [];
  const safeZoneLower = [];

  const now = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

    const res = calculateACWR(profileWorkouts, d);
    acuteData.push(res.acuteLoad);
    chronicData.push(res.chronicLoad);
    ratioData.push(res.acwr);
    safeZoneUpper.push(1.3);
    safeZoneLower.push(0.8);
  }

  if (AppState.chartInstance) {
    AppState.chartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  AppState.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ratio ACWR (Agudo / Crónico)',
          data: ratioData,
          borderColor: '#a3e635', // Lime neon
          backgroundColor: 'rgba(163, 230, 53, 0.1)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#a3e635',
          tension: 0.3,
          yAxisID: 'yRatio'
        },
        {
          label: 'Límite Seguro Sup (1.3)',
          data: safeZoneUpper,
          borderColor: '#fbbf24', // Amber
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'yRatio'
        },
        {
          label: 'Límite Seguro Inf (0.8)',
          data: safeZoneLower,
          borderColor: '#38bdf8', // Sky
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'yRatio'
        },
        {
          label: 'Carga Aguda (7d)',
          data: acuteData,
          borderColor: '#06b6d4', // Cyan
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          borderWidth: 1,
          pointRadius: 0,
          fill: true,
          tension: 0.2,
          yAxisID: 'yLoad'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: { family: 'ui-monospace, SFMono-Regular, Menlo, monospace', size: 10 }
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#a3e635',
          bodyColor: '#f8fafc',
          borderColor: '#334155',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: { color: '#64748b', font: { family: 'monospace', size: 9 } }
        },
        yRatio: {
          type: 'linear',
          position: 'left',
          min: 0.4,
          max: 2.0,
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: {
            color: '#a3e635',
            font: { family: 'monospace', size: 10 }
          },
          title: {
            display: true,
            text: 'Ratio ACWR',
            color: '#a3e635',
            font: { size: 10, family: 'monospace' }
          }
        },
        yLoad: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: {
            color: '#06b6d4',
            font: { family: 'monospace', size: 10 }
          },
          title: {
            display: true,
            text: 'Carga (AU)',
            color: '#06b6d4',
            font: { size: 10, family: 'monospace' }
          }
        }
      }
    }
  });
}

function renderScientificCalcs() {
  const profile = getCurrentProfile();

  // 1. Zonas Karvonen
  const zones = calculateKarvonenZones(profile.hrRest, profile.hrMax);
  const zonesContainer = document.getElementById('karvonenZonesList');
  if (zonesContainer) {
    zonesContainer.innerHTML = '';
    zones.forEach(z => {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex justify-between items-center';
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="w-2.5 h-8 rounded-full" style="background-color: ${z.color}"></span>
          <div>
            <div class="text-xs font-bold text-white font-mono">${z.zone}: ${z.name}</div>
            <div class="text-[11px] text-slate-400">${z.desc}</div>
          </div>
        </div>
        <div class="text-right font-mono">
          <div class="text-sm font-bold text-lime-400">${z.min} - ${z.max} <span class="text-[10px] text-slate-500">bpm</span></div>
          <div class="text-[10px] text-slate-400">${z.pctRange} HRR</div>
        </div>
      `;
      zonesContainer.appendChild(card);
    });
  }

  // 2. VDOT y Ritmos Jack Daniels
  const paces = getDanielsTrainingPaces(profile.vdot);
  document.getElementById('currentVdotDisplay').textContent = profile.vdot;
  document.getElementById('paceEasy').textContent = `${paces.easy} /km`;
  document.getElementById('paceMarathon').textContent = `${paces.marathon} /km`;
  document.getElementById('paceThreshold').textContent = `${paces.threshold} /km`;
  document.getElementById('paceInterval').textContent = `${paces.interval} /km`;
  document.getElementById('paceRepetition').textContent = `${paces.repetition} /km`;
}

function renderTrainingPlan() {
  const profile = getCurrentProfile();
  const container = document.getElementById('microcycleContainer');
  const title = document.getElementById('planTitle');
  const subtitle = document.getElementById('planSubtitle');
  if (!container) return;

  const isElite = profile.planType === 'elite';

  title.textContent = isElite ? 'LÓGICA A: MICRO-CICLO ÉLITE (6 DÍAS / SEMANA)' : 'LÓGICA B: MICRO-CICLO PROGRESIÓN SUB-60 (5 DÍAS / SEMANA)';
  subtitle.textContent = isElite ? 'Enfoque: Bajar 10K a 38:00 y 5K a 18:00 | Alto volumen y series umbral' : 'Enfoque: Bajar 10K de 1:23:00 a 60:00-65:00 | Base aeróbica y prevención de periostitis';

  const planA = [
    { day: 'Lunes', type: 'Recuperación Activa Z1', volume: '8.0 km', pace: '4:45 /km', desc: 'Rodaje regenerativo suave + 15 min de estiramientos dinámicos y movilidad de cadera.' },
    { day: 'Martes', type: 'Series VO2máx en Pista', volume: '14.0 km', pace: '3:35 /km', desc: '3 km calentamiento + 6 x 1000m a ritmo de 3:35/km con 90s trote Z1 de recuperación + 2 km enfriamiento.' },
    { day: 'Miércoles', type: 'Base Aeróbica Z2 + Rectas', volume: '12.0 km', pace: '4:20 /km', desc: 'Rodaje continuo Z2 estricto finalizando con 6 aceleraciones técnicas de 100m en césped.' },
    { day: 'Jueves', type: 'Tempo Umbral de Lactato Z4', volume: '15.0 km', pace: '3:45 /km', desc: '3 km cal. + 3 x 3000m sostenido a 3:45/km (recup 2 min Z1) + 3 km enfriamiento.' },
    { day: 'Viernes', type: 'Descanso Activo / Core', volume: '0 km', pace: '--', desc: 'Sesión de estabilidad lumbopélvica, puente de glúteos, planchas y prevención excéntrica de isquiotibiales.' },
    { day: 'Sábado', type: 'Fartlek Piramidal', volume: '11.0 km', pace: 'Variable', desc: 'Cambios de ritmo: 1-2-3-2-1 min en Z5 con igual tiempo de recuperación en Z2.' },
    { day: 'Domingo', type: 'Tirada Larga Progresiva', volume: '22.0 km', pace: '4:15 - 4:40 /km', desc: '14 km en Zona 2 + 6 km en Ritmo Maratón (M) + 2 km de vuelta a la calma.' }
  ];

  const planB = [
    { day: 'Lunes', type: 'Descanso Total + Protocolo Tibial', volume: '0 km', pace: '--', desc: 'Cero impacto. 3 series de 20 elevaciones de puntas contra la pared para hipertrofiar el tibial anterior y evitar periostitis.' },
    { day: 'Martes', type: 'Base Aeróbica Z2 (Sin Fatiga)', volume: '6.0 km', pace: '7:00 /km', desc: 'Carrera muy controlada. Si la FC supera 140 bpm, caminar 30 segundos hasta estabilizar la respiración nasal.' },
    { day: 'Miércoles', type: 'Descanso Activo / Paseo', volume: '0 km', pace: '--', desc: 'Caminata relajada de 40 min con mascotas o paseo ligero. Movilidad de tobillos con banda elástica.' },
    { day: 'Jueves', type: 'Fartlek Controlado Sub-60', volume: '5.5 km', pace: '5:55 / 7:15 /km', desc: '1.5 km Z2 + 8 repeticiones de [1 min a 5:55/km + 1 min caminata enérgica] + 1 km enfriamiento.' },
    { day: 'Viernes', type: 'Fuerza Excéntrica para Corredores', volume: '0 km', pace: '--', desc: 'Sentadillas búlgaras, elevación de talones en escalón con bajada lenta en 3 segundos (fortalecimiento de sóleo/Aquiles).' },
    { day: 'Sábado', type: 'Rodaje a Ritmo Objetivo Sub-60', volume: '8.0 km', pace: '5:59 /km', desc: '2 km Z2 + 4 km sostenidos exactamente a 5:59/km (ritmo meta para 10K en 59:59) + 2 km suaves.' },
    { day: 'Domingo', type: 'Tirada Larga Aeróbica Conversacional', volume: '10.0 km', pace: '7:15 /km', desc: 'Rodaje continuo a ritmo donde puedas mantener una conversación fluida. Hidratación constante cada 2.5 km.' }
  ];

  const activePlan = isElite ? planA : planB;
  container.innerHTML = '';

  activePlan.forEach(p => {
    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-3';
    card.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="px-2 py-1 bg-slate-800 text-lime-400 font-mono text-xs font-bold rounded-lg">${p.day}</span>
        <div>
          <h4 class="text-sm font-bold text-white font-mono">${p.type}</h4>
          <p class="text-xs text-slate-400 mt-0.5">${p.desc}</p>
        </div>
      </div>
      <div class="flex items-center gap-4 text-right font-mono self-end md:self-center">
        <div>
          <div class="text-xs text-slate-500 uppercase">Volumen</div>
          <div class="text-sm font-bold text-cyan-400">${p.volume}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500 uppercase">Ritmo</div>
          <div class="text-sm font-bold text-lime-400">${p.pace}</div>
        </div>
        <button onclick="prefillIngestFromPlan('${p.volume.replace(' km', '')}', '${p.type}')" class="px-2.5 py-1 bg-slate-900 border border-lime-500/30 text-lime-400 hover:bg-lime-950 text-xs rounded-lg transition" title="Registrar esta sesión">
          + Ingerir
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderShoes() {
  const profile = getCurrentProfile();
  const shoesContainer = document.getElementById('shoesListContainer');
  const shoeSelectIngest = document.getElementById('ingestShoeSelect');
  if (!shoesContainer) return;

  const profileShoes = AppState.shoes.filter(s => s.profileId === profile.id);

  // Selector en formulario de ingesta
  if (shoeSelectIngest) {
    shoeSelectIngest.innerHTML = '';
    profileShoes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.brand} ${s.model} (${s.currentKm.toFixed(1)} / ${s.maxKm} km)`;
      shoeSelectIngest.appendChild(opt);
    });
  }

  shoesContainer.innerHTML = '';

  if (profileShoes.length === 0) {
    shoesContainer.innerHTML = `<div class="p-8 text-center text-slate-500 font-mono text-xs">No tienes zapatillas registradas para este atleta. Haz clic en "+ Agregar Zapatilla".</div>`;
    return;
  }

  profileShoes.forEach(shoe => {
    const pct = Math.min(100, Math.round((shoe.currentKm / shoe.maxKm) * 100));
    let colorClass = 'bg-lime-500';
    let textClass = 'text-lime-400';
    if (pct > 85) {
      colorClass = 'bg-red-500';
      textClass = 'text-red-400';
    } else if (pct > 60) {
      colorClass = 'bg-amber-500';
      textClass = 'text-amber-400';
    }

    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between gap-3';
    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">${shoe.usage}</span>
          <h4 class="text-base font-bold text-white font-mono mt-1">${shoe.brand} ${shoe.model}</h4>
          <p class="text-xs text-slate-400 font-mono">${shoe.foam}</p>
        </div>
        <div class="text-right">
          <span class="text-lg font-bold font-mono ${textClass}">${pct}%</span>
          <div class="text-[10px] text-slate-500 uppercase font-mono">Desgaste</div>
        </div>
      </div>

      <div>
        <div class="flex justify-between text-xs font-mono mb-1">
          <span class="text-slate-400">Kilometraje acumulado:</span>
          <span class="text-white font-bold">${shoe.currentKm.toFixed(1)} / ${shoe.maxKm} km</span>
        </div>
        <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div class="${colorClass} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>

      <div class="flex justify-between items-center pt-2 border-t border-slate-800/80 text-xs font-mono">
        <span class="text-slate-500">${(shoe.maxKm - shoe.currentKm).toFixed(1)} km restantes</span>
        <button onclick="checkPermissionOrPrompt(() => deleteShoe('${shoe.id}'))" class="text-slate-500 hover:text-rose-400 transition" title="Eliminar par">
          Eliminar
        </button>
      </div>
    `;
    shoesContainer.appendChild(card);
  });
}

function prefillIngestFromPlan(distStr, typeStr) {
  switchTab('ingest');
  const distInput = document.getElementById('ingestDistance');
  const notesInput = document.getElementById('ingestNotes');
  if (distInput) distInput.value = distStr;
  if (notesInput) notesInput.value = `Sesión de plan: ${typeStr}`;
  showToast(`📋 Datos precargados desde el plan (${distStr} km). Completa las métricas de tu reloj.`, 'info');
}

// ============================================================================
// 7. MANEJO DE FORMULARIOS: INGESTA DE SMARTWATCHES
// ============================================================================

function setupIngestForm() {
  const form = document.getElementById('smartwatchIngestForm');
  if (!form) return;

  // Fecha predeterminada de hoy
  const dateInput = document.getElementById('ingestDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    checkPermissionOrPrompt(() => {
      const distance = parseFloat(document.getElementById('ingestDistance').value);
      const durationStr = document.getElementById('ingestDuration').value.trim();
      const elevationGain = parseFloat(document.getElementById('ingestElevation').value) || 0;
      const tempC = parseFloat(document.getElementById('ingestTemp').value);
      const humidityPct = parseFloat(document.getElementById('ingestHumidity').value);
      const avgHr = parseInt(document.getElementById('ingestAvgHr').value) || null;
      const maxHr = parseInt(document.getElementById('ingestMaxHr').value) || null;
      const cadence = parseInt(document.getElementById('ingestCadence').value) || null;
      const vo2Max = parseFloat(document.getElementById('ingestVo2').value) || null;
      const rpe = parseInt(document.getElementById('ingestRpe').value) || 6;
      const shoeId = document.getElementById('ingestShoeSelect').value;
      const watchPreset = document.getElementById('ingestBrandPreset').value;
      const notes = document.getElementById('ingestNotes').value;
      const date = document.getElementById('ingestDate').value;

      if (isNaN(distance) || distance <= 0 || !durationStr) {
        showToast('⚠️ Por favor ingresa una distancia y tiempo válidos.', 'error');
        return;
      }

      const newWorkout = {
        id: `run-${Date.now()}`,
        profileId: AppState.currentProfileId,
        date: date || new Date().toISOString().split('T')[0],
        distance,
        duration: durationStr,
        elevationGain,
        tempC,
        humidityPct,
        avgHr,
        maxHr,
        cadence,
        vo2MaxEstimate: vo2Max,
        rpe,
        shoeId,
        brandPreset: watchPreset,
        notes
      };

      // Guardar entrenamiento
      AppState.workouts.unshift(newWorkout);
      saveWorkouts();

      // Actualizar automáticamente kilometraje de la zapatilla seleccionada
      if (shoeId) {
        const shoe = AppState.shoes.find(s => s.id === shoeId);
        if (shoe) {
          shoe.currentKm += distance;
          saveShoes();
        }
      }

      showToast(`✅ Sesión de ${distance} km registrada correctamente y sincronizada.`, 'success');
      form.reset();
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      switchTab('dashboard');
      renderAll();
    });
  });
}

// ============================================================================
// 8. MANEJO DE CALCULADORAS DE LABORATORIO Y HERRAMIENTAS
// ============================================================================

function setupScientificLabForms() {
  // Calculadora de Test de Sudoración
  const sweatBtn = document.getElementById('btnCalculateSweat');
  if (sweatBtn) {
    sweatBtn.addEventListener('click', () => {
      const pre = document.getElementById('sweatPreWeight').value;
      const post = document.getElementById('sweatPostWeight').value;
      const fluid = document.getElementById('sweatFluidMl').value;
      const dur = document.getElementById('sweatDurationMin').value;

      const res = calculateSweatTest(pre, post, fluid, dur);
      if (!res) {
        showToast('⚠️ Completa todos los campos numéricos del test.', 'error');
        return;
      }

      document.getElementById('sweatRateResult').textContent = `${res.sweatRatePerHourL} L/h`;
      document.getElementById('sweatTotalLostResult').textContent = `${res.totalSweatLostL} L`;
      document.getElementById('sweatDehydrationResult').textContent = `${res.dehydrationPct}%`;
      document.getElementById('sweatRehydrationResult').textContent = `${res.rehydrationNeededMl} ml`;
      document.getElementById('sweatSodiumResult').textContent = `${res.sodiumReplenishmentMg} mg Na+`;
      document.getElementById('sweatResultsBox').classList.remove('hidden');
    });
  }

  // Calculadora de Ventana Metabólica
  const windowBtn = document.getElementById('btnCalculateWindow');
  if (windowBtn) {
    windowBtn.addEventListener('click', () => {
      const weight = document.getElementById('metaWeight').value;
      const dur = document.getElementById('metaDuration').value;
      const intensity = document.getElementById('metaIntensity').value;

      const res = calculateMetabolicWindow(weight, dur, intensity);
      if (!res) {
        showToast('⚠️ Ingresa un peso y duración válidos.', 'error');
        return;
      }

      document.getElementById('metaChoResult').textContent = `${res.choGrams} g`;
      document.getElementById('metaProResult').textContent = `${res.proGrams} g`;
      document.getElementById('metaRatioResult').textContent = res.ratio;
      document.getElementById('metaKcalResult').textContent = `${res.totalKcal} kcal`;

      const list = document.getElementById('metaSuggestionsList');
      list.innerHTML = '';
      res.foodSuggestions.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s;
        list.appendChild(li);
      });

      document.getElementById('metaResultsBox').classList.remove('hidden');
    });
  }

  // Calculadora interactiva GAP / Clima
  const gapCalcBtn = document.getElementById('btnCalcInteractiveGap');
  if (gapCalcBtn) {
    gapCalcBtn.addEventListener('click', () => {
      const dist = parseFloat(document.getElementById('gapDistInput').value) || 10;
      const paceStr = document.getElementById('gapPaceInput').value || '5:00';
      const elev = parseFloat(document.getElementById('gapElevInput').value) || 0;
      const temp = parseFloat(document.getElementById('gapTempInput').value) || 20;
      const hum = parseFloat(document.getElementById('gapHumInput').value) || 50;

      const paceSec = timeStringToSeconds(paceStr);
      const gapSec = calculateMinettiGAP(paceSec, elev, dist);
      const weather = calculateDewPointAndPenalty(temp, hum, paceSec);

      document.getElementById('gapOutputPace').textContent = secondsToPaceString(gapSec);
      document.getElementById('weatherOutputDew').textContent = `${weather.dewPoint}°C`;
      document.getElementById('weatherOutputPenalty').textContent = `+${weather.penaltySecPerKm} s/km (${weather.penaltyPct}%)`;
    });
  }
}

function setupShoeModal() {
  const addBtn = document.getElementById('btnOpenAddShoeModal');
  const modal = document.getElementById('addShoeModal');
  const closeBtn = document.getElementById('btnCloseShoeModal');
  const form = document.getElementById('addShoeForm');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      checkPermissionOrPrompt(() => {
        modal.classList.remove('hidden');
      });
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const brand = document.getElementById('shoeBrand').value.trim();
      const model = document.getElementById('shoeModel').value.trim();
      const foam = document.getElementById('shoeFoam').value.trim();
      const usage = document.getElementById('shoeUsage').value;
      const maxKm = parseFloat(document.getElementById('shoeMaxKm').value) || 700;
      const currentKm = parseFloat(document.getElementById('shoeCurrentKm').value) || 0;

      if (!brand || !model) {
        showToast('⚠️ Ingresa la marca y modelo.', 'error');
        return;
      }

      const newShoe = {
        id: `shoe-${Date.now()}`,
        profileId: AppState.currentProfileId,
        brand,
        model,
        foam,
        usage,
        maxKm,
        currentKm,
        active: true
      };

      AppState.shoes.push(newShoe);
      saveShoes();
      modal.classList.add('hidden');
      form.reset();
      renderShoes();
      showToast(`👟 Zapatilla ${brand} ${model} añadida con éxito.`, 'success');
    });
  }
}

function deleteShoe(shoeId) {
  AppState.shoes = AppState.shoes.filter(s => s.id !== shoeId);
  saveShoes();
  renderShoes();
  showToast('🗑️ Zapatilla eliminada de la rotación.', 'info');
}

// ============================================================================
// 9. MODAL DE PIN Y SEGURIDAD
// ============================================================================

let pendingActionCallback = null;

function openPinModal(callback) {
  pendingActionCallback = callback;
  const modal = document.getElementById('pinAuthModal');
  const pinInput = document.getElementById('pinInputElement');
  if (modal) modal.classList.remove('hidden');
  if (pinInput) {
    pinInput.value = '';
    pinInput.focus();
  }
}

function closePinModal() {
  const modal = document.getElementById('pinAuthModal');
  if (modal) modal.classList.add('hidden');
  pendingActionCallback = null;
}

function setupPinModalEvents() {
  const submitBtn = document.getElementById('btnSubmitPin');
  const cancelBtn = document.getElementById('btnCancelPin');
  const pinInput = document.getElementById('pinInputElement');

  if (submitBtn && pinInput) {
    submitBtn.addEventListener('click', () => {
      const val = pinInput.value.trim();
      if (verifyPin(val)) {
        if (typeof pendingActionCallback === 'function') {
          pendingActionCallback();
        }
      }
    });

    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closePinModal);
  }

  // Botón para alternar bloqueo
  const lockToggle = document.getElementById('lockToggleBtn');
  if (lockToggle) {
    lockToggle.addEventListener('click', () => {
      if (AppState.isUnlocked) {
        lockProfile();
      } else {
        openPinModal();
      }
    });
  }
}

// ============================================================================
// 10. NOTIFICACIONES TOAST FLOTANTES
// ============================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-slate-900 border-lime-500 text-lime-400' :
             type === 'error' ? 'bg-slate-900 border-red-500 text-red-400' :
             'bg-slate-900 border-cyan-500 text-cyan-400';

  toast.className = `px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2 text-xs font-mono transition-all duration-300 transform translate-y-2 opacity-0 ${bg}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================================
// 11. INICIALIZACIÓN GLOBAL
// ============================================================================

function renderAll() {
  updateLockBadge();
  renderProfileSelector();
  renderDashboardStats();
  renderACWRChart();
  renderScientificCalcs();
  renderTrainingPlan();
  renderShoes();
}

document.addEventListener('DOMContentLoaded', () => {
  initializeStorage();

  // Escuchar cambio de perfil
  const profileSelector = document.getElementById('profileSelector');
  if (profileSelector) {
    profileSelector.addEventListener('change', (e) => {
      switchProfile(e.target.value);
    });
  }

  // Navegación de pestañas
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  setupIngestForm();
  setupScientificLabForms();
  setupShoeModal();
  setupPinModalEvents();

  // Render inicial
  renderAll();

  // Registrar Service Worker para PWA Offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('RunPulse Service Worker registrado con éxito:', reg.scope))
      .catch(err => console.warn('Fallo en el registro de Service Worker:', err));
  }
});
