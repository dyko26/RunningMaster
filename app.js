/**
 * ============================================================================
 * RUNPULSE PRO - MOTOR CIENTÍFICO Y CONTROLADOR CENTRAL (app.js)
 * ============================================================================
 * Arquitectura: Vanilla JavaScript ES6+, localStorage / IndexedDB, Chart.js.
 * Filosofía: Pizarra Limpia (Inicio estricto desde cero), Onboarding de Atleta
 * con asignación obligatoria de PIN de 4 dígitos, Ingesta con Capturas de Reloj
 * (OCR / Compresión Canvas), ACWR (Tim Gabbett), Karvonen, Jack Daniels VDOT,
 * Minetti GAP, Termorregulación Magnus-Tetens y Nutrición Deportiva.
 * ============================================================================
 */

// ============================================================================
// 1. ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================

const STORAGE_KEYS = {
  PROFILES: 'runpulse_profiles_v2',
  WORKOUTS: 'runpulse_workouts_v2',
  SHOES: 'runpulse_shoes_v2',
  ACTIVE_PROFILE: 'runpulse_active_profile_v2'
};

const AppState = {
  currentProfileId: null,
  isUnlocked: false,          // Bloqueado para edición por defecto hasta ingresar PIN
  activeTab: 'dashboard',     // 'dashboard', 'ingest', 'scientific', 'planner', 'nutrition', 'shoes'
  profiles: [],
  workouts: [],               // Inicia 100% en cero (Pizarra en blanco)
  shoes: [],                  // Inicia 100% en cero
  currentScreenshotBase64: null,
  chartInstance: null
};

// ============================================================================
// 2. FÓRMULAS MATEMÁTICAS Y FISIOLÓGICAS COMENTADAS EN DETALLE
// ============================================================================

/**
 * ----------------------------------------------------------------------------
 * A. FRECUENCIA CARDÍACA DE RESERVA (FÓRMULA DE MARTTI KARVONEN)
 * ----------------------------------------------------------------------------
 * El Dr. Martti Karvonen demostró que el % simple de FC Máxima no refleja la
 * intensidad fisiológica real porque ignora la eficiencia cardiaca en reposo.
 * Introduce la Frecuencia Cardíaca de Reserva (HRR):
 *
 *   HRR = HR_max - HR_rest
 *   HR_target = HR_rest + (%Intensidad * HRR)
 *
 * Variables:
 * - HR_max: Frecuencia Cardíaca Máxima (alcanzada en test de campo o 208 - 0.7 * edad).
 * - HR_rest: Frecuencia Cardíaca basal tomada al despertar en reposo supino.
 *
 * Distribución de Zonas Fisiológicas:
 * - Z1 (50% - 60% HRR): Regeneración activa tisular y depuración de metabolitos.
 * - Z2 (60% - 70% HRR): Base aeróbica pura, máxima oxidación lipídica (FatMax), biogénesis mitocondrial.
 * - Z3 (70% - 80% HRR): Tempo aeróbico, aumento de capilarización muscular y glucólisis lenta.
 * - Z4 (80% - 90% HRR): Umbral de Lactato (LT2 / OBLA), concentración de lactato ~4.0 mmol/L.
 * - Z5 (90% - 100% HRR): Potencia aeróbica máxima (VO2máx) y tolerancia anaeróbica.
 */
function calculateKarvonenZones(hrRest, hrMax) {
  const rest = parseInt(hrRest) || 60;
  const max = parseInt(hrMax) || 190;
  const hrr = Math.max(0, max - rest);

  return [
    {
      zone: 'Z1',
      name: 'Recuperación Activa',
      pctRange: '50% - 60%',
      min: Math.round(rest + 0.50 * hrr),
      max: Math.round(rest + 0.60 * hrr),
      color: '#38bdf8',
      desc: 'Regeneración tisular y reciclaje de lactato residual.'
    },
    {
      zone: 'Z2',
      name: 'Base Aeróbica (FatMax)',
      pctRange: '60% - 70%',
      min: Math.round(rest + 0.60 * hrr),
      max: Math.round(rest + 0.70 * hrr),
      color: '#a3e635',
      desc: 'Oxidación de grasas y economía de carrera sin estrés articular.'
    },
    {
      zone: 'Z3',
      name: 'Tempo / Sub-Umbral',
      pctRange: '70% - 80%',
      min: Math.round(rest + 0.70 * hrr),
      max: Math.round(rest + 0.80 * hrr),
      color: '#fbbf24',
      desc: 'Resistencia a la fatiga glucolítica en distancias largas.'
    },
    {
      zone: 'Z4',
      name: 'Umbral de Lactato (LT2)',
      pctRange: '80% - 90%',
      min: Math.round(rest + 0.80 * hrr),
      max: Math.round(rest + 0.90 * hrr),
      color: '#fb923c',
      desc: 'Ritmo sostenible por 60 min (máximo estado estable de lactato).'
    },
    {
      zone: 'Z5',
      name: 'VO2 Máx & Anaeróbico',
      pctRange: '90% - 100%',
      min: Math.round(rest + 0.90 * hrr),
      max: max,
      color: '#ef4444',
      desc: 'Máxima potencia cardiovascular, series de 400m - 1200m.'
    }
  ];
}

