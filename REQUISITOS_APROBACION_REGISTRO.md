# Requisitos Refinados: Sistema de Aprobación de Registros

## Visión

Implementar un sistema de aprobación manual de registros para RELEVO que permita al founder/admin controlar quién obtiene acceso a la plataforma, evitando que usuarios no autorizados creen cuentas gratuitas y accedan al sistema sin validación.

**Para quién**: Founder/Admin (aprueba) y Directores/Sostenedores (solicitan acceso)  
**Qué resuelve**: Control de acceso centralizado, prevención de registros no autorizados, trazabilidad de solicitudes

---

## Usuarios Objetivo

### Usuario 1: Founder/Admin (Aprobador)
- **Perfil**: Administrador principal de la plataforma (actualmente el founder)
- **Necesidad**: Controlar quién accede a RELEVO, aprobar/rechazar solicitudes de registro
- **Punto de dolor actual**: Cualquier persona puede registrarse y obtener acceso inmediato sin validación

### Usuario 2: Director/Sostenedor (Solicitante)
- **Perfil**: Director de colegio o sostenedor que desea usar RELEVO para gestionar evaluaciones
- **Necesidad**: Registrarse en la plataforma y esperar aprobación para acceder
- **Punto de dolor actual**: Ninguno (el flujo actual es inmediato), pero el negocio necesita control

---

## Funcionalidades Priorizadas

### F1: Estados de Usuario y Tenant — Prioridad: MUST

**Historia**: Como sistema, necesito que los usuarios y tenants tengan estados (pending, active, rejected, suspended) para controlar el acceso a la plataforma.

**Criterios de Aceptación**:
- [ ] La tabla `users` tiene columna `status` con valores: `pending`, `active`, `rejected`, `suspended` (default: `pending`)
- [ ] La tabla `tenants` tiene columna `status` con valores: `pending`, `active`, `rejected`, `suspended` (default: `pending`)
- [ ] El registro de nuevos usuarios/tenants crea registros con status `pending` automáticamente
- [ ] El login verifica que el usuario tenga status `active` — si es `pending`, `rejected` o `suspended`, rechaza el login con mensaje apropiado
- [ ] Los endpoints de la API verifican status `active` del usuario antes de permitir cualquier operación (excepto ver su propio perfil y estado)
- [ ] Migración de base de datos incluye actualización de usuarios existentes a status `active` (para no bloquear usuarios actuales)

**Dependencias**: Ninguna (base del sistema)  
**Notas técnicas**: 
- Usar enum en SQLAlchemy para validar valores
- Índices en columna `status` para queries eficientes
- Considerar soft delete con status `suspended` en lugar de eliminar registros

---

### F2: Flujo de Registro con Aprobación Manual — Prioridad: MUST

**Historia**: Como director/sostenedor, quiero registrarme en RELEVO para solicitar acceso a la plataforma, entendiendo que debo esperar aprobación.

**Criterios de Aceptación**:
- [ ] POST `/api/auth/register` crea usuario con status `pending` y tenant con status `pending`
- [ ] El endpoint devuelve respuesta exitosa (201) con mensaje: "Registro exitoso. Tu solicitud está siendo revisada. Recibirás un email cuando sea aprobada."
- [ ] El usuario NO recibe JWT token inmediatamente (no puede hacer login hasta ser aprobado)
- [ ] El usuario puede hacer login después del registro, pero recibe error 403 con mensaje: "Tu cuenta está pendiente de aprobación. Recibirás un email cuando sea activada."
- [ ] El tenant se crea con `join_code` pero status `pending` (no usable hasta aprobación)
- [ ] El registro valida que el email no exista ya (comportamiento actual)

**Dependencias**: F1 (estados de usuario/tenant)  
**Notas técnicas**:
- Mantener validaciones actuales (email único, password mínimo 8 caracteres, etc.)
- No enviar email de bienvenida hasta aprobación (F4)
- Logging de solicitud de registro para auditoría

---

### F3: Panel de Aprobación para Admin — Prioridad: MUST

**Historia**: Como founder/admin, quiero ver y gestionar las solicitudes de registro pendientes para aprobar o rechazar accesos.

