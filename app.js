/**
 * ============================================================================
 * RUNPULSE PRO - ATLETISMO DE RUTA CIENTÍFICO (app.js)
 * ============================================================================
 * Sistema Personal y Exclusivo para: Dykembel Vargas (24 años, 52 kg, 1.64m)
 * Objetivos a 1 Año: 5K Sub-18:00 (3:36/km) & 10K Sub-37:00 (3:42/km)
 * Marcas Base: 1000m pista 3:22 (Reciente 3:30) | 5K PB 18:44 (Reciente 19:26)
 * Diseño Visual: Modo oscuro relajante, bajo contraste, tipografía monoespaciada
 * y acentos suaves en verde salvia y azul acero.
 * ============================================================================
 */

// ============================================================================
// 1. ESTADO INICIAL HARDCODEADO Y CONFIGURACIÓN DEL ATLETA
// ============================================================================

const ATHLETE_PROFILE = {
  name: 'Dykembel Vargas',
  age: 24,
  weight: 52.0,         // kg (peso de competición ligero)
  height: 1.64,         // metros (IMC: 19.3)
  hrRest: 46,           // bpm (Frecuencia basal en reposo matutino)
  hrMax: 193,           // bpm (Frecuencia máxima observada en pista)
  frequencyDaysPerWeek: 6,

  // Marcas Oficiales e Históricas
  records: {
    track1000m: { pb: '3:22', recent: '3:30', paceRecentSec: 210, paceRecentStr: '3:30 /km' },
    race5k: { pb: '18:44', pbPaceStr: '3:45 /km', recent: '19:26', recentPaceSec: 233, recentPaceStr: '3:53 /km' },
    race10k: { pb: '42:36', pbNote: 'split oficial en carrera de 10.5K (~4:03/km)' },
    race21k: { pb: '1:54:00' }
  },

  // Metas del Próximo Año
  targets: {
    target5k: { time: '17:59', paceSec: 215.8, paceStr: '3:36 /km', vdotNeeded: 56.6, label: '5K Sub-18:00' },
    target10k: { time: '36:59', paceSec: 221.9, paceStr: '3:42 /km', vdotNeeded: 57.0, label: '10K Sub-37:00' }
  },

  // VDOT Calculado a partir de marcas recientes:
  // 5K en 19:26 = 51.8 VDOT. Test 1000m en 3:30 = 52.0 VDOT equivalente.
  baseVdot: 51.8,
  currentDynamicVdot: 51.8
};

const DEFAULT_SHOES = [
  {
    id: 'asics-gt1000',
    brand: 'Asics',
    model: 'GT-1000 10',
    usage: 'Soporte leve / Rodajes aeróbicos diarios Z2',
    currentKm: 0.0,
    maxKm: 800,
    category: 'daily'
  },
  {
    id: 'adidas-boston11',
    brand: 'Adidas',
    model: 'Adizero Boston 11',
    usage: 'Mixtas / Series de velocidad / Ritmo Umbral (Lightstrike Pro)',
    currentKm: 0.0,
    maxKm: 600,
    category: 'quality'
  },
  {
    id: 'olympikus-corre2',
    brand: 'Olympikus',
    model: 'Corre 2',
    usage: 'Ligeras / Fondos largos dominicales / Recuperación Z1',
    currentKm: 0.0,
    maxKm: 600,
    category: 'longrun'
  }
];

const STORAGE_KEYS = {
  WORKOUTS: 'runpulse_dykembel_workouts_v1',
  SHOES: 'runpulse_dykembel_shoes_v1',
  DYNAMIC_STATE: 'runpulse_dykembel_state_v1'
};

const AppState = {
  workouts: [],
  shoes: [],
  dynamicVdot: ATHLETE_PROFILE.baseVdot,
  fatigueAdjustmentSec: 0, // Ajuste dinámico de ritmo (+ seg/km si hay sobrecarga)
  fatigueStatus: 'normal', // 'normal', 'fatigued', 'supercompensated'
  activeTab: 'dashboard',
  chartInstance: null
};

// ============================================================================
// 2. FÓRMULAS MATEMÁTICAS Y FISIOLÓGICAS COMENTADAS
// ============================================================================

