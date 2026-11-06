/**
 * ============================================================================
 * RUNPULSE PRO - PLATAFORMA CIENTÍFICA DE ENTRENAMIENTO DE RUTA (SPA / PWA)
 * ATLETA EXCLUSIVO: DYKEMBEL VARGAS (24 AÑOS, 52 KG, 1.64M)
 * OBJETIVOS: 5K SUB-18:00 / 10K SUB-37:00
 * TEMA: CLARO Y TONOS SUAVES (VISUALMENTE RELAJANTE)
 * ============================================================================
 */

// ============================================================================
// 1. ESTADO INICIAL Y PERFIL BIOMÉTRICO (HARDCODED)
// ============================================================================

const ATHLETE_PROFILE = {
  name: 'Dykembel Vargas',
  age: 24,
  weightKg: 52,
  heightM: 1.64,
  frequencyDaysPerWeek: 6,
  hrRest: 46, // Frecuencia Cardíaca de Reposo (bpm)
  hrMax: 193, // Frecuencia Cardíaca Máxima comprobada en test/series (bpm)
  baseVdot: 51.8, // Jack Daniels VDOT calculado con 5K en 19:26 y 1000m en 3:30

  // Marcas Históricas y Recientes de Referencia
  records: {
    track1000m: { pb: '3:22', recent: '3:30', recentSec: 210 },
    race5k: { pb: '18:44', recent: '19:26', recentSec: 1166, recentPaceSec: 233.2, recentPaceStr: '3:53 /km' },
    race10k: { pb: '42:36', note: 'Split registrado durante carrera de 10.5K' },
    race21k: { pb: '1:54:00' }
  },

  // Objetivos de Rendimiento a 1 Año
  targets: {
    target5k: { time: '17:59', paceSec: 215.8, paceStr: '3:36 /km', vdotNeeded: 56.2 },
    target10k: { time: '36:59', paceSec: 221.9, paceStr: '3:42 /km', vdotNeeded: 55.8 }
  }
};

// Rotación Inicial de Calzado
const DEFAULT_SHOES = [
  {
    id: 'asics-gt1000',
    brand: 'Asics',
    model: 'GT-1000 10',
    use: 'Soporte leve / Rodajes aeróbicos diarios Z2',
    foamType: 'FlyteFoam + Gel en talón (DuoMax)',
    maxKm: 800,
    currentKm: 142.5,
    tagColor: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  },
  {
    id: 'adidas-boston11',
    brand: 'Adidas',
    model: 'Adizero Boston 11',
    use: 'Mixtas / Series de pista 1000m / Ritmo Umbral LT2',
    foamType: 'Lightstrike Pro + Lightstrike + Varillas EnergyRods',
    maxKm: 600,
    currentKm: 88.0,
    tagColor: 'bg-sky-50 text-sky-800 border-sky-200'
  },
  {
    id: 'olympikus-corre2',
    brand: 'Olympikus',
    model: 'Corre 2',
    use: 'Ligeras / Fondos largos dominicales / Regenerativos',
    foamType: 'Espuma Eleva (Drop 8mm)',
    maxKm: 600,
    currentKm: 195.0,
    tagColor: 'bg-amber-50 text-amber-800 border-amber-200'
  }
];

// Claves de Almacenamiento en LocalStorage
const STORAGE_KEYS = {
  WORKOUTS: 'runpulse_workouts_dykembel',
  SHOES: 'runpulse_shoes_dykembel',
  CUSTOM_PARAMS: 'runpulse_params_dykembel'
};

// Estado Reactivo de la Aplicación
const AppState = {
  activeTab: 'dashboard',
  workouts: [],
  shoes: [],
  dynamicVdot: ATHLETE_PROFILE.baseVdot,
  fatigueStatus: 'normal', // 'normal', 'fatigued', 'supercompensated'
  fatigueAdjustmentSec: 0,
  chartInstance: null
};

// ============================================================================
// 2. MOTOR CIENTÍFICO Y FISIOLÓGICO (CORE JS)
// ============================================================================

/**
 * A. FÓRMULA DE FRECUENCIA CARDÍACA DE KARVONEN
 * FC_Objetivo = FC_Reposo + (%_Intensidad * (FC_Máx - FC_Reposo))
 * Para Dykembel: FC_Reserva = 193 - 46 = 147 bpm
 */