**Criterios de Aceptación**:
- [ ] GET `/api/admin/pending-registrations` lista todos los usuarios con status `pending` (solo accesible para usuarios con role `super_admin`)
- [ ] La respuesta incluye: id, email, name, role, tenant_id, tenant_name, created_at
- [ ] POST `/api/admin/approve/{user_id}` cambia status de usuario y tenant a `active`
- [ ] POST `/api/admin/reject/{user_id}` cambia status de usuario y tenant a `rejected` (con motivo opcional)
- [ ] Los endpoints de admin requieren autenticación con role `super_admin` (middleware de autorización)
- [ ] Frontend: Página `/admin/pending` en RELEVO (puerto 3002) muestra tabla de solicitudes pendientes con acciones "Aprobar" y "Rechazar"
- [ ] Frontend: Modal de confirmación para aprobar/rechazar con campo opcional de motivo (requerido para rechazar)
- [ ] Frontend: Notificación toast de éxito/error después de acción

**Dependencias**: F1, F2  
**Notas técnicas**:
- Crear role `super_admin` (diferente de `director` actual)
- Seeder para crear usuario super_admin inicial (email: admin@relevo.cl, password: generado o env variable)
- Paginación en lista de pendientes (si crece)
- Considerar filtros por fecha, nombre, tenant

---

### F4: Notificaciones por Email — Prioridad: SHOULD

**Historia**: Como director/sostenedor, quiero recibir un email cuando mi solicitud sea aprobada para saber que ya puedo acceder a la plataforma.

**Criterios de Aceptación**:
- [ ] Al aprobar usuario (F3), sistema envía email con asunto: "Tu acceso a RELEVO ha sido aprobado"
- [ ] Email incluye: nombre del usuario, nombre del tenant, link de login, instrucciones básicas
- [ ] Al rechazar usuario (F3), sistema envía email con asunto: "Tu solicitud de acceso a RELEVO"
- [ ] Email de rechazo incluye: motivo del rechazo (si se proporcionó), contacto de soporte
- [ ] Emails se envían async (usar Redis queue o background task de FastAPI)
- [ ] Template de emails en HTML responsive (Tailwind email o similar)

**Dependencias**: F3  
**Notas técnicas**:
- Usar servicio de email (SendGrid, AWS SES, o similar) — configurar en variables de entorno
- Background tasks con `BackgroundTasks` de FastAPI o Redis/BullMQ
- Templates reutilizables para futuros emails (bienvenida, reset password, etc.)
- Considerar cola de emails para no bloquear respuesta HTTP

---

### F5: Dashboard de Solicitudes para Usuario Pendiente — Prioridad: SHOULD

**Historia**: Como director/sostenedor con solicitud pendiente, quiero ver el estado de mi solicitud en la plataforma para saber qué pasa.

**Criterios de Aceptación**:
- [ ] Usuario con status `pending` puede hacer login pero es redirigido a página `/pending`
- [ ] Página `/pending` muestra: "Tu solicitud está siendo revisada", fecha de solicitud, estado actual
- [ ] Página `/pending` tiene botón "Cerrar sesión"
- [ ] Usuario NO puede acceder a otras rutas (middleware de protección redirige a `/pending`)
- [ ] Usuario puede ver su estado en perfil: "Estado: Pendiente de aprobación"

**Dependencias**: F1, F2  
**Notas técnicas**:
- Middleware en Next.js que verifica status del usuario (desde JWT o API call)
- Página estática con mensaje claro y tiempo estimado de respuesta (ej: "Respondemos en 24-48 horas")
- Considerar mostrar progreso visual (stepper: Solicitud → Revisión → Aprobación)

---

### F6: Usuario Super Admin con Acceso Completo — Prioridad: MUST

**Historia**: Como super admin, quiero tener acceso total a la plataforma para gestionar usuarios, tenants y configuraciones globales.

**Criterios de Aceptación**:
- [ ] Role `super_admin` existe en sistema (diferente de `director`)
- [ ] Super admin puede ver todos los tenants (incluso pending, rejected, suspended)
- [ ] Super admin puede cambiar status de cualquier usuario/tenant
- [ ] Super admin puede ver métricas básicas: total usuarios, pendientes, activos, rechazados
- [ ] Super admin NO está sujeto a validación de tenant (puede operar sin tenant_id o con tenant_id null)
- [ ] Middleware de autorización distingue entre `super_admin` y `director` (permisos diferentes)