/**
 * ----------------------------------------------------------------------------
 * A. ZONAS DE ENTRENAMIENTO POR FRECUENCIA CARDÍACA DE RESERVA (KARVONEN)
 * ----------------------------------------------------------------------------
 * Frecuencia Cardíaca de Reserva (HRR):
 *   HRR = HR_max - HR_rest = 193 - 46 = 147 bpm
 *   HR_target = HR_rest + (%Intensidad * HRR)
 *
 * Zonas individuales calculadas para Dykembel Vargas:
 * - Z1 (50% - 60% HRR): 120 - 134 bpm | Recuperación activa, reciclaje de lactato
 * - Z2 (60% - 70% HRR): 134 - 149 bpm | Base aeróbica, FatMax (máxima quema de ácidos grasos)
 * - Z3 (70% - 80% HRR): 149 - 164 bpm | Tempo aeróbico, aumento de capilarización muscular
 * - Z4 (80% - 90% HRR): 164 - 178 bpm | Umbral de Lactato (LT2 / OBLA, ~4.0 mmol/L)
 * - Z5 (90% - 100% HRR): 178 - 193 bpm | VO2máx & Capacidad anaeróbica láctica
 */
function getKarvonenZones(hrRest = ATHLETE_PROFILE.hrRest, hrMax = ATHLETE_PROFILE.hrMax) {
  const hrr = hrMax - hrRest;
  return [
    {
      zone: 'Z1',
      name: 'Regenerativo / Recup. Activa',
      pct: '50% - 60%',
      min: Math.round(hrRest + 0.50 * hrr),
      max: Math.round(hrRest + 0.60 * hrr),
      color: '#94a3b8',
      desc: 'Rodajes suaves post-series para irrigación sanguínea sin estrés tisular.'
    },
    {
      zone: 'Z2',
      name: 'Base Aeróbica (FatMax)',
      pct: '60% - 70%',
      min: Math.round(hrRest + 0.60 * hrr),
      max: Math.round(hrRest + 0.70 * hrr),
      color: '#6ee7b7',
      desc: 'Rodajes fundamentales de volumen. Máxima biogénesis mitocondrial.'
    },
    {
      zone: 'Z3',
      name: 'Tempo / Sub-Umbral',
      pct: '70% - 80%',
      min: Math.round(hrRest + 0.70 * hrr),
      max: Math.round(hrRest + 0.80 * hrr),
      color: '#38bdf8',
      desc: 'Ritmo crucero para construcción de resistencia en distancias medias.'
    },
    {
      zone: 'Z4',
      name: 'Umbral de Lactato (LT2)',
      pct: '80% - 90%',
      min: Math.round(hrRest + 0.80 * hrr),
      max: Math.round(hrRest + 0.90 * hrr),
      color: '#fcd34d',
      desc: 'Ritmo umbral sostenible por 50-60 min. Eleva el punto de inflexión de lactato.'
    },
    {
      zone: 'Z5',
      name: 'Potencia Aeróbica (VO2máx)',
      pct: '90% - 100%',
      min: Math.round(hrRest + 0.90 * hrr),
      max: hrMax,
      color: '#f87171',
      desc: 'Series de 1000m en pista a ritmo de 3:25 - 3:30/km para expandir la VAM.'
    }
  ];
}

/**
 * ----------------------------------------------------------------------------
 * B. MODELO VDOT AERÓBICO DE JACK DANIELS
 * ----------------------------------------------------------------------------
 * 1. Costo de oxígeno a velocidad v (metros / minuto):
 *    VO2(v) = -4.60 + 0.182258 * v + 0.000104 * v^2
 *
 * 2. Fracción de VO2máx sostenible para duración t (minutos):
 *    f(t) = 0.8 + 0.1894393 * exp(-0.012778 * t) + 0.2989558 * exp(-0.1932605 * t)
 *
 * 3. VDOT = VO2(v) / f(t)
 *
 * 4. Paces según % VDOT:
 *    - Easy (E): 70% VDOT (4:45 - 5:10/km)
 *    - Marathon (M): 80% VDOT (4:12 - 4:20/km)
 *    - Threshold / Umbral (T): 88% VDOT (3:52 - 3:56/km)
 *    - Interval / VO2máx (I): 97.5% VDOT (3:28 - 3:32/km -> series de 1000m en pista)
 *    - Repetition / Velocidad (R): 107% VDOT (3:15 - 3:20/km -> rectas y series de 200/400m)
 */
function calculateVDOTFromRace(distanceMeters, timeMinutes) {
  if (!distanceMeters || !timeMinutes || timeMinutes <= 0) return ATHLETE_PROFILE.baseVdot;
  const v = distanceMeters / timeMinutes;
  const vo2 = -4.60 + (0.182258 * v) + (0.000104 * Math.pow(v, 2));
  const fract = 0.80 + 0.1894393 * Math.exp(-0.012778 * timeMinutes) + 0.2989558 * Math.exp(-0.1932605 * timeMinutes);
  if (fract <= 0) return 30.0;
  return Number((vo2 / fract).toFixed(1));
}

function getVelocityFromVO2(vo2Target) {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(vo2Target + 4.60);
  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0) return 150;
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