function getKarvonenZones() {
  const hrRest = ATHLETE_PROFILE.hrRest;
  const hrMax = ATHLETE_PROFILE.hrMax;
  const hrr = hrMax - hrRest; // 147 bpm

  return [
    {
      zone: 'Z1',
      name: 'Regenerativo / Recuperación Activa',
      pct: '50% - 60%',
      min: Math.round(hrRest + 0.50 * hrr), // 120 bpm
      max: Math.round(hrRest + 0.60 * hrr), // 134 bpm
      bgClass: 'bg-slate-50 border-slate-200 text-slate-700',
      pillClass: 'bg-slate-100 text-slate-700 border-slate-300',
      desc: 'Días post-calidad, activa el aclaramiento de metabolitos sin fatiga muscular.'
    },
    {
      zone: 'Z2',
      name: 'Base Aeróbica / Lipólisis Eficiente',
      pct: '60% - 70%',
      min: Math.round(hrRest + 0.60 * hrr) + 1, // 135 bpm
      max: Math.round(hrRest + 0.70 * hrr),     // 149 bpm
      bgClass: 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
      pillClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      desc: '80% de tus kilómetros semanales. Desarrolla capilarización y densidad mitocondrial.'
    },
    {
      zone: 'Z3',
      name: 'Tempo / Aeróbico Medio',
      pct: '70% - 80%',
      min: Math.round(hrRest + 0.70 * hrr) + 1, // 150 bpm
      max: Math.round(hrRest + 0.80 * hrr),     // 164 bpm
      bgClass: 'bg-sky-50/70 border-sky-200 text-sky-900',
      pillClass: 'bg-sky-100 text-sky-800 border-sky-300',
      desc: 'Rodajes progresivos controlados. Transición hacia el metabolismo mixto glucolítico.'
    },
    {
      zone: 'Z4',
      name: 'Umbral de Lactato (LT2 / Anaeróbico)',
      pct: '80% - 90%',
      min: Math.round(hrRest + 0.80 * hrr) + 1, // 165 bpm
      max: Math.round(hrRest + 0.90 * hrr),     // 178 bpm
      bgClass: 'bg-amber-50/70 border-amber-200 text-amber-900',
      pillClass: 'bg-amber-100 text-amber-800 border-amber-300',
      desc: 'Series de 2000m o bloques de 20 min. Eleva el punto de inflexión de acumulación de lactato.'
    },
    {
      zone: 'Z5',
      name: 'Potencia Aeróbica (VO2máx / VAM)',
      pct: '90% - 100%',
      min: Math.round(hrRest + 0.90 * hrr) + 1, // 179 bpm
      max: hrMax,                               // 193 bpm
      bgClass: 'bg-rose-50/70 border-rose-200 text-rose-900',
      pillClass: 'bg-rose-100 text-rose-800 border-rose-300',
      desc: 'Series de 1000m en pista a ritmo de 3:28 - 3:32 /km para expandir tu techo aeróbico.'
    }
  ];
}

/**
 * B. MODELO VDOT AERÓBICO DE JACK DANIELS
 * Calcula ritmos de entrenamiento precisos según el nivel aeróbico del atleta.
 */
function getVelocityFromVO2(vo2Target) {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(vo2Target + 4.60);
  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0) return 150;
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

function paceFromVelocity(vMetersPerMin, extraOffsetSec = 0) {
  if (!vMetersPerMin || vMetersPerMin <= 0) return '4:45';
  let totalSecPerKm = (1000 / vMetersPerMin) * 60 + extraOffsetSec;
  if (isNaN(totalSecPerKm) || totalSecPerKm <= 0) totalSecPerKm = 285;
  const mins = Math.floor(totalSecPerKm / 60);
  const secs = Math.round(totalSecPerKm % 60);
  const paddedSecs = secs < 10 ? `0${secs}` : (secs === 60 ? '00' : secs);
  const adjustedMins = secs === 60 ? mins + 1 : mins;
  return `${adjustedMins}:${paddedSecs}`;
}

function getDanielsPaces(vdot, fatigueOffsetSec = 0) {
  const v = parseFloat(vdot) || ATHLETE_PROFILE.baseVdot;
  return {
    easy: paceFromVelocity(getVelocityFromVO2(v * 0.70), fatigueOffsetSec),       // ~4:45 - 5:05
    marathon: paceFromVelocity(getVelocityFromVO2(v * 0.80), fatigueOffsetSec),   // ~4:12 - 4:20
    threshold: paceFromVelocity(getVelocityFromVO2(v * 0.88), fatigueOffsetSec),  // ~3:52 - 3:56
    interval: paceFromVelocity(getVelocityFromVO2(v * 0.975), fatigueOffsetSec),  // ~3:28 - 3:32
    repetition: paceFromVelocity(getVelocityFromVO2(v * 1.07), fatigueOffsetSec)  // ~3:15 - 3:20
  };
}