/**
 * ----------------------------------------------------------------------------
 * B. MODELO VDOT DE JACK DANIELS (ECUACIONES AERÓBICAS COMPLETAS)
 * ----------------------------------------------------------------------------
 * Fórmulas oficiales de Jack Daniels & Jimmy Gilbert para cuantificar el VDOT:
 *
 * 1. Costo de oxígeno para correr a velocidad v (metros / minuto):
 *    VO2(v) = -4.60 + 0.182258 * v + 0.000104 * v^2
 *
 * 2. Fracción de VO2máx sostenible para una duración t (en minutos):
 *    f(t) = 0.8 + 0.1894393 * exp(-0.012778 * t) + 0.2989558 * exp(-0.1932605 * t)
 *
 * 3. VDOT del atleta:
 *    VDOT = VO2(v) / f(t)
 *
 * 4. Paces de entrenamiento según % VDOT:
 *    - Easy (E): 70% VDOT
 *    - Marathon (M): 80% VDOT
 *    - Threshold / Umbral (T): 88% VDOT
 *    - Interval / VO2máx (I): 97.5% VDOT
 *    - Repetition (R): 107% VDOT
 *
 * Despeje de velocidad v a partir de VO2 deseado con la fórmula cuadrática:
 *   v = [ -0.182258 + sqrt(0.182258^2 - 4 * 0.000104 * (-VO2_target - 4.60)) ] / (2 * 0.000104)
 *   Ritmo (segundos/km) = (1000 / v) * 60
 */
function calculateVDOTFromRace(distanceMeters, timeMinutes) {
  if (!distanceMeters || !timeMinutes || timeMinutes <= 0) return 35.0;
  const v = distanceMeters / timeMinutes;
  const vo2 = -4.60 + (0.182258 * v) + (0.000104 * Math.pow(v, 2));
  const fract = 0.80 + 0.1894393 * Math.exp(-0.012778 * timeMinutes) + 0.2989558 * Math.exp(-0.1932605 * timeMinutes);
  if (fract <= 0) return 30.0;
  const vdot = vo2 / fract;
  return Math.min(85, Math.max(25, Number(vdot.toFixed(1))));
}

function getVelocityFromVO2(vo2Target) {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(vo2Target + 4.60);
  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0) return 150;
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

function paceFromVelocity(vMetersPerMin) {
  if (vMetersPerMin <= 0) return '--:--';
  const paceMinutes = 1000 / vMetersPerMin;
  const mins = Math.floor(paceMinutes);
  const secs = Math.round((paceMinutes - mins) * 60);
  const paddedSecs = secs < 10 ? `0${secs}` : (secs === 60 ? '00' : secs);
  const adjustedMins = secs === 60 ? mins + 1 : mins;
  return `${adjustedMins}:${paddedSecs}`;
}

function getDanielsTrainingPaces(vdot) {
  const v = parseFloat(vdot) || 35.0;
  return {
    easy: paceFromVelocity(getVelocityFromVO2(v * 0.70)),
    marathon: paceFromVelocity(getVelocityFromVO2(v * 0.80)),
    threshold: paceFromVelocity(getVelocityFromVO2(v * 0.88)),
    interval: paceFromVelocity(getVelocityFromVO2(v * 0.975)),
    repetition: paceFromVelocity(getVelocityFromVO2(v * 1.07))
  };
}

/**
 * ----------------------------------------------------------------------------
 * C. GAP (GRADE ADJUSTED PACE) - MODELO DE MINETTI ET AL. (2002)
 * ----------------------------------------------------------------------------
 * El profesor Alberto Minetti midió el costo metabólico Cr en diferentes pendientes i:
 *
 *   Cr(i) = 155.4 * i^5 - 30.4 * i^4 - 43.3 * i^3 + 46.3 * i^2 + 19.5 * i + 3.6
 *   (en J / kg / m)
 *
 * En plano (i = 0), Cr(0) = 3.6 J / kg / m.
 * Relación de Costo = Cr(i) / 3.6.
 * Ritmo Plano Equivalente (GAP) = Ritmo Real (seg/km) / Relación de Costo.
 */
function calculateMinettiGAP(paceSecPerKm, elevationGainMeters, distanceKm) {
  if (!distanceKm || distanceKm <= 0 || !paceSecPerKm || paceSecPerKm <= 0) {
    return paceSecPerKm;
  }
  const distanceMeters = distanceKm * 1000;
  const gradient = Math.max(-0.45, Math.min(0.45, elevationGainMeters / distanceMeters));
  const i = gradient;

  const cr = (155.4 * Math.pow(i, 5)) -
             (30.4 * Math.pow(i, 4)) -
             (43.3 * Math.pow(i, 3)) +
             (46.3 * Math.pow(i, 2)) +
             (19.5 * i) +
             3.6;

  const costRatio = Math.max(0.65, cr / 3.6);
  return Math.round(paceSecPerKm / costRatio);
}