**Dependencias**: F1  
**Notas técnicas**:
- Super admin puede no tener tenant_id (opera a nivel plataforma)
- Considerar tabla `permissions` para RBAC más granular (futuro)
- Auditoría de acciones de super admin (log de cambios)

---

### F7: Auto-Aprobación para Dominios Específicos — Prioridad: COULD

**Historia**: Como super admin, quiero configurar dominios de email que se auto-aprueben (ej: @colegio.cl) para reducir fricción en instituciones conocidas.

**Criterios de Aceptación**:
- [ ] Tabla `auto_approve_domains` con columna `domain` (ej: "colegio.cl")
- [ ] Al registrarse con email de dominio auto-aprobado, usuario/tenant se crea con status `active`
- [ ] Super admin puede agregar/remover dominios de auto-aprobación desde panel admin
- [ ] Email de bienvenida se envía automáticamente para dominios auto-aprobados

**Dependencias**: F3, F4  
**Notas técnicas**:
- Validación de dominio en registro (extraer dominio del email)
- Considerar whitelist de dominios conocidos (colegios partners)
- Logging de auto-aprobaciones para auditoría

---

### F8: Link de Invitación Directa — Prioridad: COULD

**Historia**: Como super admin, quiero generar links de invitación que permitan registro directo (sin aprobación) para usuarios pre-autorizados.

**Criterios de Aceptación**:
- [ ] Super admin puede generar links de invitación con token único (ej: `/register?invite=TOKEN`)
- [ ] Link de invitación tiene expiración (ej: 7 días) y límite de usos (ej: 1 uso)
- [ ] Registro con link de invitación válido crea usuario/tenant con status `active` automáticamente
- [ ] Tabla `invitations` con: token, created_by, expires_at, max_uses, used_count, status

**Dependencias**: F3  
**Notas técnicas**:
- Tokens UUIDv4 con expiración
- Validación de token en registro (verificar expiración y usos)
- Considerar invitaciones por tenant (director invita profesores)

---

## Fuera de Alcance (Won't Have para MVP)

- **Onboarding guiado post-aprobación**: Flujo de setup inicial después de aprobación (se puede añadir después)
- **Aprobación multi-nivel**: Flujo de aprobación con múltiples aprobadores (complejidad innecesaria ahora)
- **Integración con CRM**: Sincronización con herramientas externas de ventas/leads
- **Aprobación via Slack/Teams**: Notificaciones y aprobación desde mensajería (nice-to-have futuro)
- **Roles personalizados**: RBAC granular con permisos custom (usar roles fijos por ahora)
- **API pública para integraciones**: Endpoints para que terceros gestionen registros

---

## Riesgos de Producto

### Riesgo 1: Fricción en el registro
- **Descripción**: El flujo de aprobación manual puede desincentivar registros legítimos
- **Mitigación**: 
  - Mensaje claro en formulario de registro: "Respondemos en 24-48 horas"
  - Landing page con valor claro de RELEVO para motivar registro
  - Considerar auto-aprobación para dominios conocidos (F7)

### Riesgo 2: Cuello de botella en aprobación
- **Descripción**: Si hay muchas solicitudes, el founder puede saturarse aprobando manualmente
- **Mitigación**:
  - Notificaciones push/email para nuevas solicitudes pendientes
  - Dashboard con batch actions (aprobar múltiples de una vez)
  - Auto-aprobación para dominios de confianza (F7)

### Riesgo 3: Usuarios existentes bloqueados
- **Descripción**: Migración de estados puede bloquear usuarios actuales si no se maneja bien
- **Mitigación**:
  - Migración actualiza usuarios existentes a status `active` automáticamente
  - Super admin inicial se crea con status `active`
  - Testing de migración en staging antes de producción

### Riesgo 4: Seguridad de endpoints admin
- **Descripción**: Endpoints de aprobación mal protegidos pueden ser explotados
- **Mitigación**:
  - Middleware estricto de autorización (solo `super_admin`)
  - Rate limiting en endpoints admin
  - Auditoría de todas las acciones de aprobación/rechazo
  - Logs de cambios de status (quién, cuándo, qué)

---

## Flujo Detallado de Registro + Aprobación

### Escenario A: Registro Normal (Flujo Principal)

