# ⚡ RunPulse Pro | Scientific Road Athletics PWA

Progressive Web App (PWA) de alto rendimiento centrada en el atletismo de ruta científico, diseñada para ser alojada de forma estática en **GitHub Pages**.

---

## 🚀 Despliegue en GitHub Pages (Paso a Paso)

1. **Crea un repositorio en GitHub**:
   - Ve a [github.com/new](https://github.com/new).
   - Nómbralo (por ejemplo: `runpulse-pro` o `atletismo-cientifico`).
   - Elige visibilidad **Pública**.

2. **Sube los 4 archivos principales**:
   - `index.html`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   *(Puedes subirlos arrastrándolos directamente en la interfaz web de GitHub en "Upload files" o vía Git CLI).*

3. **Activar GitHub Pages**:
   - En tu repositorio, entra a **Settings** > **Pages** (en el menú lateral izquierdo).
   - En **Source**, selecciona `Deploy from a branch`.
   - En **Branch**, selecciona `main` (o `master`) y carpeta `/ (root)`.
   - Haz clic en **Save**.
   - En 30-60 segundos, GitHub te proporcionará la URL pública HTTPS de tu app (ej: `https://tu-usuario.github.io/runpulse-pro/`).

4. **Instalación como App Nativa (PWA)**:
   - **En Android (Chrome/Brave)**: Toca los 3 puntos superiores y pulsa **"Instalar aplicación"** o **"Agregar a pantalla principal"**.
   - **En iPhone (Safari)**: Toca el botón de Compartir y selecciona **"Agregar al inicio"**.
   - Funcionará 100% offline sin necesidad de conexión a internet.

---

## 🔐 Perfiles y PINs por Defecto

| Perfil | Categoría | PIN de 4 Dígitos |
| :--- | :--- | :--- |
| **Entrenador / Élite** | Sub-38 10K / Sub-18 5K | `1111` |
| **Atleta Progresión** | Sub-60 10K (Anti-periostitis) | `2222` |
| **Atleta 3 (Fondo)** | Maratón Sub-3h30 | `3333` |
| **Atleta 4 (Salud)** | Iniciación & Base Aeróbica | `4444` |

*Por defecto la app arranca en modo **Solo Lectura**. Al hacer clic en "Ingresar PIN" o intentar registrar datos, se desbloquean los permisos completos de edición (CRUD).*