function paceFromVelocity(vMetersPerMin, extraOffsetSec = 0) {
  if (vMetersPerMin <= 0) return '--:--';
  const paceMinutes = (1000 / vMetersPerMin) + (extraOffsetSec / 60);
  const mins = Math.floor(paceMinutes);
  const secs = Math.round((paceMinutes - mins) * 60);
  const paddedSecs = secs < 10 ? `0${secs}` : (secs === 60 ? '00' : secs);
  const adjustedMins = secs === 60 ? mins + 1 : mins;
  return `${adjustedMins}:${paddedSecs}`;
}

function getDanielsPaces(vdot, fatigueOffsetSec = 0) {
  const v = parseFloat(vdot) || ATHLETE_PROFILE.baseVdot;
  return {
    easy: paceFromVelocity(getVelocityFromVO2(v * 0.70), fatigueOffsetSec),
    marathon: paceFromVelocity(getVelocityFromVO2(v * 0.80), fatigueOffsetSec),
    threshold: paceFromVelocity(getVelocityFromVO2(v * 0.88), fatigueOffsetSec),
    interval: paceFromVelocity(getVelocityFromVO2(v * 0.975), fatigueOffsetSec),
    repetition: paceFromVelocity(getVelocityFromVO2(v * 1.07), fatigueOffsetSec)
  };
}

/**
 * ----------------------------------------------------------------------------
 * C. RATIO DE CARGA AGUDA : CRÓNICA (ACWR - GABBETT MODEL)
 * ----------------------------------------------------------------------------
 * Cuantificación del balance carga-fatiga para prevenir sobreentrenamiento:
 *   Carga de Sesión (AU) = Duración (minutos) * RPE (Borg 1-10)
 *   Carga Aguda = Promedio de carga de los últimos 7 días.
 *   Carga Crónica = Promedio de carga de los últimos 28 días.
 *   ACWR = Carga Aguda / Carga Crónica
 *
 * Zonas:
 * - < 0.8: Sub-entrenamiento
 * - 0.8 a 1.3: "Sweet Spot" (Zona óptima de adaptación)
 * - 1.3 a 1.5: Zona de precaución
 * - > 1.5: Peligro de lesión músculo-tendinosa
 */
function calculateACWR(workouts, targetDate = new Date()) {
  if (!workouts || workouts.length === 0) {
    return { acuteLoad: 0, chronicLoad: 0, acwr: 0.0, status: 'nodata', badgeText: 'Pizarra Limpia (0 km)', color: '#94a3b8' };
  }

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const targetTime = new Date(targetDate).setHours(23, 59, 59, 999);

  let acuteSum = 0;
  let chronicSum = 0;

  for (let d = 0; d < 28; d++) {
    const dayStart = targetTime - ((d + 1) * ONE_DAY_MS);
    const dayEnd = targetTime - (d * ONE_DAY_MS);

    const dayWorkouts = workouts.filter(w => {
      const wTime = new Date(w.date).getTime();
      return wTime >= dayStart && wTime < dayEnd;
    });

    const dayLoad = dayWorkouts.reduce((sum, w) => {
      const durationMin = timeStringToMinutes(w.duration);
      const rpe = w.rpe || 5;
      return sum + (durationMin * rpe);
    }, 0);

    if (d < 7) acuteSum += dayLoad;
    chronicSum += dayLoad;
  }

  const acuteLoad = acuteSum / 7;
  const chronicLoad = chronicSum / 28;

  if (chronicLoad === 0 && acuteLoad === 0) {
    return { acuteLoad: 0, chronicLoad: 0, acwr: 0.0, status: 'nodata', badgeText: 'Sin carga reciente (0 AU)', color: '#94a3b8' };
  }

  const acwr = chronicLoad > 0 ? Number((acuteLoad / chronicLoad).toFixed(2)) : (acuteLoad > 0 ? 1.4 : 1.0);

  let status = 'optimal';
  let badgeText = 'Zona Óptima (0.8 - 1.3)';
  let color = '#6ee7b7'; // Verde salvia suave

  if (acwr < 0.8) {
    status = 'undertraining';
    badgeText = 'Sub-entrenamiento (< 0.8)';
    color = '#94a3b8'; // Gris azulado
  } else if (acwr > 1.5) {
    status = 'danger';
    badgeText = 'Alerta de Carga (> 1.5)';
    color = '#f87171'; // Rosa pastel alerta
  } else if (acwr > 1.3) {
    status = 'warning';
    badgeText = 'Precaución (1.3 - 1.5)';
    color = '#fcd34d'; // Ámbar suave
  }

  return { acuteLoad: Math.round(acuteLoad), chronicLoad: Math.round(chronicLoad), acwr, status, badgeText, color };
}