```
1. Usuario visita relevo.cl/register
2. Completa formulario: name, email, password, nombre_colegio
3. Frontend envía POST /api/auth/register
4. Backend:
   a. Valida datos (email único, password fuerte)
   b. Crea tenant con status="pending", name="Colegio XYZ"
   c. Crea user con status="pending", role="director", tenant_id=tenant.id
   d. NO genera JWT token
   e. Retorna 201: { message: "Registro exitoso. Tu solicitud está siendo revisada." }
5. Frontend muestra página de confirmación: "Solicitud enviada. Te notificaremos por email."
6. Usuario recibe email (opcional, F4): "Hemos recibido tu solicitud. Respuesta en 24-48h."
7. Usuario puede intentar login → recibe 403: "Cuenta pendiente de aprobación"
8. Usuario ve página /pending con estado de solicitud (F5)

9. Super admin recibe notificación (email/dashboard): "Nueva solicitud pendiente"
10. Super admin visita /admin/pending en RELEVO
11. Super admin ve tabla con: nombre, email, colegio, fecha solicitud
12. Super admin hace clic en "Aprobar" → modal de confirmación
13. Super admin confirma → POST /api/admin/approve/{user_id}
14. Backend:
    a. Cambia user.status a "active"
    b. Cambia tenant.status a "active"
    c. Genera join_code único para tenant (si no existe)
    d. Retorna 200: { message: "Usuario aprobado" }
15. Usuario recibe email (F4): "Tu acceso ha sido aprobado. Ya puedes iniciar sesión."
16. Usuario hace login → recibe JWT → accede a dashboard normal
```

### Escenario B: Rechazo de Solicitud

```
1-8. Igual que Escenario A

9. Super admin visita /admin/pending
10. Super admin hace clic en "Rechazar" → modal con campo de motivo (requerido)
11. Super admin ingresa motivo: "Colegio no cumple requisitos mínimos"
12. Super admin confirma → POST /api/admin/reject/{user_id} con body: { reason: "..." }
13. Backend:
    a. Cambia user.status a "rejected"
    b. Cambia tenant.status a "rejected"
    c. Guarda motivo en tabla (audit log)
    d. Retorna 200: { message: "Usuario rechazado" }
14. Usuario recibe email (F4): "Tu solicitud fue rechazada. Motivo: ..."
15. Usuario intenta login → recibe 403: "Cuenta rechazada. Contacta soporte."
16. Usuario ve página /pending con estado "Rechazada" y motivo
```

### Escenario C: Usuario Existente (Migración)

```
1. Migración se ejecuta en deployment
2. Script de migración:
   a. Añade columna status a users y tenants (default: "pending")
   b. Actualiza todos los users existentes: status = "active"
   c. Actualiza todos los tenants existentes: status = "active"
   d. Crea usuario super_admin si no existe:
      - email: admin@relevo.cl (o desde env variable)
      - password: desde env variable o generado
      - role: "super_admin"
      - status: "active"
      - tenant_id: null
3. Usuarios existentes pueden seguir usando plataforma sin interrupciones
4. Nuevos registros entran con status "pending"
```

---

## Criterios de Aceptación Globales (Definition of Done)

### Funcionalidad
- [ ] Usuario puede registrarse pero queda en estado `pending`
- [ ] Usuario pendiente NO puede acceder a funcionalidades de la plataforma
- [ ] Usuario pendiente ve página de estado con mensaje claro
- [ ] Super admin puede ver lista de solicitudes pendientes
- [ ] Super admin puede aprobar solicitud → usuario/tenant pasan a `active`
- [ ] Super admin puede rechazar solicitud con motivo → usuario/tenant pasan a `rejected`
- [ ] Usuario aprobado recibe notificación (email, F4)
- [ ] Usuario rechazado recibe notificación con motivo (email, F4)
- [ ] Usuario activo puede hacer login y acceder normalmente
- [ ] Usuarios existentes no se ven afectados por la migración

### Seguridad
- [ ] Endpoints de admin protegidos con role `super_admin`
- [ ] Login verifica status del usuario (solo `active` puede entrar)
- [ ] Middleware de autorización verifica status en cada request
- [ ] Auditoría de cambios de status (quién aprobó/rechazó, cuándo, motivo)
- [ ] Rate limiting en endpoints de registro y admin

### UX/UI
- [ ] Mensaje claro en formulario de registro: "Respuesta en 24-48 horas"
- [ ] Página de confirmación post-registro con mensaje de espera
- [ ] Página /pending con estado visual claro (stepper o badge)
- [ ] Panel admin con tabla de pendientes y acciones claras
- [ ] Modales de confirmación para aprobar/rechazar
- [ ] Notificaciones toast de éxito/error en acciones admin

