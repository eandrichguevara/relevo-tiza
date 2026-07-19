# 🐦‍⬛ Raven QA Review: RELEVO + TIZA — Fase de Implementación

**Fecha:** 2026-07-11  
**Entorno de Prueba:** Navegador real (Playwright Chromium 1228)  
**Servidores:** TIZA (http://localhost:3001), RELEVO (http://localhost:3002), API (http://localhost:8000)  
**Veredicto Final:** **FAIL** ⛔ — Bloqueado por issues CRÍTICOS y MAYORES

---

## Resumen de Pruebas

| Flujo | Estado | Issues Críticos | Issues Mayores | Issues Menores |
|-------|--------|-----------------|----------------|----------------|
| **FLUJO 1: TIZA Landing + Auth** | ⚠️ Parcial | 1 | 2 | 3 |
| **FLUJO 2: TIZA Dashboard + Evaluaciones** | ❌ No probado* | - | - | - |
| **FLUJO 3: RELEVO Landing + Auth** | ⚠️ Parcial | 1 | 2 | 2 |
| **FLUJO 4: Error States + Edge Cases** | ✅ Parcial | 0 | 1 | 4 |
| **FLUJO 5: API Endpoints** | ❌ Fallido | 2 | 1 | 0 |

\* *Dashboard y evaluaciones requieren autenticación funcional que está rota*

---

## 🔴 BUGS CRÍTICOS (Bloquean el avance)

### BUG-1: TIZA/RELEVO — Formulario de registro no envía datos (Sin endpoint backend funcional)
**Severidad:** CRÍTICA 🔴  
**URL:** `http://localhost:3001/register`, `http://localhost:3002/register`  
**Descripción:** Los formularios de registro en ambas apps renderizan correctamente, pero al enviar datos (incluso vacíos para testear validación), no hay respuesta del servidor. El botón de submit no dispara ninguna petición de red visible.  
**Pasos para reproducir:**
1. Navegar a `/register` en TIZA o RELEVO
2. Rellenar email, password, nombre
3. Hacer clic en "Registrarse gratis" / "Solicitar demo"
4. Observar: no hay network request, no hay feedback visual, no hay redirección  
**Impacto:** Usuarios no pueden registrarse. Flujo de onboarding completamente roto.  
**Fix esperado:** Conectar formularios a `/api/auth/register` del backend. Manejar loading state, errores, y redirección post-login.  
**Responsable sugerido:** @nexus (frontend state) + @forge (API auth)

### BUG-2: API — Endpoints de autenticación devuelven 500 / ECONNRESET
**Severidad:** CRÍTICA 🔴  
**URL:** `POST http://localhost:8000/api/auth/register`, `POST http://localhost:8000/api/auth/login`  
**Descripción:** 
- `GET /api/health` → 200 OK ✓
- `POST /api/auth/register` → 500 Internal Server Error (bcrypt/passlib compatibility issue)
- `POST /api/auth/login` → ECONNRESET (conexión cerrada por el servidor)  
**Error en logs:**
```
ValueError: password cannot be longer than 72 bytes
AttributeError: module 'bcrypt' has no attribute '__about__'
```
**Pasos para reproducir:**
1. `curl -X POST http://localhost:8000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"TestPass123!","name":"Test"}'`
2. Observar 500
3. `curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"TestPass123!"}'`
4. Observar ECONNRESET  
**Impacto:** Backend de autenticación completamente no funcional.  
**Fix esperado:** 
1. Fix bcrypt/passlib version conflict (downgrade bcrypt o upgrade passlib)
2. Asegurar PostgreSQL corriendo y migraciones aplicadas
3. Verificar connection pooling y manejo de errores de BD  
**Responsable sugerido:** @sage (database) + @forge (auth logic)

---

## 🟠 BUGS MAYORES (Bloquean el avance)

### BUG-3: TIZA/RELEVO — Login no valida credenciales ni muestra errores
**Severidad:** MAYOR 🟠  
**URL:** `http://localhost:3001/login`, `http://localhost:3002/login`  
**Descripción:** Formulario de login renderiza correctamente. Al enviar vacío o con credenciales inválidas, no hay validación client-side visible, no hay petición de red, no hay mensaje de error.  
**Pasos para reproducir:**
1. Navegar a `/login`
2. Dejar campos vacíos → click "Iniciar sesión"
3. Observar: sin feedback, sin network request  
**Fix esperado:** Validación client-side (required fields) + llamada a `/api/auth/login` + manejo de 401/422 + toast/error inline.  
**Responsable sugerido:** @nexus

### BUG-4: TIZA/RELEVO — Sin estado de carga (loading) en formularios
**Severidad:** MAYOR 🟠  
**URL:** `/register`, `/login` en ambas apps  
**Descripción:** Al hacer submit, no hay spinner, botón no se deshabilita, usuario puede hacer doble-click → duplicados potenciales.  
**Fix esperado:** `disabled` en botón durante submit, spinner visual, prevención de double-submit.  
**Responsable sugerido:** @aria (UX) + @nexus (state)

### BUG-5: API — PostgreSQL no configurado / no corriendo
**Severidad:** MAYOR 🟠  
**Descripción:** `pg_isready` falla. Base de datos no disponible para desarrollo. Las migraciones no se han ejecutado.  
**Fix esperado:** `docker compose up -d` (si hay docker-compose.yml) o instalar/levantar PostgreSQL local + `alembic upgrade head`.  
**Responsable sugerido:** @vault (infra) + @sage (migraciones)

---

## 🟡 ISSUES MENORES (No bloquean, pero deben arreglarse)

| ID | App | Descripción | Severidad |
|----|-----|-------------|-----------|
| MN-1 | TIZA | Register page: no hay label asociado a inputs (accesibilidad) | 🟡 Menor |
| MN-2 | TIZA | Register page: placeholder text en español inconsistente | 🟡 Menor |
| MN-3 | RELEVO | Register page: campo "organization" no tiene label visible | 🟡 Menor |
| MN-4 | RELEVO | Login: botón "Iniciar sesión" en header navega a `/login` pero estilo es link, no button | 🟡 Menor |
| MN-5 | TIZA | 404 page: mensaje en inglés "This page could not be found" — debería ser español | 🟡 Menor |
| MN-6 | RELEVO | 404 page: mismo issue, mensaje en inglés | 🟡 Menor |
| MN-7 | TIZA/RELEVO | Mobile (375px): hamburger menu no visible en header (puede ser intencional si no hay menú móvil) | 🟡 Menor |
| MN-8 | TIZA/RELEVO | Tablet (768px): feature cards en RELEVO se apilan 2x2 en vez de 4x1 (OK responsive) | ✅ OK |

---

## ⚪ ISSUES COSMÉTICOS

| ID | App | Descripción |
|----|-----|-------------|
| CO-1 | TIZA | Footer: "Hecho con ❤️ en Chile" — emoji puede no renderizar en todos los SO |
| CO-2 | RELEVO | Footer: "RELEVO SpA — © 2026. Santiago, Chile." — formato inconsistente vs TIZA |

---

## ✅ LO QUE FUNCIONA BIEN

1. **Landing Pages (TIZA + RELEVO):** Carga correcta, SSR funcionando, títulos y meta tags correctos
2. **Branding Visual:** 
   - TIZA: Naranja (#F4813D) consistente en header, botones, iconos
   - RELEVO: Azul marino (#1A3A5C) consistente en header, cards, botones
3. **Navegación Header:** Links "Iniciar sesión" y "Registrarse gratis"/"Solicitar demo" funcionan y navegan correctamente
3. **Feature Cards:** 
   - TIZA: 3 cards (Ahorra tiempo, Corrección inteligente, Reportes) ✓
   - RELEVO: 4 cards (KPIs tiempo real, Multi-colegio, Predicción SIMCE, Datos en Chile) ✓
4. **Footer:** Presente en ambas, copyright correcto
5. **Responsive Design:** 
   - 375px (mobile): Stack correcto, legible
   - 768px (tablet): Grid 2-cols en TIZA, 2x2 en RELEVO
   - 1440px (desktop): Grid completo, espaciado correcto
6. **404 Pages:** Renderizan correctamente con estilo Next.js default (aunque mensaje en inglés)
7. **Console Errors:** Ningún error de JS en landing pages (0 console errors)
8. **Network:** Sin requests fallidos en landing pages (200 OK en todos los assets)

---

## PRUEBAS DE RESPONSIVE (Playwright)

| Viewport | TIZA Landing | RELEVO Landing | TIZA Register | RELEVO Register | TIZA Login | RELEVO Login |
|----------|-------------|----------------|---------------|-----------------|------------|--------------|
| 375×812 (Mobile) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 768×1024 (Tablet) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 1440×900 (Desktop) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Nota: ✅ = Renderiza sin overflow horizontal, texto legible, touch targets adecuados*

---

## ERRORES DE CONSOLA DETECTADOS

```
TIZA Landing:     0 errors, 0 warnings
RELEVO Landing:   0 errors, 0 warnings  
TIZA Register:    0 errors (pero sin network activity al submit)
RELEVO Register:  0 errors (pero sin network activity al submit)
TIZA Login:       0 errors (pero sin network activity al submit)
RELEVO Login:     0 errors (pero sin network activity al submit)
API /health:      N/A (endpoint saludable)
API /register:    500 Internal Server Error (bcrypt)
API /login:       ECONNRESET
```

---

## VEREDICTO FINAL: **FAIL** ⛔

### La fase NO puede avanzar. Se requieren correcciones obligatorias:

**BLOQUEADORES CRÍTICOS (Deben arreglarse ANTES de re-evaluar):**
- [ ] **BUG-1**: Conectar formularios de registro/login a API backend (@nexus + @forge)
- [ ] **BUG-2**: Fix bcrypt/passlib + PostgreSQL en API (@sage + @forge)

**BLOQUEADORES MAYORES (Deben arreglarse):**
- [ ] **BUG-3**: Validación client-side + server-side en login (@nexus)
- [ ] **BUG-4**: Loading states + prevención double-submit (@aria + @nexus)
- [ ] **BUG-5**: Levantar PostgreSQL + ejecutar migraciones (@vault + @sage)

---

## Próximos Pasos

1. **Titan** reabre issues en GitHub/GitLab para cada bug arriba
2. **Equipo backend** (@forge, @sage, @vault): Fix API auth + DB en paralelo
3. **Equipo frontend** (@aria, @nexus): Conectar forms a API + loading states + validación
4. **Re-evaluación**: Una vez corregidos, Raven re-ejecuta QA Gate completo

---

*"El código que no se prueba, se rompe. El código que se prueba pero no se arregla, se queda en staging para siempre."* — Raven 🐦‍⬛

**Firma:** Raven QA Manual & Exploratory  
**Timestamp:** 2026-07-11T20:45:00-04:00