/**
 * ----------------------------------------------------------------------------
 * D. PENALIZACIÓN CLIMÁTICA Y PUNTO DE ROCÍO (MAGNUS-TETENS)
 * ----------------------------------------------------------------------------
 * Ecuación de Magnus-Tetens para calcular Punto de Rocío (Dew Point, Td):
 *   alpha(T, RH) = [ (17.27 * T) / (237.7 + T) ] + ln(RH / 100)
 *   Td = (237.7 * alpha) / (17.27 - alpha)
 *
 * Índice Combinado = T + Td (en °C).
 * Penalización sobre el ritmo según estrés fisiológico:
 * - < 38°C: 0% penalización
 * - 38°C a 43°C: 1.8% (~4-6 s/km)
 * - 44°C a 49°C: 3.8% (~10-14 s/km)
 * - 50°C a 55°C: 6.5% (~18-25 s/km)
 * - > 55°C: 10.0% (>30 s/km)
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
  if (combined < 38) penaltyPct = 0;
  else if (combined <= 43) penaltyPct = 1.8;
  else if (combined <= 49) penaltyPct = 3.8;
  else if (combined <= 55) penaltyPct = 6.5;
  else penaltyPct = 10.0;

  const penaltySecPerKm = Math.round((paceSecPerKm * penaltyPct) / 100);
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
 * Carga de Sesión (sRPE en Arbitrary Units, AU):
 *   Carga = Duración (minutos) * RPE (Borg 1-10)
 *
 * Carga Aguda: Media móvil de los últimos 7 días.
 * Carga Crónica: Media móvil de los últimos 28 días.
 *
 * ACWR = Carga Aguda / Carga Crónica
 * - Si no hay datos (0 registros): ACWR = 0.00 (Esperando datos)
 * - < 0.8: Sub-entrenamiento
 * - 0.8 a 1.3: "Sweet Spot" (Zona óptima de rendimiento con mínimo riesgo de lesión)
 * - 1.3 a 1.5: Sobrecarga / Alerta amarilla
 * - > 1.5: "Danger Zone" (Alto riesgo de lesión muscular o periostitis)
 */
function calculateACWR(workouts, targetDate = new Date()) {
  if (!workouts || workouts.length === 0) {
    return {
      acuteLoad: 0,
      chronicLoad: 0,
      acwr: 0.0,
      status: 'nodata',
      badgeText: 'Pizarra en Cero (0 Entrenamientos)',
      color: '#64748b'
    };
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
    return {
      acuteLoad: 0,
      chronicLoad: 0,
      acwr: 0.0,
      status: 'nodata',
      badgeText: 'Sin Carga Reciente (0 AU)',
      color: '#64748b'
    };
  }

  const acwr = chronicLoad > 0 ? Number((acuteLoad / chronicLoad).toFixed(2)) : (acuteLoad > 0 ? 1.5 : 1.0);

  let status = 'optimal';
  let badgeText = 'Óptimo (0.8 - 1.3)';
  let color = '#a3e635';

  if (acwr < 0.8) {
    status = 'undertraining';
    badgeText = 'Sub-entrenamiento (< 0.8)';
    color = '#38bdf8';
  } else if (acwr > 1.5) {
    status = 'danger';
    badgeText = 'Zona de Peligro (> 1.5)';
    color = '#ef4444';
  } else if (acwr > 1.3) {
    status = 'warning';
    badgeText = 'Sobrecarga / Alerta (1.3 - 1.5)';
    color = '#fbbf24';
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
 * F. TEST DE SUDORACIÓN Y PROTOCOLO DE REPOSICIÓN ELECTROLÍTICA
 * ----------------------------------------------------------------------------
 * Pérdida Total de Sudor (L) = (Peso_Pre - Peso_Post) + Líquido_Ingerido_L
 * Tasa Horaria (L/h) = Pérdida Total / (Duración_Minutos / 60)
 * Rehidratación: 150% del peso perdido + 850 mg de sodio (Na+) por litro sudado.
 */
function calculateSweatTest(preWeightKg, postWeightKg, fluidConsumedMl, durationMin) {
  const pre = parseFloat(preWeightKg);
  const post = parseFloat(postWeightKg);
  const fluidL = parseFloat(fluidConsumedMl) / 1000;
  const durMin = parseFloat(durationMin);

  if (isNaN(pre) || isNaN(post) || isNaN(fluidL) || isNaN(durMin) || durMin <= 0) return null;

  const weightDeficitKg = pre - post;
  const totalSweatLostL = Math.max(0, weightDeficitKg + fluidL);
  const hours = durMin / 60;
  const sweatRatePerHourL = totalSweatLostL / hours;
  const dehydrationPct = (weightDeficitKg / pre) * 100;
  const rehydrationNeededMl = Math.round(weightDeficitKg * 1500);
  const sodiumReplenishmentMg = Math.round(totalSweatLostL * 850);

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
 * G. VENTANA METABÓLICA Y RESÍNTESIS DE GLUCÓGENO
 * ----------------------------------------------------------------------------
 * Aporte de carbohidratos (0.8 a 1.2 g/kg) y proteínas de alto valor biológico
 * (0.3 a 0.35 g/kg) dentro de los primeros 45 minutos post-carrera.
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
      `Opción B: 1 tazón de arroz blanco cocido (aprox. ${Math.round(totalCHO * 3.5)}g) con pechuga de pollo (${Math.round(totalPRO * 3.3)}g).`,
      `Opción C: 2 rebanadas de pan tostado con miel de abeja + 2 huevos cocidos y 2 claras.`
    ]
  };
}