### Testing
- [ ] Tests unitarios para lógica de estados (transiciones válidas/inválidas)
- [ ] Tests de integración para endpoints de registro y admin
- [ ] Tests E2E para flujo completo: registro → aprobación → login
- [ ] Tests de migración (usuarios existentes no se bloquean)
- [ ] Cobertura ≥ 80% en módulos nuevos

### Documentación
- [ ] README actualizado con flujo de registro y aprobación
- [ ] Documentación de endpoints admin (OpenAPI/Swagger)
- [ ] Documentación de roles y permisos
- [ ] Guía para super admin: cómo aprobar/rechazar solicitudes

### Despliegue
- [ ] Migración de base de datos probada en staging
- [ ] Super admin inicial creado con credenciales seguras
- [ ] Variables de entorno documentadas (ADMIN_EMAIL, ADMIN_PASSWORD)
- [ ] Rollback plan si migración falla

---

## Próximos Pasos

### Fase 1: MVP (Sprint 1 — 1 semana)
1. **@titan**: Revisar y aprobar este documento de requisitos
2. **@sage**: Diseñar schema de base de datos (columnas status, tabla audit_logs)
3. **@forge**: Implementar endpoints de admin (approve/reject/list pending)
4. **@sage**: Crear migración de base de datos (status columns + super_admin seed)
5. **@aria**: Crear página /admin/pending en RELEVO
6. **@nexus**: Implementar estado de autenticación con verificación de status

### Fase 2: Notificaciones y UX (Sprint 2 — 1 semana)
1. **@forge**: Implementar envío de emails (aprobación/rechazo)
2. **@aria**: Crear página /pending para usuarios pendientes
3. **@nexus**: Implementar middleware de redirección según status
4. **@echo**: Escribir tests E2E para flujo completo

### Fase 3: Validación y Seguridad (Sprint 3 — 3-5 días)
1. **@raven**: QA manual — probar flujo completo, casos borde, seguridad
2. **@echo**: QA automatizado — ejecutar suite de tests, verificar cobertura
3. **@inquisitor**: QA audit — interrogar reportes, exigir evidencia
4. **@warden**: Security gate — revisar vulnerabilidades, endpoints protegidos
5. **@vault**: Configurar CI/CD, variables de entorno, despliegue

### Fase 4: Features Adicionales (Sprint 4+ — opcional)
1. Auto-aprobación por dominio (F7)
2. Links de invitación (F8)
3. Batch actions en panel admin
4. Métricas y dashboard de solicitudes

---

## Notas Técnicas para el Equipo

### Consideraciones de Base de Datos
- Usar enum en SQLAlchemy para status: `UserStatus = Enum('pending', 'active', 'rejected', 'suspended')`
- Índices en `status` para queries eficientes: `INDEX idx_users_status ON users(status)`
- Migración debe ser idempotente (puede ejecutarse múltiples veces sin efectos duplicados)
- Considerar soft delete con status `suspended` en lugar de DELETE físico

### Consideraciones de Seguridad
- Super admin inicial debe tener password fuerte (generado o desde env variable)
- Endpoints de admin requieren autenticación + autorización (doble verificación)
- Rate limiting en /register (5 requests por minuto por IP)
- Logs de auditoría para todas las acciones de aprobación/rechazo
- Considerar 2FA para super admin (futuro)

### Consideraciones de UX
- Mensajes claros y empáticos: "Estamos revisando tu solicitud" vs "Tu cuenta está pending"
- Tiempo estimado de respuesta visible en formulario de registro
- Página /pending con diseño amigable (no parecer error)
- Notificaciones toast con duración adecuada (5s para éxito, 10s para error)

### Consideraciones de Performance
- Queries de pendientes paginadas (20 por página)
- Emails enviados async (no bloquear respuesta HTTP)
- Cache de lista de pendientes si crece mucho (Redis)

---

**Documento preparado por**: Atlas 🌐 Product Manager / PO  
**Fecha**: 2026-07-17  
**Versión**: 1.0  
**Estado**: Pendiente de revisión por Titan

*"No cargamos código — cargamos el peso de asegurar que cada línea que se escribe resuelve un problema real."* — Atlas