/**
 * C. RATIO DE CARGA AGUDA : CRÓNICA (ACWR - GABBETT MODEL)
 * Cuantificación del balance carga-fatiga para prevenir sobreentrenamiento:
 *   Carga de Sesión (AU) = Duración (minutos) * RPE (Borg 1-10)
 *   Carga Aguda = Promedio de carga de los últimos 7 días.
 *   Carga Crónica = Promedio de carga de los últimos 28 días.
 *   ACWR = Carga Aguda / Carga Crónica
 */
function calculateACWR(workouts, targetDate = new Date()) {
  if (!workouts || workouts.length === 0) {
    return { acuteLoad: 0, chronicLoad: 0, acwr: 0.0, status: 'nodata', badgeText: 'Sweet Spot (0.8 - 1.3)', color: '#059669' };
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
    return { acuteLoad: 0, chronicLoad: 0, acwr: 1.0, status: 'optimal', badgeText: 'Zona Óptima (1.00)', color: '#059669' };
  }

  const acwr = chronicLoad > 0 ? Number((acuteLoad / chronicLoad).toFixed(2)) : (acuteLoad > 0 ? 1.35 : 1.0);

  let status = 'optimal';
  let badgeText = 'Zona Óptima (0.8 - 1.3)';
  let color = '#059669'; // Verde esmeralda suave

  if (acwr < 0.8) {
    status = 'undertraining';
    badgeText = 'Sub-entrenamiento (< 0.8)';
    color = '#64748b'; // Gris pizarra suave
  } else if (acwr > 1.5) {
    status = 'danger';
    badgeText = 'Alerta de Fatiga (> 1.5)';
    color = '#e11d48'; // Rosa/rojo suave
  } else if (acwr > 1.3) {
    status = 'warning';
    badgeText = 'Precaución (1.3 - 1.5)';
    color = '#d97706'; // Ámbar suave
  }

  return { acuteLoad: Math.round(acuteLoad), chronicLoad: Math.round(chronicLoad), acwr, status, badgeText, color };
}

// ============================================================================
// 3. MOTOR DINÁMICO DE MICROCICLO Y ADAPTACIÓN AL ESFUERZO
// ============================================================================

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
    const rpe = parseInt(w.rpe, 10) || 5;

    // Si reportó RPE >= 8 en un rodaje suave (ritmo > 4:40 /km)
    if (rpe >= 8 && pace.paceSec > 280) {
      highFatigueCount++;
    }
    // Si corrió a ritmos de calidad (ritmo < 3:45 /km) con RPE cómodo (<= 6)
    if (rpe <= 6 && pace.paceSec < 225 && pace.paceSec > 0) {
      superCompCount++;
    }
  });

  if (highFatigueCount >= 2) {
    // Alerta de Fatiga: Ralentizar ritmos sugeridos +8 s/km para proteger músculos y tendones
    AppState.fatigueStatus = 'fatigued';
    AppState.fatigueAdjustmentSec = 8;
    AppState.dynamicVdot = Math.max(49.0, Number((ATHLETE_PROFILE.baseVdot - 0.8).toFixed(1)));
  } else if (superCompCount >= 1) {
    // Rendimiento superior: Atleta asimilando cargas positivamente
    AppState.fatigueStatus = 'supercompensated';
    AppState.fatigueAdjustmentSec = -3;
    AppState.dynamicVdot = Math.min(56.5, Number((ATHLETE_PROFILE.baseVdot + 0.6).toFixed(1)));
  } else {
    AppState.fatigueStatus = 'normal';
    AppState.fatigueAdjustmentSec = 0;
    AppState.dynamicVdot = ATHLETE_PROFILE.baseVdot;
  }
}

/**
 * Genera el microciclo semanal de 6 días adaptado a las marcas de Dykembel:
 * 1 Fondo largo dominical, 2 Calidades (Series 1000m pista & Umbral LT2), 3 Rodajes aeróbicos Z2, 1 Descanso.
 */