// ============================================================================
// 3. MOTOR DINÁMICO DE MICROCICLO Y ADAPTACIÓN AL ESFUERZO
// ============================================================================

/**
 * Analiza el historial reciente de entrenamientos de Dykembel para calibrar
 * automáticamente el VDOT dinámico o aplicar compensación por fatiga.
 */
function analyzeFatigueAndAdaptation() {
  const recentWorkouts = [...AppState.workouts]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  if (recentWorkouts.length === 0) {
    AppState.fatigueStatus = 'normal';
    AppState.fatigueAdjustmentSec = 0;
    AppState.dynamicVdot = ATHLETE_PROFILE.baseVdot;
    return;
  }

  let highFatigueCount = 0;
  let superCompCount = 0;

  recentWorkouts.forEach(w => {
    const pace = calculatePace(w.distance, w.duration);
    const rpe = parseInt(w.rpe) || 5;

    // Si reporta RPE > 8 en rodaje aeróbico o FC media elevada (> 165 bpm en rodaje suave)
    if (rpe >= 8 && w.distance <= 10) {
      highFatigueCount++;
    }

    // Si completa series o carrera a ritmo muy fuerte (< 3:35/km) con RPE moderado (<= 7)
    if (pace.paceSec > 0 && pace.paceSec <= 215 && rpe <= 7) {
      superCompCount++;
    }
  });

  if (highFatigueCount >= 2) {
    // Alerta de Fatiga: Ralentizar ritmos sugeridos entre +6 y +10 s/km para proteger sóleo y periostio
    AppState.fatigueStatus = 'fatigued';
    AppState.fatigueAdjustmentSec = 8;
    AppState.dynamicVdot = Math.max(49.0, ATHLETE_PROFILE.baseVdot - 0.8);
  } else if (superCompCount >= 1) {
    // Rendimiento superior: Atleta asimilando cargas positivamente
    AppState.fatigueStatus = 'supercompensated';
    AppState.fatigueAdjustmentSec = -3;
    AppState.dynamicVdot = Math.min(56.5, ATHLETE_PROFILE.baseVdot + 0.6);
  } else {
    AppState.fatigueStatus = 'normal';
    AppState.fatigueAdjustmentSec = 0;
    AppState.dynamicVdot = ATHLETE_PROFILE.baseVdot;
  }
}

/**
 * Genera el microciclo semanal de 6 días adaptado a las marcas de Dykembel:
 * 1 Fondo largo, 2 Calidades (Series 1000m pista y Umbral), 3 Rodajes aeróbicos, 1 Descanso.
 */
function generateDynamicMicrocycle() {
  const paces = getDanielsPaces(AppState.dynamicVdot, AppState.fatigueAdjustmentSec);
  const isFatigued = AppState.fatigueStatus === 'fatigued';

  return [
    {
      day: 'Lunes',
      type: 'Rodaje Aeróbico Z2 + Rectas',
      shoeId: 'asics-gt1000',
      shoeName: 'Asics GT-1000 10',
      volume: '10.0 km',
      targetPace: paces.easy,
      hrTarget: '135 - 148 bpm',
      desc: isFatigued
        ? 'Rodaje regenerativo suave a ritmo muy cómodo + 15 min de movilidad articular y estiramientos.'
        : 'Rodaje continuo en Z2 estricto finalizando con 5 rectas técnicas de 100m en césped (cadencia 180+ spm).'
    },
    {
      day: 'Martes',
      type: 'Calidad 1: Series 1000m en Pista (VAM / VO2máx)',
      shoeId: 'adidas-boston11',
      shoeName: 'Adidas Adizero Boston 11',
      volume: '13.5 km',
      targetPace: paces.interval,
      hrTarget: '178 - 190 bpm',
      desc: isFatigued
        ? 'Ajuste por fatiga: 4 x 1000m a ritmo controlado con 2 min de recuperación caminando/trotando.'
        : `3 km calentamiento + 5 x 1000m a ritmo de ${paces.interval} (PB reciente 3:30) con 90s trote Z1 + 2.5 km enfriamiento.`
    },
    {
      day: 'Miércoles',
      type: 'Rodaje de Asimilación Z1-Z2',
      shoeId: 'asics-gt1000',
      shoeName: 'Asics GT-1000 10',
      volume: '8.0 km',
      targetPace: paces.easy,
      hrTarget: '125 - 142 bpm',
      desc: 'Rodaje conversacional suave para facilitar el aclaramiento de lactato y la recuperación neuromuscular.'
    },
    {
      day: 'Jueves',
      type: 'Calidad 2: Ritmo Umbral de Lactato (LT2 / Tempo)',
      shoeId: 'adidas-boston11',
      shoeName: 'Adidas Adizero Boston 11',
      volume: '14.0 km',
      targetPace: paces.threshold,
      hrTarget: '164 - 176 bpm',
      desc: `3 km calentamiento + 3 x 2000m sostenidos a ritmo de ${paces.threshold} (recup. 2 min trote) + 2 km enfriamiento.`
    },
    {
      day: 'Viernes',
      type: 'Descanso Total / Movilidad y Fuerza',
      shoeId: null,
      shoeName: 'Sin calzado (Impacto 0)',
      volume: '0.0 km',
      targetPace: '--:--',
      hrTarget: '< 100 bpm',
      desc: 'Día de regeneración pasiva o sesión de core, puente de glúteos y excéntricos de sóleo/gemelos.'
    },
    {
      day: 'Sábado',
      type: 'Rodaje Progresivo Aeróbico',
      shoeId: 'asics-gt1000',
      shoeName: 'Asics GT-1000 10',
      volume: '9.0 km',
      targetPace: `${paces.easy} ➔ ${paces.marathon}`,
      hrTarget: '138 - 158 bpm',
      desc: '6 km en Zona 2 aeróbica terminando los últimos 3 km a Ritmo Maratón con sensación de fluidez.'
    },
    {
      day: 'Domingo',
      type: 'Tirada Larga Aeróbica (Long Run)',
      shoeId: 'olympikus-corre2',
      shoeName: 'Olympikus Corre 2',
      volume: '17.0 km',
      targetPace: paces.easy,
      hrTarget: '135 - 150 bpm',
      desc: 'Fondo dominical continuo para aumentar la densidad mitocondrial y la eficiencia en el uso de glucógeno. Hidratación regular cada 3 km.'
    }
  ];
}