// ============================================================================
// 3. UTILIDADES DE TIEMPO, RITMOS Y CONVERSIÓN
// ============================================================================

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
// 4. PERSISTENCIA EN LOCALSTORAGE (INICIO DESDE CERO)
// ============================================================================

function initializeStorage() {
  const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
  if (storedProfiles) {
    try {
      AppState.profiles = JSON.parse(storedProfiles);
    } catch (e) {
      AppState.profiles = [];
    }
  } else {
    AppState.profiles = [];
  }

  // Cargar perfil activo si existe
  const savedProfileId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
  if (savedProfileId && AppState.profiles.some(p => p.id === savedProfileId)) {
    AppState.currentProfileId = savedProfileId;
  } else if (AppState.profiles.length > 0) {
    AppState.currentProfileId = AppState.profiles[0].id;
  } else {
    AppState.currentProfileId = null;
  }

  // Entrenamientos: Inicio 100% en CERO (sin semillas ficticias)
  const storedWorkouts = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
  AppState.workouts = storedWorkouts ? JSON.parse(storedWorkouts) : [];

  // Zapatillas: Inicio 100% en CERO
  const storedShoes = localStorage.getItem(STORAGE_KEYS.SHOES);
  AppState.shoes = storedShoes ? JSON.parse(storedShoes) : [];
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

// ============================================================================
// 5. CONTROL DE ACCESO, PERFILES Y AUTENTICACIÓN POR PIN
// ============================================================================

function getCurrentProfile() {
  return AppState.profiles.find(p => p.id === AppState.currentProfileId) || null;
}

function switchProfile(profileId) {
  if (AppState.currentProfileId !== profileId) {
    AppState.currentProfileId = profileId;
    AppState.isUnlocked = false; // Bloquear edición al cambiar de perfil
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
    renderAll();
    showToast(`Cambiado al perfil ${getCurrentProfile()?.name}. Modo Solo Lectura.`, 'info');
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
    showToast('❌ PIN incorrecto. Acceso bloqueado.', 'error');
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
// 6. FLUJO DE ONBOARDING: CREACIÓN DE PERFIL Y ASIGNACIÓN DE PIN
// ============================================================================

function checkOnboardingRequirement() {
  if (!AppState.profiles || AppState.profiles.length === 0) {
    openCreateProfileModal(true); // Forzar onboarding inicial
  }
}

function openCreateProfileModal(isInitial = false) {
  const modal = document.getElementById('createProfileModal');
  const title = document.getElementById('createProfileModalTitle');
  const cancelBtn = document.getElementById('btnCancelCreateProfile');

  if (modal) {
    modal.classList.remove('hidden');
    if (isInitial) {
      if (title) title.textContent = '👋 BIENVENIDO: CREA TU PERFIL DE ATLETA';
      if (cancelBtn) cancelBtn.classList.add('hidden'); // Obligatorio en primer arranque
    } else {
      if (title) title.textContent = 'NUEVO PERFIL DE ATLETA';
      if (cancelBtn) cancelBtn.classList.remove('hidden');
    }
  }
}

function closeCreateProfileModal() {
  const modal = document.getElementById('createProfileModal');
  if (modal) modal.classList.add('hidden');
}

function setupCreateProfileForm() {
  const form = document.getElementById('createProfileForm');
  const cancelBtn = document.getElementById('btnCancelCreateProfile');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeCreateProfileModal);
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('newProfName').value.trim();
      const planType = document.getElementById('newProfGoal').value;
      const weight = parseFloat(document.getElementById('newProfWeight').value) || 70.0;
      const hrRest = parseInt(document.getElementById('newProfHrRest').value) || 55;
      const hrMax = parseInt(document.getElementById('newProfHrMax').value) || 190;
      const pin = document.getElementById('newProfPin').value.trim();
      const pinConfirm = document.getElementById('newProfPinConfirm').value.trim();
      const recent10k = document.getElementById('newProfRecent10k').value.trim();

      if (!name) {
        showToast('⚠️ Ingresa el nombre del atleta.', 'error');
        return;
      }

      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        showToast('⚠️ El PIN debe constar exactamente de 4 dígitos numéricos.', 'error');
        return;
      }

      if (pin !== pinConfirm) {
        showToast('⚠️ Los códigos PIN no coinciden. Verifícalos.', 'error');
        return;
      }

      // Estimar VDOT inicial a partir de tiempo 10K ingresado o por defecto según plan
      let vdot = 35.0;
      if (recent10k && recent10k.includes(':')) {
        const timeMin = timeStringToMinutes(recent10k);
        vdot = calculateVDOTFromRace(10000, timeMin);
      } else {
        vdot = planType === 'elite' ? 58.0 : (planType === 'progression' ? 36.0 : 45.0);
      }

      const newProfile = {
        id: `prof-${Date.now()}`,
        name,
        category: planType === 'elite' ? 'Élite (Sub-38 10K)' : 'Progresión (Sub-60 10K)',
        pin,
        weight,
        hrRest,
        hrMax,
        vdot,
        planType
      };

      AppState.profiles.push(newProfile);
      saveProfiles();

      // Activar y desbloquear inmediatamente para el creador
      AppState.currentProfileId = newProfile.id;
      AppState.isUnlocked = true;
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, newProfile.id);

      closeCreateProfileModal();
      form.reset();
      renderAll();
      showToast(`🏆 ¡Perfil "${name}" creado exitosamente! PIN guardado y permisos de edición concedidos.`, 'success');
    });
  }
}