function generateDynamicMicrocycle() {
  const paces = getDanielsPaces(AppState.dynamicVdot, AppState.fatigueAdjustmentSec);
  const isFatigued = AppState.fatigueStatus === 'fatigued';

  return [
    {
      day: 'Lunes',
      tag: 'Base Aeróbica',
      type: 'Rodaje Aeróbico Z2 + 5 Rectas Técnicas',
      shoeId: 'asics-gt1000',
      shoeName: 'Asics GT-1000 10',
      volume: '10.0 km',
      targetPace: paces.easy,
      hrTarget: '135 - 149 bpm',
      pillClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      desc: isFatigued
        ? 'Rodaje regenerativo suave a ritmo muy cómodo + 15 min de movilidad articular y estiramientos suaves.'
        : 'Rodaje continuo en Z2 estricto finalizando con 5 rectas técnicas de 100m en césped (cadencia 180+ spm).'
    },
    {
      day: 'Martes',
      tag: 'Calidad 1 (VAM)',
      type: 'Series de 1000m en Pista (VO2máx)',
      shoeId: 'adidas-boston11',
      shoeName: 'Adidas Adizero Boston 11',
      volume: '13.5 km',
      targetPace: paces.interval,
      hrTarget: '179 - 193 bpm',
      pillClass: 'bg-rose-50 text-rose-800 border border-rose-200',
      badgeClass: 'bg-rose-100 text-rose-800',
      desc: isFatigued
        ? 'Ajuste de fatiga activo: 4 x 1000m a ritmo controlado con 2 min de recuperación caminando/trotando.'
        : `3 km calentamiento + 5 × 1000m a ritmo de ${paces.interval} (PB reciente 3:30) con recup. 90s trote Z1 + 2.5 km vuelta a la calma.`
    },
    {
      day: 'Miércoles',
      tag: 'Asimilación',
      type: 'Rodaje de Asimilación Z1-Z2',
      shoeId: 'asics-gt1000',
      shoeName: 'Asics GT-1000 10',
      volume: '8.0 km',
      targetPace: paces.easy,
      hrTarget: '120 - 142 bpm',
      pillClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      desc: 'Rodaje conversacional regenerativo para facilitar el aclaramiento de lactato y la recuperación neuromuscular.'
    },
    {
      day: 'Jueves',
      tag: 'Calidad 2 (LT2)',
      type: 'Ritmo Umbral de Lactato (Tempo)',
      shoeId: 'adidas-boston11',
      shoeName: 'Adidas Adizero Boston 11',
      volume: '14.0 km',
      targetPace: paces.threshold,
      hrTarget: '165 - 178 bpm',
      pillClass: 'bg-amber-50 text-amber-800 border border-amber-200',
      badgeClass: 'bg-amber-100 text-amber-800',
      desc: `3 km calentamiento + 3 × 2000m sostenidos a ritmo de ${paces.threshold} (recup. 2 min trote activo) + 2 km soltar piernas.`
    },
    {
      day: 'Viernes',
      tag: 'Descanso Activo',
      type: 'Descanso Total / Movilidad & Core',
      shoeId: null,
      shoeName: 'Sin calzado (Impacto 0)',
      volume: '0.0 km',
      targetPace: '--:--',
      hrTarget: '< 100 bpm',
      pillClass: 'bg-slate-100 text-slate-700 border border-slate-200',
      badgeClass: 'bg-slate-200 text-slate-800',
      desc: 'Día de regeneración pasiva o sesión de core, puente de glúteos y ejercicios excéntricos de sóleo/gemelos.'
    },
    {
      day: 'Sábado',
      tag: 'Progresivo',
      type: 'Rodaje Progresivo Aeróbico',
      shoeId: 'asics-gt1000',
      shoeName: 'Asics GT-1000 10',
      volume: '9.0 km',
      targetPace: `${paces.easy} ➔ ${paces.marathon}`,
      hrTarget: '138 - 158 bpm',
      pillClass: 'bg-sky-50 text-sky-800 border border-sky-200',
      badgeClass: 'bg-sky-100 text-sky-800',
      desc: `6 km en Zona 2 aeróbica (${paces.easy}) terminando los últimos 3 km a Ritmo Maratón (${paces.marathon}) con fluidez mecánica.`
    },
    {
      day: 'Domingo',
      tag: 'Fondo Largo',
      type: 'Tirada Larga Aeróbica (Long Run)',
      shoeId: 'olympikus-corre2',
      shoeName: 'Olympikus Corre 2',
      volume: '17.0 km',
      targetPace: paces.easy,
      hrTarget: '135 - 150 bpm',
      pillClass: 'bg-sky-50 text-sky-800 border border-sky-200',
      badgeClass: 'bg-sky-100 text-sky-800',
      desc: 'Fondo dominical continuo para aumentar la densidad mitocondrial y la eficiencia en el uso de glucógeno. Hidratación constante cada 3 km.'
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
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return 0;
}

function secondsToPaceString(totalSec) {
  if (!totalSec || isNaN(totalSec) || totalSec <= 0) return '--:--';
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
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
// 5. CONTROLADORES DE RENDERIZADO Y DOM (ESTILO CLARO)
// ============================================================================

function switchTab(tabName) {
  AppState.activeTab = tabName;

  // Ocultar todas las pestañas
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  
  // Mostrar la pestaña activa
  const activeEl = document.getElementById(`tab-${tabName}`);
  if (activeEl) activeEl.classList.remove('hidden');

  // Actualizar botones de navegación en Desktop
  document.querySelectorAll('header .nav-btn').forEach(btn => {
    const target = btn.dataset.tab;
    if (target === tabName) {
      btn.className = 'nav-btn px-4 py-2 rounded-lg font-medium transition text-emerald-700 bg-emerald-50 border border-emerald-200/80 shadow-2xs';
    } else {
      btn.className = 'nav-btn px-4 py-2 rounded-lg font-medium transition text-slate-600 hover:text-slate-900 hover:bg-slate-100';
    }
  });

  // Actualizar botones de navegación en Móvil
  document.querySelectorAll('nav.md\\:hidden .nav-btn').forEach(btn => {
    const target = btn.dataset.tab;
    const labelSpan = btn.querySelector('span:last-child');
    if (target === tabName) {
      btn.className = 'nav-btn flex flex-col items-center justify-center py-1 text-emerald-700';
      if (labelSpan) labelSpan.className = 'text-[9px] font-mono mt-0.5 font-bold';
    } else {
      btn.className = 'nav-btn flex flex-col items-center justify-center py-1 text-slate-400 hover:text-slate-700';
      if (labelSpan) labelSpan.className = 'text-[9px] font-mono mt-0.5 font-normal';
    }
  });

  // Re-renderizar dinámicamente según la pestaña seleccionada
  try {
    if (tabName === 'dashboard') {
      renderDashboard();
      renderACWRChart();
    } else if (tabName === 'planner') {
      renderMicrocycle();
    } else if (tabName === 'scientific') {
      renderScientificZones();
    } else if (tabName === 'shoes') {
      renderShoeRotation();
    }
  } catch (err) {
    console.error(`Error al renderizar la pestaña ${tabName}:`, err);
  }
}

function renderDashboard() {
  analyzeFatigueAndAdaptation();
  const paces = getDanielsPaces(AppState.dynamicVdot, AppState.fatigueAdjustmentSec);

  // 1. Métricas de Objetivos
  const current5kPaceSec = ATHLETE_PROFILE.records.race5k.recentPaceSec; // 233s = 3:53
  const target5kPaceSec = ATHLETE_PROFILE.targets.target5k.paceSec;      // 215.8s = 3:36
  const diff5k = current5kPaceSec - target5kPaceSec;                     // ~17s a recortar
  const diff10k = 243 - ATHLETE_PROFILE.targets.target10k.paceSec;       // ~21s a recortar

  const elem5kCurrent = document.getElementById('dashCurrent5kPace');
  if (elem5kCurrent) elem5kCurrent.textContent = ATHLETE_PROFILE.records.race5k.recentPaceStr;

  const elem5kTarget = document.getElementById('dashTarget5kPace');
  if (elem5kTarget) elem5kTarget.textContent = ATHLETE_PROFILE.targets.target5k.paceStr;

  const elem5kDelta = document.getElementById('dash5kDelta');
  if (elem5kDelta) elem5kDelta.textContent = `-${Math.round(diff5k)} s/km para Sub-18`;

  const elem10kCurrent = document.getElementById('dashCurrent10kPace');
  if (elem10kCurrent) elem10kCurrent.textContent = '4:03 /km (PB 42:36)';

  const elem10kTarget = document.getElementById('dashTarget10kPace');
  if (elem10kTarget) elem10kTarget.textContent = ATHLETE_PROFILE.targets.target10k.paceStr;

  const elem10kDelta = document.getElementById('dash10kDelta');
  if (elem10kDelta) elem10kDelta.textContent = `-${Math.round(diff10k)} s/km para Sub-37`;

  // 2. Estado Fisiológico y VDOT
  const headerVdot = document.getElementById('headerVdot');
  if (headerVdot) headerVdot.textContent = AppState.dynamicVdot.toFixed(1);

  const plannerVdot = document.getElementById('plannerCurrentVdot');
  if (plannerVdot) plannerVdot.textContent = AppState.dynamicVdot.toFixed(1);

  const fatigueBadge = document.getElementById('dashFatigueBadge');
  if (fatigueBadge) {
    if (AppState.fatigueStatus === 'fatigued') {
      fatigueBadge.className = 'px-3 py-1 rounded-full text-xs font-mono bg-rose-50 text-rose-700 border border-rose-200 font-medium';
      fatigueBadge.textContent = '⚠️ Alerta de Fatiga (+8 s/km adaptativo)';
    } else if (AppState.fatigueStatus === 'supercompensated') {
      fatigueBadge.className = 'px-3 py-1 rounded-full text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium';
      fatigueBadge.textContent = '⚡ Supercompensación Activa';
    } else {
      fatigueBadge.className = 'px-3 py-1 rounded-full text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200 font-medium';
      fatigueBadge.textContent = '✓ Equilibrio Fisiológico Normal';
    }
  }

  // 3. Totales y ACWR
  const totalKm = AppState.workouts.reduce((acc, w) => acc + (parseFloat(w.distance) || 0), 0);
  const totalRuns = AppState.workouts.length;
  const acwrData = calculateACWR(AppState.workouts);

  const kpiTotalKm = document.getElementById('kpiTotalKm');
  if (kpiTotalKm) kpiTotalKm.textContent = totalKm.toFixed(1);

  const kpiAcwrVal = document.getElementById('kpiAcwrVal');
  if (kpiAcwrVal) kpiAcwrVal.textContent = acwrData.acwr.toFixed(2);

  const kpiAcwrBadge = document.getElementById('kpiAcwrBadge');
  if (kpiAcwrBadge) {
    kpiAcwrBadge.textContent = acwrData.badgeText;
    kpiAcwrBadge.style.color = acwrData.color;
  }

  const kpiAcuteLoad = document.getElementById('kpiAcuteLoad');
  if (kpiAcuteLoad) kpiAcuteLoad.textContent = `${acwrData.acuteLoad} AU`;

  const kpiChronicLoad = document.getElementById('kpiChronicLoad');
  if (kpiChronicLoad) kpiChronicLoad.textContent = `${acwrData.chronicLoad} AU`;

  // 4. Tabla de Entrenamientos Recientes
  const tbody = document.getElementById('recentWorkoutsTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    const sorted = [...AppState.workouts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    if (sorted.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-400 font-mono text-xs">
            Sin sesiones registradas todavía. Tus marcas base (5K en 19:26 y 1000m en 3:30) están activas.
          </td>
        </tr>
      `;
    } else {
      sorted.forEach(w => {
        const pace = calculatePace(w.distance, w.duration);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 hover:bg-slate-50/80 transition text-xs font-mono text-slate-700';
        tr.innerHTML = `
          <td class="py-2.5 px-3">${w.date}</td>
          <td class="py-2.5 px-3 text-emerald-700 font-bold">${w.distance} km</td>
          <td class="py-2.5 px-3">${w.duration}</td>
          <td class="py-2.5 px-3 text-sky-700 font-semibold">${pace.paceStr}</td>
          <td class="py-2.5 px-3">${w.avgHr ? w.avgHr + ' bpm' : '--'}</td>
          <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-medium">RPE ${w.rpe || '--'}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}

function renderACWRChart() {
  const canvas = document.getElementById('acwrChartCanvas');
  if (!canvas) return;

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js no está disponible en este momento.');
    return;
  }

  const labels = [];
  const acuteData = [];
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
    ratioData.push(res.acwr);
    safeZoneUpper.push(1.3);
    safeZoneLower.push(0.8);
  }

  if (AppState.chartInstance) {
    try {
      AppState.chartInstance.destroy();
    } catch (e) {
      console.warn('Error al destruir gráfico anterior:', e);
    }
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
          borderColor: '#059669', // Verde esmeralda elegante
          backgroundColor: 'rgba(5, 150, 105, 0.08)',
          borderWidth: 2,
          pointRadius: AppState.workouts.length > 0 ? 2.5 : 0,
          pointBackgroundColor: '#059669',
          tension: 0.3,
          yAxisID: 'yRatio'
        },
        {
          label: 'Límite Seguro (1.3)',
          data: safeZoneUpper,
          borderColor: '#d97706', // Ámbar suave
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'yRatio'
        },
        {
          label: 'Límite Base (0.8)',
          data: safeZoneLower,
          borderColor: '#94a3b8', // Gris suave
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'yRatio'
        },
        {
          label: 'Carga Aguda 7d (AU)',
          data: acuteData,
          borderColor: '#0284c7', // Azul suave
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
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
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#0f172a',
          bodyColor: '#334155',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(241, 245, 249, 0.8)' },
          ticks: { color: '#64748b', font: { family: 'monospace', size: 10 } }
        },
        yRatio: {
          type: 'linear',
          position: 'left',
          min: 0,
          max: 2.2,
          grid: { color: 'rgba(241, 245, 249, 0.8)' },
          ticks: { color: '#059669', font: { family: 'monospace', size: 10 } },
          title: { display: true, text: 'Ratio ACWR', color: '#059669', font: { size: 10, family: 'monospace' } }
        },
        yLoad: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: '#0284c7', font: { family: 'monospace', size: 10 } },
          title: { display: true, text: 'Carga AU', color: '#0284c7', font: { size: 10, family: 'monospace' } }
        }
      }
    }
  });
}

