# 🐦‍⬛ Raven QA Report: Simulación Masiva RELEVO + TIZA

**Generated:** 2026-07-11T23:34:48.199Z

## Summary

| Metric | Count |
|--------|-------|
| Verifications | 16 (7 ✅, 9 ❌) |
| Critical Bugs | 2 🔴 |
| Major Bugs | 6 🟠 |
| Minor Bugs | 1 🟡 |
| Console Errors | 86 |
| Network Errors | 82 |

## Verifications

### A. RELEVO-WEB

- ❌ **A.1 Login HOLDER**: Redirected to http://localhost:3002/login?
- ❌ **A.2 Dashboard stats**: Escuelas: false, Profesores: false, Evaluaciones: false
- ❌ **A.3 Three colegios visible**: Andes: false, Sur: false, Central: false
- ❌ **A.4 Profesores en colegio**: Found 0 profesor references
- ✅ **API OpenAPI spec**: Status: 200
- ✅ **API Swagger UI**: Status: 200

### B. TIZA-WEB

- ❌ **B.5 Login Profesor**: Redirected to http://localhost:3001/login?
- ❌ **B.6 Dashboard Profesor stats**: Cursos: false, Alumnos: false, Evaluaciones: false
- ❌ **B.7 Cursos con alumnos**: Has curso names: false, Has "42": false
- ❌ **B.8 Evaluaciones creadas**: Lenguaje: false, Matemática: false
- ✅ **B.9 Revisar resultados**: Page loaded, has pending: true
- ❌ **B.10 Reportes rendimiento**: Has performance data: false

### Keyboard

- ✅ **Keyboard nav - Tab order**: First: INPUT#email, Second: INPUT#contraseña
- ✅ **Keyboard nav Relevo - Tab order**: First: INPUT#email

### Invalid Inputs

- ✅ **Invalid email validation**: Shows validation error for invalid email

### Security

- ✅ **XSS protection**: Script tags are escaped or rejected

### API

- ✅ **API OpenAPI spec**: Status: 200
- ✅ **API Swagger UI**: Status: 200

## Bugs Found

### 🔴 CRITICAL: A.1 Login HOLDER failed

- **Description:** Did not redirect to dashboard. Current URL: http://localhost:3002/login?
- **Time:** 2026-07-11T23:35:01.214Z

### 🔴 CRITICAL: B.5 Login Profesor failed

- **Description:** Did not redirect to dashboard. Current URL: http://localhost:3001/login?
- **Time:** 2026-07-11T23:35:53.498Z

### 🟠 MAJOR: A.2 Dashboard missing stats

- **Description:** Dashboard does not show expected statistics
- **Evidence:** `A2-relevo-dashboard.png`
- **Time:** 2026-07-11T23:35:04.417Z

### 🟠 MAJOR: A.3 Missing colegios

- **Description:** Not all 3 colegios are displayed
- **Evidence:** `A3-relevo-colegios.png`
- **Time:** 2026-07-11T23:35:07.081Z

### 🟠 MAJOR: A.4 Missing profesores

- **Description:** Expected 4 profesores per colegio, found 0 references
- **Evidence:** `A4-relevo-usuarios.png`
- **Time:** 2026-07-11T23:35:40.716Z

### 🟠 MAJOR: B.6 Dashboard missing stats

- **Description:** Profesor dashboard missing expected stats
- **Evidence:** `B6-tiza-dashboard.png`
- **Time:** 2026-07-11T23:35:56.960Z

### 🟠 MAJOR: B.7 Cursos not showing

- **Description:** Cursos page does not show expected cursos with 42 alumnos
- **Evidence:** `B7-tiza-cursos.png`
- **Time:** 2026-07-11T23:35:59.646Z

### 🟠 MAJOR: B.8 Missing evaluaciones

- **Description:** Evaluaciones page does not show both Lenguaje and Matemática
- **Evidence:** `B8-tiza-evaluaciones.png`
- **Time:** 2026-07-11T23:36:02.290Z

### 🟡 MINOR: B.10 Reportes empty

- **Description:** Reportes page does not show performance data
- **Evidence:** `B10-tiza-reportes.png`
- **Time:** 2026-07-11T23:36:07.584Z

## Console Errors (86)

- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [warning] The resource http://localhost:3002/_next/static/media/e4af272ccee01ff0-s.p.woff2 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)
- [error] Failed to load resource: the server responded with a status of 404 (Not Found)

## Network Errors (82)

- http://localhost:3002/_next/static/css/app/layout.css?v=1783812888333 - 404 Not Found
- http://localhost:3002/_next/static/chunks/app-pages-internals.js - 404 Not Found
- http://localhost:3002/_next/static/chunks/app/layout.js - 404 Not Found
- http://localhost:3002/_next/static/chunks/main-app.js?v=1783812888333 - 404 Not Found
- http://localhost:3002/_next/static/chunks/app/not-found.js - 404 Not Found
- http://localhost:3002/_next/static/css/app/layout.css?v=1783812889160 - 404 Not Found
- http://localhost:3002/_next/static/chunks/app-pages-internals.js - 404 Not Found
- http://localhost:3002/_next/static/chunks/main-app.js?v=1783812889160 - 404 Not Found
- http://localhost:3002/_next/static/chunks/app/layout.js - 404 Not Found
- http://localhost:3002/_next/static/chunks/app/not-found.js - 404 Not Found
- http://localhost:3002/_next/static/css/app/layout.css?v=1783812901795 - 404 Not Found
- http://localhost:3002/_next/static/chunks/main-app.js?v=1783812901795 - 404 Not Found
- http://localhost:3002/_next/static/chunks/app/layout.js - 404 Not Found
- http://localhost:3002/_next/static/chunks/app-pages-internals.js - 404 Not Found
- http://localhost:3002/_next/static/chunks/app/not-found.js - 404 Not Found
- http://localhost:3002/_next/static/css/app/layout.css?v=1783812904445 - 404 Not Found
- http://localhost:3002/_next/static/chunks/app/layout.js - 404 Not Found
- http://localhost:3002/_next/static/chunks/app-pages-internals.js - 404 Not Found
- http://localhost:3002/_next/static/chunks/main-app.js?v=1783812904445 - 404 Not Found
- http://localhost:3002/_next/static/chunks/app/not-found.js - 404 Not Found

## Screenshots (15)

- `A1-relevo-login-success.png`
- `A2-relevo-dashboard.png`
- `A3-relevo-colegios.png`
- `A4-relevo-usuarios.png`
- `B5-tiza-login-success.png`
- `B6-tiza-dashboard.png`
- `B7-tiza-cursos.png`
- `B8-tiza-evaluaciones.png`
- `B9-tiza-revisar.png`
- `B10-tiza-reportes.png`
- `responsive-tiza-mobile.png`
- `responsive-relevo-mobile.png`
- `responsive-tiza-tablet.png`
- `responsive-relevo-tablet.png`
- `invalid-input-test.png`

## Verdict

❌ **FAIL** - 2 critical, 6 major bugs block progression.

### Blocking Issues:
- [ ] CRITICAL: A.1 Login HOLDER failed
- [ ] CRITICAL: B.5 Login Profesor failed
- [ ] MAJOR: A.2 Dashboard missing stats
- [ ] MAJOR: A.3 Missing colegios
- [ ] MAJOR: A.4 Missing profesores
- [ ] MAJOR: B.6 Dashboard missing stats
- [ ] MAJOR: B.7 Cursos not showing
- [ ] MAJOR: B.8 Missing evaluaciones