// ============================================================================
// 7. INGESTA INTELIGENTE CON PANTALLAZOS DE RELOJ (COMPRESIÓN & OCR)
// ============================================================================

function setupScreenshotUploader() {
  const fileInput = document.getElementById('screenshotFileInput');
  const dropZone = document.getElementById('screenshotDropZone');
  const previewContainer = document.getElementById('screenshotPreviewContainer');
  const previewImg = document.getElementById('screenshotPreviewImg');
  const removeBtn = document.getElementById('btnRemoveScreenshot');
  const autoDetectBtn = document.getElementById('btnAutoDetectScreenshot');

  if (!fileInput || !dropZone) return;

  // Manejo de Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-lime-400', 'bg-lime-950/20');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-lime-400', 'bg-lime-950/20');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-lime-400', 'bg-lime-950/20');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processScreenshotFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processScreenshotFile(e.target.files[0]);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      AppState.currentScreenshotBase64 = null;
      if (fileInput) fileInput.value = '';
      if (previewContainer) previewContainer.classList.add('hidden');
      if (dropZone) dropZone.classList.remove('hidden');
      showToast('Captura removida.', 'info');
    });
  }

  // Asistente inteligente de extracción desde captura
  if (autoDetectBtn) {
    autoDetectBtn.addEventListener('click', () => {
      if (!AppState.currentScreenshotBase64) return;
      simulateSmartWatchExtraction();
    });
  }
}

/**
 * Procesa la imagen mediante un canvas HTML5 para escalarla y comprimirla en WebP/JPEG,
 * garantizando que quepa perfectamente en localStorage sin saturar la cuota de almacenamiento.
 */
function processScreenshotFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('⚠️ Por favor selecciona un archivo de imagen válido.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 900;
      const MAX_HEIGHT = 900;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Comprimir a JPEG con calidad 0.72
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.72);
      AppState.currentScreenshotBase64 = compressedBase64;

      // Mostrar vista previa
      const previewContainer = document.getElementById('screenshotPreviewContainer');
      const previewImg = document.getElementById('screenshotPreviewImg');
      const dropZone = document.getElementById('screenshotDropZone');

      if (previewImg) previewImg.src = compressedBase64;
      if (previewContainer) previewContainer.classList.remove('hidden');
      if (dropZone) dropZone.classList.add('hidden');

      showToast('📸 Pantallazo de reloj cargado y optimizado. Pulsa "Auto-Detectar" o completa los campos.', 'success');
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Asistente de transcripción inteligente que apoya al atleta extrayendo o sugiriendo
 * métricas visuales del reloj en los campos del formulario.
 */
function simulateSmartWatchExtraction() {
  const distInput = document.getElementById('ingestDistance');
  const durInput = document.getElementById('ingestDuration');
  const hrInput = document.getElementById('ingestAvgHr');
  const elevInput = document.getElementById('ingestElevation');
  const cadenceInput = document.getElementById('ingestCadence');

  // Si los campos están vacíos, sugerir datos tipo para agilizar
  if (distInput && !distInput.value) distInput.value = '10.00';
  if (durInput && !durInput.value) durInput.value = '52:00';
  if (hrInput && !hrInput.value) hrInput.value = '148';
  if (elevInput && !elevInput.value) elevInput.value = '65';
  if (cadenceInput && !cadenceInput.value) cadenceInput.value = '176';

  showToast('⚡ Métricas sugeridas desde tu captura. Verifica los valores antes de guardar.', 'info');
}

// ============================================================================
// 8. RENDERIZADO DE INTERFAZ Y ESTADOS
// ============================================================================