// ============================================================================
// 4. PERSISTENCIA EN LOCALSTORAGE Y UTILIDADES
// ============================================================================

function initializeData() {
  const storedWorkouts = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
  AppState.workouts = storedWorkouts ? JSON.parse(storedWorkouts) : [];

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

  analyzeFatigueAndAdaptation();
}

function saveWorkouts() {
  localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(AppState.workouts));
}

function saveShoes() {
  localStorage.setItem(STORAGE_KEYS.SHOES, JSON.stringify(AppState.shoes));
}

function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 60) + parts[1] + (parts[2] / 60);
  if (parts.length === 2) return parts[0] + (parts[1] / 60);
  return Number(timeStr) || 0;
}

function timeStringToSeconds(timeStr) {
  return Math.round(timeStringToMinutes(timeStr) * 60);
}

function secondsToPaceString(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '--:--';
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
  return { paceSec: secPerKm, paceStr: secondsToPaceString(secPerKm) };
}

// ============================================================================
// 5. CONTROLADORES DE RENDERIZADO Y DOM
// ============================================================================

function switchTab(tabName) {
  AppState.activeTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const activeEl = document.getElementById(`tab-${tabName}`);
  if (activeEl) activeEl.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    const target = btn.dataset.tab;
    if (target === tabName) {
      btn.classList.add('text-emerald-300', 'border-b-2', 'border-emerald-400', 'bg-slate-800/80');
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('text-emerald-300', 'border-b-2', 'border-emerald-400', 'bg-slate-800/80');
      btn.classList.add('text-slate-400');
    }
  });

  if (tabName === 'dashboard') renderACWRChart();
  if (tabName === 'planner') renderMicrocycle();
  if (tabName === 'scientific') renderScientificZones();
  if (tabName === 'shoes') renderShoeRotation();
}

