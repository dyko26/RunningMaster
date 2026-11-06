# ⚡ RunPulse Pro | Scientific Road Athletics PWA

Progressive Web App (PWA) de alto rendimiento centrada en el atletismo de ruta científico, diseñada para ser alojada de forma estática en **GitHub Pages**.

---

## 🆕 Novedades de la Versión Corregida

1. **Onboarding Obligatorio y PIN Personalizado**:
   - Al abrir la aplicación por primera vez, se solicita a cada usuario crear su propio perfil de atleta (Nombre, Objetivo fisiológico, Peso, FC Reposo, FC Máx, tiempo 10K reciente) y **definir su propio PIN de seguridad de 4 dígitos**.
   - Se pueden crear múltiples perfiles de atletas con el botón `+ Perfil` en la cabecera. Cada perfil mantiene su propio PIN independiente para autorizar la edición (CRUD).
2. **Pizarra en Blanco (Inicio Estricto desde Cero)**:
   - Se han eliminado todos los datos ficticios y semillas.
   - Las métricas inician en **0.0 km**, **0 entrenamientos**, **0 AU de carga** y ratio ACWR en estado neutro hasta que el usuario registre su actividad.
3. **Escáner y Soporte de Pantallazos de Reloj**:
   - Soporte para subir o arrastrar capturas de pantalla de cualquier smartwatch (**Garmin, Polar, Huawei, Apple Watch, Coros, Samsung Health**).
   - Compresión automática en el navegador mediante HTML5 Canvas para no saturar `localStorage`.
   - Botón `📸 Ver Reloj` en la tabla de historial para consultar la captura original del reloj junto a las métricas validadas.

---

## 🚀 Despliegue en GitHub Pages (Paso a Paso)

1. **Crear Repositorio en GitHub**:
   - Ve a [github.com/new](https://github.com/new).
   - Nómbralo (ej: `runpulse-pro`).
   - Selecciónalo como **Público**.

2. **Subir los 4 Archivos**:
   - `index.html`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   *(Arrastra los archivos desde esta carpeta directamente en la interfaz web de GitHub en "Upload files").*

3. **Activar GitHub Pages**:
   - En tu repositorio, ve a **Settings** > **Pages**.
   - En **Source**, selecciona `Deploy from a branch`.
   - En **Branch**, selecciona `main` (o `master`) y carpeta `/ (root)`.
   - Haz clic en **Save**.
   - En 30-60 segundos, GitHub te entregará el enlace HTTPS listo para abrir e instalar en tu móvil como PWA offline.