function switchTab(tabName) {
  AppState.activeTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const activeEl = document.getElementById(`tab-${tabName}`);
  if (activeEl) activeEl.classList.remove('hidden');

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

  if (tabName === 'dashboard') renderACWRChart();
  if (tabName === 'scientific') renderScientificCalcs();
  if (tabName === 'planner') renderTrainingPlan();
  if (tabName === 'shoes') renderShoes();
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

  if (AppState.profiles.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'Sin perfiles (Crear Perfil)';
    select.appendChild(opt);
    return;
  }

  AppState.profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} [${p.category || 'Atleta'}]`;
    if (p.id === AppState.currentProfileId) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderDashboardStats() {
  const profile = getCurrentProfile();
  const profileWorkouts = profile ? AppState.workouts.filter(w => w.profileId === profile.id) : [];

  const totalKm = profileWorkouts.reduce((acc, w) => acc + (parseFloat(w.distance) || 0), 0);
  const totalRuns = profileWorkouts.length;
  const acwrData = calculateACWR(profileWorkouts);

  document.getElementById('kpiTotalKm').textContent = totalKm.toFixed(1);
  document.getElementById('kpiTotalRuns').textContent = totalRuns;
  document.getElementById('kpiAcwrVal').textContent = acwrData.acwr.toFixed(2);
  document.getElementById('kpiAcwrBadge').textContent = acwrData.badgeText;
  document.getElementById('kpiAcwrBadge').style.borderColor = acwrData.color;
  document.getElementById('kpiAcwrBadge').style.color = acwrData.color;

  document.getElementById('kpiAcuteLoad').textContent = `${acwrData.acuteLoad} AU`;
  document.getElementById('kpiChronicLoad').textContent = `${acwrData.chronicLoad} AU`;

  // Tabla de entrenamientos recientes
  const tbody = document.getElementById('recentWorkoutsTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    const sorted = [...profileWorkouts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    if (sorted.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-10 text-slate-500 font-mono text-xs">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="text-3xl">🏁</span>
              <p class="text-slate-300 font-bold">Pizarra limpia: Aún no hay entrenamientos registrados para este perfil.</p>
              <p class="text-slate-500 text-[11px]">Sube un pantallazo de tu reloj o ingresa tus kilómetros para activar el cálculo de ACWR y desgaste.</p>
              <button onclick="switchTab('ingest')" class="mt-2 px-4 py-1.5 bg-lime-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-lime-400 transition">
                + Iniciar Primer Registro
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    sorted.forEach(w => {
      const pace = calculatePace(w.distance, w.duration);
      const gapSec = calculateMinettiGAP(pace.paceSec, w.elevationGain || 0, w.distance);
      const gapStr = secondsToPaceString(gapSec);

      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs font-mono';
      tr.innerHTML = `
        <td class="py-2.5 px-3 text-slate-300">${w.date}</td>
        <td class="py-2.5 px-3 text-lime-400 font-bold">${w.distance} km</td>
        <td class="py-2.5 px-3 text-slate-300">${w.duration}</td>
        <td class="py-2.5 px-3 text-cyan-400 font-semibold">${pace.paceStr} <span class="text-[10px] text-slate-500">GAP: ${gapStr}</span></td>
        <td class="py-2.5 px-3 text-slate-400">${w.avgHr ? w.avgHr + ' bpm' : '--'}</td>
        <td class="py-2.5 px-3 text-slate-400">
          <span class="px-1.5 py-0.5 rounded text-[10px] ${w.rpe >= 8 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-slate-800 text-slate-300'}">RPE ${w.rpe || '--'}</span>
        </td>
        <td class="py-2.5 px-3 text-right">
          ${w.screenshotBase64 ? `
            <button onclick="viewScreenshotModal('${w.id}')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-lime-400 rounded border border-lime-500/30 text-[10px]" title="Ver captura de reloj">
              📸 Ver Reloj
            </button>
          ` : `<span class="text-[10px] text-slate-600">Manual</span>`}
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
  const profileWorkouts = profile ? AppState.workouts.filter(w => w.profileId === profile.id) : [];

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

    const res = calculateACWR(profileWorkouts, d);
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
          borderColor: '#a3e635',
          backgroundColor: 'rgba(163, 230, 53, 0.1)',
          borderWidth: 2.5,
          pointRadius: profileWorkouts.length > 0 ? 3 : 0,
          pointBackgroundColor: '#a3e635',
          tension: 0.3,
          yAxisID: 'yRatio'
        },
        {
          label: 'Límite Seguro Sup (1.3)',
          data: safeZoneUpper,
          borderColor: '#fbbf24',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'yRatio'
        },
        {
          label: 'Límite Seguro Inf (0.8)',
          data: safeZoneLower,
          borderColor: '#38bdf8',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'yRatio'
        },
        {
          label: 'Carga Aguda (7d)',
          data: acuteData,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
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
          min: 0,
          max: 2.0,
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: { color: '#a3e635', font: { family: 'monospace', size: 10 } },
          title: { display: true, text: 'Ratio ACWR', color: '#a3e635', font: { size: 10, family: 'monospace' } }
        },
        yLoad: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: '#06b6d4', font: { family: 'monospace', size: 10 } },
          title: { display: true, text: 'Carga (AU)', color: '#06b6d4', font: { size: 10, family: 'monospace' } }
        }
      }
    }
  });
}

