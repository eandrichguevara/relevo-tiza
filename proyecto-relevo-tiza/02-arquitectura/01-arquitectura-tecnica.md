# Arquitectura Técnica — Dual-Brand (RELEVO + TIZA)

## Stack Tecnológico

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Dos apps separadas**: `apps/tiza-web` y `apps/relevo-web`
- **Mono-repo**: Turborepo para compartir tipos, componentes, config
- **Subdominios**: `colegio.tiza.app` / `colegio.relevo.cl`
- **Auth**: NextAuth.js compartido con roles (teacher vs holder)

### Backend
- **Framework**: FastAPI (Python) — nativamente asíncrono
- **Backend único**: Compartido por ambas marcas
- **Brand resolution**: Middleware detecta marca por header `X-Tenant-Brand`
- **API**: OpenAPI spec con parámetro `brand`

### Base de Datos
- **PostgreSQL**: Amazon RDS
- **Arquitectura**: Schema-per-tenant (un esquema por colegio)
- **ORM**: Prisma o Drizzle (type-safe)
- **Cifrado**: pgcrypto para datos sensibles

### Procesamiento IA
- **Cola**: AWS SQS (o Redis + BullMQ)
- **Workers**: Celery o workers Python asíncronos
- **OCR**: OpenCV + ZBar para crops y QR
- **LLM**: Pipeline híbrido (ver sección LLM)

### Almacenamiento
- **S3**: PDFs originales, crops de respuestas, reportes
- **S3 Object Lock**: Inmutable para compliance
- **Lifecycle**: Hot (12 meses) → Cold (10 años) → Purga (12 años)

---

## Estructura del Mono-repo

```
relevo-tiza/
├── apps/
│   ├── tiza-web/              # Next.js - app para profesores
│   │   ├── app/
│   │   ├── components/
│   │   └── middleware.ts      # Tenant resolution
│   ├── relevo-web/            # Next.js - dashboard para sostenedores
│   │   ├── app/
│   │   ├── components/
│   │   └── middleware.ts
│   └── api/                   # FastAPI - backend único
│       ├── main.py
│       ├── routers/
│       ├── services/
│       └── middleware/
│           └── brand.py       # Brand resolution
├── packages/
│   ├── ui/                    # Componentes compartidos (Tailwind, Radix)
│   ├── api-client/            # TypeScript client generado de OpenAPI
│   ├── config/                # Feature flags, constants, env schemas
│   ├── types/                 # Shared TypeScript/Python types
│   └── database/              # Prisma schema + migrations
├── turbo.json
└── package.json
```

---

## Tenant Resolution (Middleware Next.js)

```typescript
// apps/tiza-web/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0]; // "colegio-san-martin"
  
  // Validar tenant existe en BD (cached en Redis)
  const tenant = await getTenantBySubdomain(subdomain);
  if (!tenant) return NextResponse.redirect(new URL('/404', request.url));
  
  // Inject tenant context en headers para API client
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenant.id);
  response.headers.set('x-tenant-brand', 'tiza');
  return response;
}

export const config = { 
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] 
};
```

---

## Brand-Aware Endpoints (FastAPI)

```python
# apps/api/main.py
from fastapi import FastAPI, Depends, Header
from enum import Enum

class Brand(str, Enum):
    TIZA = "tiza"
    RELEVO = "relevo"

app = FastAPI()

async def get_brand(x_tenant_brand: str = Header(..., alias="X-Tenant-Brand")) -> Brand:
    try:
        return Brand(x_tenant_brand.lower())
    except ValueError:
        raise HTTPException(400, "Invalid brand")

@app.get("/dashboard")
async def dashboard(
    brand: Brand = Depends(get_brand), 
    tenant_id: str = Depends(get_tenant_id)
):
    if brand == Brand.TIZA:
        return await get_teacher_dashboard(tenant_id)
    return await get_holder_dashboard(tenant_id)

@app.get("/reports/{evaluation_id}/pdf")
async def report_pdf(
    evaluation_id: str,
    brand: Brand = Depends(get_brand),
    template: str = Query(None)
):
    template = template or (
        "teacher_report" if brand == Brand.TIZA else "executive_report"
    )
    return await generate_pdf(evaluation_id, template, brand)
```

---

## Feature Flags por Brand