/**
 * RENDERIZADOR DEL MICROCICLO DE 6 DÍAS (ENFOQUE CLARO Y SUAVE)
 */
function renderMicrocycle() {
  const container = document.getElementById('microcycleCardsContainer');
  if (!container) return;

  const plan = generateDynamicMicrocycle();
  container.innerHTML = '';

  plan.forEach(item => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:border-slate-300 transition space-y-3';
    
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div class="flex items-center gap-2.5">
          <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${item.pillClass}">
            ${item.day}
          </span>
          <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${item.badgeClass}">
            ${item.tag}
          </span>
          <h3 class="text-sm font-bold text-slate-800 tracking-tight font-mono">
            ${item.type}
          </h3>
        </div>
        <div class="flex items-center gap-3 font-mono text-xs text-slate-600">
          <span>📏 <strong class="text-slate-800">${item.volume}</strong></span>
          <span>⚡ <strong class="text-emerald-700">${item.targetPace}</strong></span>
        </div>
      </div>

      <p class="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
        ${item.desc}
      </p>

      <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-mono">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
            👟 ${item.shoeName}
          </span>
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/80 text-sky-800 text-[11px]">
            ❤️ FC Objetivo: ${item.hrTarget}
          </span>
        </div>

        ${item.volume !== '0.0 km' ? `
          <button onclick="prefillWorkoutFromPlan('${item.volume.replace(' km', '')}', '${item.shoeId}', '${item.type}')" 
            class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 font-medium rounded-xl text-xs transition shadow-2xs">
            + Registrar Sesión
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
      card.className = `p-3.5 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-2 ${z.bgClass}`;
      card.innerHTML = `
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold ${z.pillClass}">${z.zone}</span>
            <h4 class="text-xs font-bold font-mono text-slate-800">${z.name}</h4>
          </div>
          <p class="text-[11px] text-slate-500 mt-1 leading-snug">${z.desc}</p>
        </div>
        <div class="text-left sm:text-right font-mono shrink-0">
          <span class="text-sm font-bold text-slate-800 block">${z.min} - ${z.max} bpm</span>
          <span class="text-[10px] text-slate-500">${z.pct} de FC Reserva</span>
        </div>
      `;
      zonesContainer.appendChild(card);
    });
  }

  // 2. Ritmos Daniels
  const paces = getDanielsPaces(AppState.dynamicVdot, AppState.fatigueAdjustmentSec);
  const easyElem = document.getElementById('paceEasyVal');
  if (easyElem) easyElem.textContent = `${paces.easy} /km`;

  const marathonElem = document.getElementById('paceMarathonVal');
  if (marathonElem) marathonElem.textContent = `${paces.marathon} /km`;

  const thresholdElem = document.getElementById('paceThresholdVal');
  if (thresholdElem) thresholdElem.textContent = `${paces.threshold} /km`;

  const intervalElem = document.getElementById('paceIntervalVal');
  if (intervalElem) intervalElem.textContent = `${paces.interval} /km`;

  const repElem = document.getElementById('paceRepetitionVal');
  if (repElem) repElem.textContent = `${paces.repetition} /km`;
}

function renderShoeRotation() {
  const container = document.getElementById('shoesListContainer');
  if (!container) return;

  container.innerHTML = '';

  // Actualizar también el select del formulario de registro
  const selectElem = document.getElementById('workoutShoeSelect');
  if (selectElem) {
    selectElem.innerHTML = '';
    AppState.shoes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.brand} ${s.model} (${s.currentKm.toFixed(1)} / ${s.maxKm} km)`;
      selectElem.appendChild(opt);
    });
  }

  AppState.shoes.forEach(shoe => {
    const pct = Math.min(100, (shoe.currentKm / shoe.maxKm) * 100);
    const colorClass = pct > 85 ? 'bg-rose-500' : (pct > 60 ? 'bg-amber-500' : 'bg-emerald-600');
    const remainingKm = Math.max(0, shoe.maxKm - shoe.currentKm).toFixed(1);

    const card = document.createElement('div');
    card.className = 'bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div>
          <span class="text-[10px] uppercase font-mono text-slate-500 font-semibold">${shoe.brand}</span>
          <h3 class="text-sm font-bold text-slate-800 font-mono">${shoe.model}</h3>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${shoe.tagColor}">
          ${pct.toFixed(0)}% uso
        </span>
      </div>

      <div class="space-y-1 text-xs">
        <p class="text-slate-600"><strong class="text-slate-700">Uso:</strong> ${shoe.use}</p>
        <p class="text-slate-500 text-[11px]"><strong class="text-slate-600">Espuma:</strong> ${shoe.foamType}</p>
      </div>

      <div class="space-y-1.5 pt-1">
        <div class="flex justify-between text-xs font-mono text-slate-600">
          <span>${shoe.currentKm.toFixed(1)} km</span>
          <span class="font-bold text-slate-800">${shoe.maxKm} km max</span>
        </div>
        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div class="${colorClass} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>

      <div class="text-[11px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-100">
        <span>Restante: <strong class="text-slate-700">${remainingKm} km</strong></span>
        <span class="text-emerald-700 font-medium">${pct < 85 ? '✓ Amortiguación Óptima' : '⚠️ Próximo a retiro'}</span>
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
  showToast(`📋 ${distStr} km y calzado precargados para ${typeStr}.`, 'info');
}

// ============================================================================
// 6. FORMULARIO DE REGISTRO DE ENTRENAMIENTOS
// ============================================================================

function setupWorkoutForm() {
  const form = document.getElementById('workoutLogForm');
  if (!form) return;

  const dateInput = document.getElementById('workoutDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('workoutDate').value;
    const distance = parseFloat(document.getElementById('workoutDistance').value);
    const duration = document.getElementById('workoutDuration').value.trim();
    const avgHr = parseInt(document.getElementById('workoutAvgHr').value, 10) || null;
    const maxHr = parseInt(document.getElementById('workoutMaxHr').value, 10) || null;
    const shoeId = document.getElementById('workoutShoeSelect').value;
    const rpe = parseInt(document.getElementById('workoutRpe').value, 10) || 5;
    const notes = document.getElementById('workoutNotes').value.trim();

    if (!distance || distance <= 0 || !duration) {
      showToast('Por favor introduce una distancia y un tiempo válidos.', 'error');
      return;
    }

    const newWorkout = {
      id: 'w_' + Date.now(),
      date,
      distance,
      duration,
      avgHr,
      maxHr,
      shoeId,
      rpe,
      notes,
      timestamp: Date.now()
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

    showToast(`✓ Sesión de ${distance} km guardada. ACWR y zapatillas actualizados.`, 'success');
    form.reset();
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    analyzeFatigueAndAdaptation();
    renderAll();
    switchTab('dashboard');
  });
}

// ============================================================================
// 7. NOTIFICACIONES TOAST FLOTANTES
// ============================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-white border-emerald-300 text-emerald-800 shadow-md' :
             type === 'error' ? 'bg-white border-rose-300 text-rose-800 shadow-md' :
             'bg-white border-slate-300 text-slate-800 shadow-md';

  toast.className = `px-4 py-3 rounded-xl border text-xs font-mono transition-all transform duration-300 translate-y-2 opacity-0 flex items-center gap-2 pointer-events-auto ${bg}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================================
// 8. INICIALIZACIÓN GLOBAL
// ============================================================================

function renderAll() {
  try { renderDashboard(); } catch (e) { console.error('Error renderDashboard:', e); }
  try { renderACWRChart(); } catch (e) { console.error('Error renderACWRChart:', e); }
  try { renderMicrocycle(); } catch (e) { console.error('Error renderMicrocycle:', e); }
  try { renderScientificZones(); } catch (e) { console.error('Error renderScientificZones:', e); }
  try { renderShoeRotation(); } catch (e) { console.error('Error renderShoeRotation:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeData();

  // Configurar listeners de pestañas
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  setupWorkoutForm();
  renderAll();

  // Registrar Service Worker para PWA Offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('RunPulse PWA lista para uso offline:', reg.scope))
      .catch(err => console.warn('SW no registrado:', err));
  }
});