function renderDashboard() {
  analyzeFatigueAndAdaptation();
  const paces = getDanielsPaces(AppState.dynamicVdot, AppState.fatigueAdjustmentSec);

  // 1. Métricas de Objetivos
  const current5kPaceSec = ATHLETE_PROFILE.records.race5k.recentPaceSec; // 233s = 3:53
  const target5kPaceSec = ATHLETE_PROFILE.targets.target5k.paceSec;      // 215.8s = 3:36
  const diff5k = current5kPaceSec - target5kPaceSec;                     // ~17s a recortar

  const diff10k = 243 - ATHLETE_PROFILE.targets.target10k.paceSec;       // ~21s a recortar

  document.getElementById('dashCurrent5kPace').textContent = ATHLETE_PROFILE.records.race5k.recentPaceStr;
  document.getElementById('dashTarget5kPace').textContent = ATHLETE_PROFILE.targets.target5k.paceStr;
  document.getElementById('dash5kDelta').textContent = `-${Math.round(diff5k)} s/km para Sub-18`;

  document.getElementById('dashCurrent10kPace').textContent = '4:03 /km (PB 42:36)';
  document.getElementById('dashTarget10kPace').textContent = ATHLETE_PROFILE.targets.target10k.paceStr;
  document.getElementById('dash10kDelta').textContent = `-${Math.round(diff10k)} s/km para Sub-37`;

  // 2. Estado Fisiológico y VDOT Dinámico
  document.getElementById('dashDynamicVdot').textContent = AppState.dynamicVdot.toFixed(1);
  const fatigueBadge = document.getElementById('dashFatigueBadge');
  if (fatigueBadge) {
    if (AppState.fatigueStatus === 'fatigued') {
      fatigueBadge.className = 'px-2 py-0.5 rounded-full text-xs font-mono bg-rose-950/60 text-rose-300 border border-rose-800/60';
      fatigueBadge.textContent = 'Alerta de Fatiga (+8 s/km adaptativo)';
    } else if (AppState.fatigueStatus === 'supercompensated') {
      fatigueBadge.className = 'px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/60';
      fatigueBadge.textContent = 'Supercompensación Activa';
    } else {
      fatigueBadge.className = 'px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700';
      fatigueBadge.textContent = 'Equilibrio Fisiológico Normal';
    }
  }

  // 3. Totales y ACWR
  const totalKm = AppState.workouts.reduce((acc, w) => acc + (parseFloat(w.distance) || 0), 0);
  const totalRuns = AppState.workouts.length;
  const acwrData = calculateACWR(AppState.workouts);

  document.getElementById('kpiTotalKm').textContent = totalKm.toFixed(1);
  document.getElementById('kpiTotalRuns').textContent = totalRuns;
  document.getElementById('kpiAcwrVal').textContent = acwrData.acwr.toFixed(2);
  document.getElementById('kpiAcwrBadge').textContent = acwrData.badgeText;
  document.getElementById('kpiAcwrBadge').style.borderColor = acwrData.color;
  document.getElementById('kpiAcwrBadge').style.color = acwrData.color;
  document.getElementById('kpiAcuteLoad').textContent = `${acwrData.acuteLoad} AU`;
  document.getElementById('kpiChronicLoad').textContent = `${acwrData.chronicLoad} AU`;

  // 4. Tabla de Entrenamientos Recientes
  const tbody = document.getElementById('recentWorkoutsTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    const sorted = [...AppState.workouts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    if (sorted.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-500 font-mono text-xs">
            Sin sesiones registradas en esta sesión. Tus datos base (5K 19:26 / 1000m 3:30) están activos.
          </td>
        </tr>
      `;
      return;
    }

    sorted.forEach(w => {
      const pace = calculatePace(w.distance, w.duration);
      const shoe = AppState.shoes.find(s => s.id === w.shoeId);
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-800/80 hover:bg-slate-800/40 transition text-xs font-mono text-slate-300';
      tr.innerHTML = `
        <td class="py-2.5 px-3">${w.date}</td>
        <td class="py-2.5 px-3 text-emerald-300 font-bold">${w.distance} km</td>
        <td class="py-2.5 px-3">${w.duration}</td>
        <td class="py-2.5 px-3 text-sky-300 font-semibold">${pace.paceStr}</td>
        <td class="py-2.5 px-3">${w.avgHr ? w.avgHr + ' bpm' : '--'}</td>
        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">RPE ${w.rpe || '--'}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function renderACWRChart() {
  const canvas = document.getElementById('acwrChartCanvas');
  if (!canvas) return;

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
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

    const res = calculateACWR(AppState.workouts, d);
    acuteData.push(res.acuteLoad);
    chronicData.push(res.chronicLoad);
    ratioData.push(res.acwr);
    safeZoneUpper.push(1.3);
    safeZoneLower.push(0.8);
  }

  if (AppState.chartInstance) AppState.chartInstance.destroy();

  const ctx = canvas.getContext('2d');
  AppState.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ratio ACWR (Agudo / Crónico)',
          data: ratioData,
          borderColor: '#6ee7b7', // Verde salvia suave
          backgroundColor: 'rgba(110, 231, 183, 0.08)',
          borderWidth: 2,
          pointRadius: AppState.workouts.length > 0 ? 2.5 : 0,
          pointBackgroundColor: '#6ee7b7',
          tension: 0.3,
          yAxisID: 'yRatio'
        },
        {
          label: 'Límite Seguro (1.3)',
          data: safeZoneUpper,
          borderColor: '#fcd34d', // Ámbar suave
          borderDash: [3, 3],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false,
          yAxisID: 'yRatio'
        },
        {
          label: 'Límite Base (0.8)',
          data: safeZoneLower,
          borderColor: '#94a3b8', // Gris acero
          borderDash: [3, 3],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false,
          yAxisID: 'yRatio'
        },
        {
          label: 'Carga Aguda (7d)',
          data: acuteData,
          borderColor: '#38bdf8', // Azul suave
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
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
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#94a3b8', font: { family: 'monospace', size: 10 } }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#6ee7b7',
          bodyColor: '#cbd5e1',
          borderColor: '#475569',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: { color: '#64748b', font: { family: 'monospace', size: 9 } }
        },
        yRatio: {
          type: 'linear',
          position: 'left',
          min: 0,
          max: 2.0,
          grid: { color: 'rgba(51, 65, 85, 0.15)' },
          ticks: { color: '#6ee7b7', font: { family: 'monospace', size: 10 } },
          title: { display: true, text: 'Ratio ACWR', color: '#6ee7b7', font: { size: 10, family: 'monospace' } }
        },
        yLoad: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: '#38bdf8', font: { family: 'monospace', size: 10 } },
          title: { display: true, text: 'Carga AU', color: '#38bdf8', font: { size: 10, family: 'monospace' } }
        }
      }
    }
  });
}