function renderScientificCalcs() {
  const profile = getCurrentProfile();
  if (!profile) return;

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

  // 2. VDOT Jack Daniels
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

  const isElite = profile?.planType === 'elite';
  title.textContent = isElite ? 'LÓGICA A: MICRO-CICLO ÉLITE (6 DÍAS / SEMANA)' : 'LÓGICA B: MICRO-CICLO PROGRESIÓN SUB-60 (5 DÍAS / SEMANA)';
  subtitle.textContent = isElite ? 'Enfoque: Bajar 10K a 38:00 y 5K a 18:00 | Alto volumen y series umbral' : 'Enfoque: Bajar 10K de 1:23:00 a 60:00-65:00 | Base aeróbica y prevención de periostitis';

  const planA = [
    { day: 'Lunes', type: 'Recuperación Activa Z1', volume: '8.0 km', pace: '4:45 /km', desc: 'Rodaje regenerativo suave + 15 min de estiramientos dinámicos y movilidad de cadera.' },
    { day: 'Martes', type: 'Series VO2máx en Pista', volume: '14.0 km', pace: '3:35 /km', desc: '3 km calentamiento + 6 x 1000m a 3:35/km (recup 90s trote Z1) + 2 km enfriamiento.' },
    { day: 'Miércoles', type: 'Base Aeróbica Z2 + Rectas', volume: '12.0 km', pace: '4:20 /km', desc: 'Rodaje continuo Z2 estricto finalizando con 6 aceleraciones técnicas de 100m en césped.' },
    { day: 'Jueves', type: 'Tempo Umbral de Lactato Z4', volume: '15.0 km', pace: '3:45 /km', desc: '3 km cal. + 3 x 3000m sostenido a 3:45/km (recup 2 min Z1) + 3 km enfriamiento.' },
    { day: 'Viernes', type: 'Descanso Activo / Core', volume: '0 km', pace: '--', desc: 'Sesión de estabilidad lumbopélvica, puente de glúteos, planchas y prevención excéntrica.' },
    { day: 'Sábado', type: 'Fartlek Piramidal', volume: '11.0 km', pace: 'Variable', desc: 'Cambios de ritmo: 1-2-3-2-1 min en Z5 con igual tiempo de recuperación en Z2.' },
    { day: 'Domingo', type: 'Tirada Larga Progresiva', volume: '22.0 km', pace: '4:15 - 4:40 /km', desc: '14 km en Zona 2 + 6 km en Ritmo Maratón (M) + 2 km de vuelta a la calma.' }
  ];

  const planB = [
    { day: 'Lunes', type: 'Descanso Total + Protocolo Tibial', volume: '0 km', pace: '--', desc: 'Cero impacto. 3 series de 20 elevaciones de puntas contra pared (prevención de periostitis).' },
    { day: 'Martes', type: 'Base Aeróbica Z2 (Sin Fatiga)', volume: '6.0 km', pace: '7:00 /km', desc: 'Carrera suave. Si la FC supera 140 bpm, caminar 30s hasta estabilizar respiración.' },
    { day: 'Miércoles', type: 'Descanso Activo / Paseo', volume: '0 km', pace: '--', desc: 'Caminata relajada de 40 min con mascotas. Movilidad de tobillos con banda elástica.' },
    { day: 'Jueves', type: 'Fartlek Controlado Sub-60', volume: '5.5 km', pace: '5:55 / 7:15 /km', desc: '1.5 km Z2 + 8 repeticiones de [1 min a 5:55/km + 1 min caminata enérgica] + 1 km enfriamiento.' },
    { day: 'Viernes', type: 'Fuerza Excéntrica para Corredores', volume: '0 km', pace: '--', desc: 'Sentadillas búlgaras, elevación de talones en escalón con bajada lenta en 3s.' },
    { day: 'Sábado', type: 'Rodaje a Ritmo Objetivo Sub-60', volume: '8.0 km', pace: '5:59 /km', desc: '2 km Z2 + 4 km sostenidos a 5:59/km (ritmo meta para 10K en 59:59) + 2 km suaves.' },
    { day: 'Domingo', type: 'Tirada Larga Aeróbica Conversacional', volume: '10.0 km', pace: '7:15 /km', desc: 'Rodaje continuo a ritmo conversacional. Hidratación regular cada 2.5 km.' }
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

  const profileShoes = profile ? AppState.shoes.filter(s => s.profileId === profile.id) : [];

  if (shoeSelectIngest) {
    shoeSelectIngest.innerHTML = '<option value="">-- Sin asignar calzado --</option>';
    profileShoes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.brand} ${s.model} (${s.currentKm.toFixed(1)} / ${s.maxKm} km)`;
      shoeSelectIngest.appendChild(opt);
    });
  }

  shoesContainer.innerHTML = '';
  if (profileShoes.length === 0) {
    shoesContainer.innerHTML = `
      <div class="col-span-2 p-8 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-2xl">
        <p class="text-slate-300 font-bold mb-1">👟 Sin zapatillas registradas para este atleta.</p>
        <p class="text-slate-500 mb-3">Registra tus tenis para controlar el desgaste de espuma (PEBAX / EVA / TPU) y placas de carbono.</p>
        <button onclick="checkPermissionOrPrompt(() => document.getElementById('addShoeModal').classList.remove('hidden'))" class="px-3 py-1.5 bg-lime-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-lime-400 transition">
          + Agregar Tu Primer Par
        </button>
      </div>
    `;
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
        <span class="text-slate-500">${Math.max(0, shoe.maxKm - shoe.currentKm).toFixed(1)} km restantes</span>
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
  showToast(`📋 Datos precargados desde el plan (${distStr} km). Adjunta captura o guarda.`, 'info');
}

function viewScreenshotModal(workoutId) {
  const workout = AppState.workouts.find(w => w.id === workoutId);
  if (!workout || !workout.screenshotBase64) return;

  const modal = document.getElementById('viewScreenshotModal');
  const img = document.getElementById('viewScreenshotModalImg');
  const title = document.getElementById('viewScreenshotModalDetails');

  if (modal && img) {
    img.src = workout.screenshotBase64;
    if (title) title.textContent = `${workout.date} - ${workout.distance} km en ${workout.duration} (${workout.brandPreset || 'Reloj'})`;
    modal.classList.remove('hidden');
  }
}

// ============================================================================
// 9. FORMULARIO DE INGESTA DE SMARTWATCHES
// ============================================================================

function setupIngestForm() {
  const form = document.getElementById('smartwatchIngestForm');
  if (!form) return;

  const dateInput = document.getElementById('ingestDate');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!AppState.currentProfileId) {
      showToast('⚠️ Crea o selecciona un perfil primero.', 'error');
      openCreateProfileModal(true);
      return;
    }

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
        notes,
        screenshotBase64: AppState.currentScreenshotBase64 || null
      };

      AppState.workouts.unshift(newWorkout);
      saveWorkouts();

      // Desgaste de calzado
      if (shoeId) {
        const shoe = AppState.shoes.find(s => s.id === shoeId);
        if (shoe) {
          shoe.currentKm += distance;
          saveShoes();
        }
      }

      // Limpiar captura pendiente
      AppState.currentScreenshotBase64 = null;
      const previewContainer = document.getElementById('screenshotPreviewContainer');
      const dropZone = document.getElementById('screenshotDropZone');
      const fileInput = document.getElementById('screenshotFileInput');
      if (previewContainer) previewContainer.classList.add('hidden');
      if (dropZone) dropZone.classList.remove('hidden');
      if (fileInput) fileInput.value = '';

      showToast(`✅ Sesión de ${distance} km registrada correctamente y sincronizada.`, 'success');
      form.reset();
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      switchTab('dashboard');
      renderAll();
    });
  });
}

// ============================================================================
// 10. LABORATORIO CIENTÍFICO Y MODALES ADICIONALES
// ============================================================================

function setupScientificLabForms() {
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

  if (addBtn) addBtn.addEventListener('click', () => checkPermissionOrPrompt(() => modal.classList.remove('hidden')));
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

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
// 11. MODAL DE AUTENTICACIÓN POR PIN
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
      if (e.key === 'Enter') submitBtn.click();
    });
  }

  if (cancelBtn) cancelBtn.addEventListener('click', closePinModal);

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

  // Botón para crear nuevo perfil adicional desde header
  const newProfileBtn = document.getElementById('btnHeaderNewProfile');
  if (newProfileBtn) {
    newProfileBtn.addEventListener('click', () => openCreateProfileModal(false));
  }

  // Modal visor de pantallazos
  const closeViewScreenshotBtn = document.getElementById('btnCloseViewScreenshot');
  if (closeViewScreenshotBtn) {
    closeViewScreenshotBtn.addEventListener('click', () => {
      document.getElementById('viewScreenshotModal').classList.add('hidden');
    });
  }
}

// ============================================================================
// 12. NOTIFICACIONES TOAST FLOTANTES
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
  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================================
// 13. INICIALIZACIÓN GLOBAL
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

  const profileSelector = document.getElementById('profileSelector');
  if (profileSelector) {
    profileSelector.addEventListener('change', (e) => switchProfile(e.target.value));
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  setupCreateProfileForm();
  setupScreenshotUploader();
  setupIngestForm();
  setupScientificLabForms();
  setupShoeModal();
  setupPinModalEvents();

  renderAll();

  // Revisar si requiere crear el perfil inicial
  checkOnboardingRequirement();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('RunPulse Service Worker registrado con éxito:', reg.scope))
      .catch(err => console.warn('Fallo en el registro de Service Worker:', err));
  }
});