```typescript
// packages/config/features.ts
export const features = {
  tiza: {
    scannerGuided: true,        // Escaneo guiado paso a paso
    itemAnalysis: true,          // Análisis por pregunta
    studentProgress: true,       // Progreso individual
    chatSupport: true,           // Chat en app
    billing: false,              // No ve facturación
    multiSchool: false,          // Solo su colegio
  },
  relevo: {
    scannerGuided: false,
    bulkUpload: true,            // Carga masiva CSV
    executiveKPIs: true,         // KPIs ejecutivos
    billing: true,               // Facturación completa
    multiSchool: true,           // Múltiples colegios
    whiteLabel: true,            // Marca blanca
  },
} as const;
```

---

## Base de Datos (Prisma Schema)

```prisma
// packages/database/schema.prisma
model Tenant {
  id        String   @id @default(cuid())
  subdomain String   @unique
  name      String
  brand     Brand    // TIZA | RELEVO
  settings  Json     // feature flags override, branding config
  users     User[]
  evaluations Evaluation[]
  @@index([brand])
}

enum Brand {
  TIZA
  RELEVO
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  role      Role     // TEACHER | HOLDER | ADMIN
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  @@index([tenantId, role])
}

enum Role {
  TEACHER
  HOLDER
  ADMIN
}

model Evaluation {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  title       String
  subject     String
  grade       String
  rubric      Json     // JSONB con rúbrica
  pdfUrl      String
  createdAt   DateTime @default(now())
  results     Result[]
}

model Result {
  id              String   @id @default(cuid())
  evaluationId    String
  evaluation      Evaluation @relation(fields: [evaluationId], references: [id])
  studentCode     String   // Seudónimo (no RUT)
  answers         Json     // Respuestas del alumno
  aiCorrection    Json     // Corrección sugerida por IA
  teacherReview   Json?    // Revisión final del profesor
  confidence      Float    // Confianza de la IA (0-1)
  requiresReview  Boolean  // Requiere revisión manual
  finalGrade      Float?   // Nota final
  feedbackPdfUrl  String?  // PDF de retroalimentación
  createdAt       DateTime @default(now())
}
```

---

## Flujo de Procesamiento

```
1. Profesor crea evaluación en TIZA
   → Genera PDF con coordenadas + QR
   → Imprime y distribuye

2. Alumnos rinden prueba
   → Escriben en hojas con códigos QR

3. Colegio escanea pruebas
   → Escáner envía a S3 vía SFTP
   → FastAPI detecta nuevo archivo

4. Procesamiento por lotes
   → OpenCV recorta respuestas (crops)
   → SQS agrupa lotes de 400 recortes
   → Pipeline IA procesa (OCR + LLM)
   → Resultados en BD con confidence score

5. Revisión manual (si confidence < 0.65)
   → TIZA marca con REQUIERE_REVISIÓN_URGENTE
   → Profesor revisa y ajusta
   → Confirma o corrige sugerencia de IA

6. Generación de reportes
   → TIZA: PDF pedagógico para alumno
   → RELEVO: PDF ejecutivo para sostenedor
   → Dashboards actualizados en tiempo real
```

---

## Optimizaciones de Costo

### Gemini Context Caching
- Cachear system prompt + rúbricas por asignatura/grado
- Ahorro: ~60% tokens en Batch API

### S3 Intelligent Tiering
- PDFs reportes → IA después de 30 días
- Glacier después de 1 año

### RDS Proxy + Read Replicas
- Dashboards RELEVO (lectura pesada) → read replica
- Escritura → primary

### Feature Flag `lite_mode`
- Versión solo texto (sin imágenes) para colegios con ancho de banda bajo

---

## Decisiones Técnicas Críticas

### ✅ Hacer
- Mono-repo con Turborepo
- Dos frontends separados (no uno con `if (brand === 'tiza')`)
- Backend único con brand resolution
- Feature flags como source of truth
- Subdominios (no path-based routing)
- Emails transaccionales con dominios separados

### ❌ No Hacer
- Una sola app Next.js con condicionales de marca
- Duplicar backend (Gemini quota, workers x2)
- Path-based routing (`app.tiza.app/colegio-x`)
- Mezclar emails transaccionales
- Hardcodear templates PDF en código

---

## Próximos Pasos Técnicos

1. Scaffold mono-repo Turborepo
2. Configurar `packages/config/features.ts`
3. Implementar brand middleware en FastAPI
4. Generar OpenAPI spec con parámetro `brand`
5. Dividir frontend en `apps/tiza-web` y `apps/relevo-web`
6. Configurar subdominios wildcard en DNS
7. Implementar feature flags en UI