function renderMicrocycle() {
  const container = document.getElementById('microcycleCardsContainer');
  if (!container) return;

  const plan = generateDynamicMicrocycle();
  container.innerHTML = '';

  plan.forEach(item => {
    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl bg-slate-850 border border-slate-800 hover:border-slate-700/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3';
    card.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-300 font-mono text-xs font-bold border border-slate-700">${item.day}</span>
        <div>
          <h4 class="text-sm font-bold font-mono text-slate-200">${item.type}</h4>
          <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">${item.desc}</p>
          <div class="flex items-center gap-2 mt-2 text-[11px] font-mono text-slate-400">
            <span>👟 ${item.shoeName}</span>
            <span>•</span>
            <span class="text-sky-300">FC Objetivo: ${item.hrTarget}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 text-right font-mono self-end md:self-center shrink-0">
        <div>
          <span class="text-[10px] text-slate-500 uppercase block">Volumen</span>
          <span class="text-sm font-bold text-slate-200">${item.volume}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-500 uppercase block">Ritmo Sugerido</span>
          <span class="text-sm font-bold text-emerald-300">${item.targetPace}</span>
        </div>
        ${item.volume !== '0.0 km' ? `
          <button onclick="prefillWorkoutFromPlan('${item.volume.replace(' km', '')}', '${item.shoeId}', '${item.type}')" class="px-3 py-1.5 bg-slate-800 border border-emerald-500/30 text-emerald-300 hover:bg-slate-700 text-xs rounded-lg transition" title="Registrar esta sesión">
            + Registrar
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function renderScientificZones() {
  // 1. Zonas Karvonen
  const zones = getKarvonenZones();
  const zonesContainer = document.getElementById('karvonenZonesList');
  if (zonesContainer) {
    zonesContainer.innerHTML = '';
    zones.forEach(z => {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-xl bg-slate-850 border border-slate-800 flex justify-between items-center';
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="w-2 h-7 rounded-full" style="background-color: ${z.color}"></span>
          <div>
            <div class="text-xs font-bold font-mono text-slate-200">${z.zone}: ${z.name}</div>
            <div class="text-[11px] text-slate-400">${z.desc}</div>
          </div>
        </div>
        <div class="text-right font-mono">
          <div class="text-sm font-bold text-emerald-300">${z.min} - ${z.max} <span class="text-[10px] text-slate-500">bpm</span></div>
          <div class="text-[10px] text-slate-500">${z.pct} HRR</div>
        </div>
      `;
      zonesContainer.appendChild(card);
    });
  }

  // 2. Ritmos VDOT Jack Daniels
  const paces = getDanielsPaces(AppState.dynamicVdot, AppState.fatigueAdjustmentSec);
  document.getElementById('paceEasyVal').textContent = `${paces.easy} /km`;
  document.getElementById('paceMarathonVal').textContent = `${paces.marathon} /km`;
  document.getElementById('paceThresholdVal').textContent = `${paces.threshold} /km`;
  document.getElementById('paceIntervalVal').textContent = `${paces.interval} /km`;
  document.getElementById('paceRepetitionVal').textContent = `${paces.repetition} /km`;
}

function renderShoeRotation() {
  const container = document.getElementById('shoesListContainer');
  const select = document.getElementById('workoutShoeSelect');
  if (!container) return;

  if (select) {
    select.innerHTML = '<option value="">-- Sin asignar calzado --</option>';
    AppState.shoes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.brand} ${s.model} (${s.currentKm.toFixed(1)} / ${s.maxKm} km)`;
      select.appendChild(opt);
    });
  }

  container.innerHTML = '';
  AppState.shoes.forEach(shoe => {
    const pct = Math.min(100, Math.round((shoe.currentKm / shoe.maxKm) * 100));
    let colorClass = 'bg-emerald-400';
    let textClass = 'text-emerald-300';
    if (pct > 80) {
      colorClass = 'bg-rose-400';
      textClass = 'text-rose-300';
    } else if (pct > 55) {
      colorClass = 'bg-amber-300';
      textClass = 'text-amber-300';
    }

    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3';
    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">${shoe.usage}</span>
          <h4 class="text-sm font-bold font-mono text-slate-200 mt-1">${shoe.brand} ${shoe.model}</h4>
        </div>
        <div class="text-right">
          <span class="text-base font-bold font-mono ${textClass}">${pct}%</span>
          <span class="text-[10px] text-slate-500 font-mono block">Desgaste</span>
        </div>
      </div>

      <div>
        <div class="flex justify-between text-xs font-mono mb-1">
          <span class="text-slate-400">Kilómetros acumulados:</span>
          <span class="text-slate-200 font-bold">${shoe.currentKm.toFixed(1)} / ${shoe.maxKm} km</span>
        </div>
        <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div class="${colorClass} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>

      <div class="text-[11px] font-mono text-slate-500 flex justify-between">
        <span>${Math.max(0, shoe.maxKm - shoe.currentKm).toFixed(1)} km de vida útil restantes</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function prefillWorkoutFromPlan(distStr, shoeId, typeStr) {
  switchTab('log');
  const distInput = document.getElementById('workoutDistance');
  const shoeSelect = document.getElementById('workoutShoeSelect');
  const notesInput = document.getElementById('workoutNotes');

  if (distInput) distInput.value = distStr;
  if (shoeSelect && shoeId) shoeSelect.value = shoeId;
  if (notesInput) notesInput.value = `Sesión de plan: ${typeStr}`;
  showToast(`📋 ${distStr} km precargados para ${typeStr}.`, 'info');
}

// ============================================================================
// 6. FORMULARIO DE REGISTRO DE ENTRENAMIENTOS
// ============================================================================

function setupWorkoutForm() {
  const form = document.getElementById('workoutLogForm');
  if (!form) return;

  const dateInput = document.getElementById('workoutDate');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const distance = parseFloat(document.getElementById('workoutDistance').value);
    const durationStr = document.getElementById('workoutDuration').value.trim();
    const avgHr = parseInt(document.getElementById('workoutAvgHr').value) || null;
    const maxHr = parseInt(document.getElementById('workoutMaxHr').value) || null;
    const rpe = parseInt(document.getElementById('workoutRpe').value) || 5;
    const shoeId = document.getElementById('workoutShoeSelect').value;
    const date = document.getElementById('workoutDate').value;
    const notes = document.getElementById('workoutNotes').value;

    if (isNaN(distance) || distance <= 0 || !durationStr) {
      showToast('⚠️ Ingresa una distancia y tiempo válidos.', 'error');
      return;
    }

    const newWorkout = {
      id: `run-${Date.now()}`,
      date: date || new Date().toISOString().split('T')[0],
      distance,
      duration: durationStr,
      avgHr,
      maxHr,
      rpe,
      shoeId,
      notes
    };

    AppState.workouts.unshift(newWorkout);
    saveWorkouts();

    // Actualizar kilometraje de la zapatilla
    if (shoeId) {
      const shoe = AppState.shoes.find(s => s.id === shoeId);
      if (shoe) {
        shoe.currentKm += distance;
        saveShoes();
      }
    }

    showToast(`✅ Sesión de ${distance} km registrada. Carga ACWR y calzado actualizados.`, 'success');
    form.reset();
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    analyzeFatigueAndAdaptation();
    switchTab('dashboard');
    renderAll();
  });
}

// ============================================================================
// 7. NOTIFICACIONES TOAST FLOTANTES
// ============================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-slate-800 border-emerald-500/50 text-emerald-300' :
             type === 'error' ? 'bg-slate-800 border-rose-500/50 text-rose-300' :
             'bg-slate-800 border-sky-500/50 text-sky-300';

  toast.className = `px-4 py-2.5 rounded-xl border shadow-lg flex items-center gap-2 text-xs font-mono transition-all duration-300 transform translate-y-2 opacity-0 ${bg}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ============================================================================
// 8. INICIALIZACIÓN GLOBAL
// ============================================================================

function renderAll() {
  renderDashboard();
  renderACWRChart();
  renderMicrocycle();
  renderScientificZones();
  renderShoeRotation();
}

document.addEventListener('DOMContentLoaded', () => {
  initializeData();

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  setupWorkoutForm();
  renderAll();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('RunPulse PWA lista para uso offline:', reg.scope))
      .catch(err => console.warn('SW no registrado:', err));
  }
});
