# Variables de Entorno — RELEVO + TIZA

> **Última actualización**: Julio 2026
> **Propósito**: Documento canónico con todas las variables de entorno necesarias para desarrollo, staging y producción.

---

## Índice

1. [Frontend — TIZA (`apps/tiza-web`)](#1-frontend--tiza-appstiza-web)
2. [Frontend — RELEVO (`apps/relevo-web`)](#2-frontend--relevo-appsrelevo-web)
3. [Backend — FastAPI (`apps/api`)](#3-backend--fastapi-appsapi)
4. [Pipeline de IA — Workers](#4-pipeline-de-ia--workers)
5. [Base de Datos — PostgreSQL](#5-base-de-datos--postgresql)
6. [Infraestructura — AWS](#6-infraestructura--aws)
7. [Monorepo — Paquetes Compartidos](#7-monorepo--paquetes-compartidos)
8. [Plantilla `.env.example` completa](#8-plantilla-envexample-completa)
9. [Secretos que necesitas ANTES de empezar](#9-secretos-que-necesitas-antes-de-empezar)

---

## 1. Frontend — TIZA (`apps/tiza-web`)

Archivo: `apps/tiza-web/.env.local`

```bash
# ─── NextAuth ───────────────────────────────────────────────
# URL canónica de la app TIZA. En dev: http://localhost:3001
NEXTAUTH_URL=http://localhost:3001
# Secreto para firmar JWT y cookies de sesión. Generar con: openssl rand -hex 32
NEXTAUTH_SECRET=change-me-generate-with-openssl

# ─── API Backend ───────────────────────────────────────────
# URL del backend FastAPI compartido (mismo para TIZA y RELEVO)
NEXT_PUBLIC_API_URL=http://localhost:8000
# Timeout para llamadas a la API (ms)
NEXT_PUBLIC_API_TIMEOUT=30000

# ─── Identidad de Marca ────────────────────────────────────
# Siempre "tiza" en este frontend
NEXT_PUBLIC_BRAND=tiza
# Nombre público de la app
NEXT_PUBLIC_APP_NAME=TIZA
# Tagline
NEXT_PUBLIC_TAGLINE=Tu tiempo, tu enseñanza

# ─── Base de Datos (Prisma) ────────────────────────────────
# Solo para operaciones de build/migraciones. Conexión de solo lectura.
DATABASE_URL=postgresql://user:password@localhost:5432/tiza_dev

# ─── URLs Públicas ─────────────────────────────────────────
NEXT_PUBLIC_TIZA_URL=https://tiza.app
NEXT_PUBLIC_RELEVO_URL=https://relevo.cl

# ─── Feature Flags (desarrollo) ────────────────────────────
NEXT_PUBLIC_ENABLE_SCANNER_GUIDED=true
NEXT_PUBLIC_ENABLE_ITEM_ANALYSIS=true
NEXT_PUBLIC_ENABLE_STUDENT_PROGRESS=true
NEXT_PUBLIC_ENABLE_CHAT_SUPPORT=true

# ─── Terceros ──────────────────────────────────────────────
# Sentry (monitoreo de errores)
NEXT_PUBLIC_SENTRY_DSN=
# Analytics (ej. PostHog, Plausible)
NEXT_PUBLIC_ANALYTICS_ID=

# ─── Entorno ───────────────────────────────────────────────
NODE_ENV=development
NEXT_PUBLIC_ENV=development
```

---

## 2. Frontend — RELEVO (`apps/relevo-web`)

Archivo: `apps/relevo-web/.env.local`

```bash
# ─── NextAuth ───────────────────────────────────────────────
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=change-me-generate-with-openssl

# ─── API Backend ───────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_TIMEOUT=30000

# ─── Identidad de Marca ────────────────────────────────────
NEXT_PUBLIC_BRAND=relevo
NEXT_PUBLIC_APP_NAME=RELEVO
NEXT_PUBLIC_TAGLINE=Datos que transforman

# ─── Base de Datos ─────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/tiza_dev

# ─── URLs Públicas ─────────────────────────────────────────
NEXT_PUBLIC_TIZA_URL=https://tiza.app
NEXT_PUBLIC_RELEVO_URL=https://relevo.cl

# ─── Feature Flags (desarrollo) ────────────────────────────
NEXT_PUBLIC_ENABLE_BULK_UPLOAD=true
NEXT_PUBLIC_ENABLE_EXECUTIVE_KPIS=true
NEXT_PUBLIC_ENABLE_BILLING=true
NEXT_PUBLIC_ENABLE_MULTI_SCHOOL=true
NEXT_PUBLIC_ENABLE_WHITE_LABEL=true

# ─── Terceros ──────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_ANALYTICS_ID=

# ─── Entorno ───────────────────────────────────────────────
NODE_ENV=development
NEXT_PUBLIC_ENV=development
```

---

## 3. Backend — FastAPI (`apps/api`)

Archivo: `apps/api/.env`

```bash
# ─── Aplicación ────────────────────────────────────────────
APP_NAME=Relevo-Tiza API
APP_VERSION=0.1.0
ENVIRONMENT=development          # development | staging | production
LOG_LEVEL=DEBUG                  # DEBUG | INFO | WARNING | ERROR
API_PORT=8000
API_HOST=0.0.0.0

# ─── CORS ──────────────────────────────────────────────────
# Orígenes permitidos (separados por coma)
CORS_ORIGINS=http://localhost:3001,http://localhost:3002,https://*.tiza.app,https://*.relevo.cl

# ─── Base de Datos (PostgreSQL) ────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/tiza_dev
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_SSL_MODE=disable               # require en producción
# Schema-per-tenant: el nombre base del schema público
DB_PUBLIC_SCHEMA=public

# ─── Redis (cache + colas) ─────────────────────────────────
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=
REDIS_TENANT_CACHE_TTL=3600       # 1 hora para cache de tenant por subdominio

# ─── AWS / S3 ──────────────────────────────────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
# Buckets S3
S3_EVALUATIONS_BUCKET=tiza-evaluations-dev
S3_REPORTS_BUCKET=tiza-reports-dev
S3_CROPS_BUCKET=tiza-crops-dev
# Pre-signed URL expiration (segundos)
S3_PRESIGNED_URL_EXPIRY=3600

# ─── AWS SQS (Cola de procesamiento) ───────────────────────
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/tiza-processing-queue
SQS_BATCH_SIZE=400                 # Lotes de 400 recortes
SQS_WAIT_TIME=20                   # Long polling (segundos)
SQS_VISIBILITY_TIMEOUT=300         # 5 minutos

# ─── JWT / Auth ────────────────────────────────────────────
JWT_SECRET=change-me-generate-with-openssl
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=1440        # 24 horas
JWT_REFRESH_EXPIRATION_DAYS=7

# ─── Gemini API (Google) ───────────────────────────────────
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash      # Modelo por defecto para fallback
GEMINI_BATCH_MODEL=gemini-2.5-pro  # Modelo para batch processing
GEMINI_MAX_TOKENS=4096
GEMINI_TEMPERATURE=0.0             # Determinístico para corrección
# ⚠️ Context Caching DEBE estar deshabilitado (riesgo cross-tenant)
GEMINI_CONTEXT_CACHING=false

# ─── Pipeline IA Local ─────────────────────────────────────
# Endpoints de los servicios del pipeline híbrido
OCR_ENSEMBLE_URL=http://localhost:8001
QWEN_LLM_URL=http://localhost:8002
# Threshold de confianza: debajo de esto → fallback a Gemini API
CONFIDENCE_THRESHOLD=0.65
# Umbral que marca REQUIERE_REVISIÓN_URGENTE
REQUIRES_REVIEW_THRESHOLD=0.65

# ─── vLLM (si usas Qwen2.5-VL self-hosted) ────────────────
VLLM_ENDPOINT=http://localhost:8002
VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct-AWQ

# ─── Encriptación (pgcrypto + KMS) ─────────────────────────
# ARN de la key en AWS KMS para datos sensibles
KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789:key/abc-123
# Si no usas KMS (solo dev), clave local
ENCRYPTION_KEY=change-me-32-bytes-hex-string

# ─── Seguridad ─────────────────────────────────────────────
# Rate limiting (requests por minuto por IP)
RATE_LIMIT_PER_MINUTE=60
# Tamaño máximo de archivo subido (bytes) — 50MB
MAX_UPLOAD_SIZE=52428800
# Permitir IPs internas sin rate limiting (scanner)
INTERNAL_IPS=10.0.0.0/8,172.16.0.0/12

# ─── Email (transaccional) ─────────────────────────────────
# Proveedor: Resend / SendGrid / AWS SES
EMAIL_PROVIDER=resend              # resend | sendgrid | ses
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM_TIZA=noreply@tiza.app
EMAIL_FROM_RELEVO=noreply@relevo.cl

# ─── Sentry (monitoreo) ────────────────────────────────────
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=1.0      # 100% en dev, 0.1 en prod

# ─── Stripe (facturación RELEVO) ───────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SMALL=price_small     # <300 estudiantes
STRIPE_PRICE_MEDIUM=price_medium   # 300-800
STRIPE_PRICE_LARGE=price_large     # 800+

# ─── Feature Flags ─────────────────────────────────────────
FF_ENABLE_BULK_UPLOAD=true
FF_ENABLE_EXECUTIVE_KPIS=true
FF_ENABLE_BILLING=true
FF_ENABLE_MULTI_SCHOOL=true
FF_ENABLE_SCANNER_GUIDED=true
FF_ENABLE_LITE_MODE=false          # Versión sin imágenes para colegios con ancho de banda bajo
```

---

## 4. Pipeline de IA — Workers

Archivo: `apps/api/.env.workers` (o en mismo `.env` si es monolito)

```bash
# ─── OCR Ensemble (FusionOCR) ──────────────────────────────
# Los modelos se cargan al iniciar. VRAM necesaria: ~3-4 GB por modelo.
TROCR_HAND_MODEL=microsoft/trocr-large-handwritten
TROCR_PRINT_MODEL=microsoft/trocr-large-printed
EASYOCR_LANGUAGES=en,es
OCR_DEVICE=cuda                   # cuda | cpu

# ─── LLM Local (Qwen2.5-7B) ────────────────────────────────
QWEN_MODEL_ID=Qwen/Qwen2.5-7B-Instruct-AWQ
QWEN_QUANTIZATION=awq
QWEN_MAX_MODEL_LEN=8192
QWEN_GPU_MEMORY_UTILIZATION=0.90
QWEN_TENSOR_PARALLEL_SIZE=1       # Número de GPUs

# ─── FLAN-T5 (refinamiento) ────────────────────────────────
FLANT5_MODEL=google/flan-t5-small

# ─── Gemini Fallback ───────────────────────────────────────
# Solo se usa cuando CONFIDENCE_THRESHOLD no se alcanza (~10% del tráfico)
GEMINI_FLASH_API_KEY=your-gemini-api-key
GEMINI_FLASH_MODEL=gemini-2.0-flash

# ─── Control ───────────────────────────────────────────────
MAX_RETRIES=3
BATCH_TIMEOUT_SECONDS=600          # 10 minutos máximo por lote
CLEANUP_CROPS_AFTER_HOURS=48       # Purgar crops temporales
```

---

## 5. Base de Datos — PostgreSQL

Estas variables las usa Prisma (`packages/database/.env`):

```bash
# ─── Conexión ──────────────────────────────────────────────
DATABASE_URL=postgresql://tiza_user:tiza_password@localhost:5432/tiza_dev
# En producción, RDS Proxy
DATABASE_URL_PROXY=postgresql://tiza_user:tiza_password@rds-proxy.endpoint:5432/tiza_prod

# ─── Migraciones ───────────────────────────────────────────
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=false

# ─── Shadow Database (para migraciones en dev) ────────────
SHADOW_DATABASE_URL=postgresql://tiza_user:tiza_password@localhost:5432/tiza_shadow
```

### Docker Compose para PostgreSQL local

```yaml
# docker-compose.db.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tiza_user
      POSTGRES_PASSWORD: tiza_password
      POSTGRES_DB: tiza_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

---

## 6. Infraestructura — AWS

Archivo: `.env.aws` (para Terraform / CDK / aws-cli)

```bash
# ─── Cuenta AWS ────────────────────────────────────────────
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
# Para Terraform
TF_VAR_aws_region=us-east-1
TF_VAR_environment=development

# ─── Dominios ───────────────────────────────────────────────
# Wildcard subdomains
TF_VAR_tiza_domain=tiza.app
TF_VAR_relevo_domain=relevo.cl
# Subdominio wildcard para tenants (ej. colegio-san-martin.tiza.app)
TF_VAR_tenant_wildcard=*.tiza.app

# ─── ACM (certificados SSL) ────────────────────────────────
TF_VAR_acm_certificate_arn=arn:aws:acm:us-east-1:...

# ─── VPC ───────────────────────────────────────────────────
TF_VAR_vpc_cidr=10.0.0.0/16
TF_VAR_private_subnet_cidrs=["10.0.1.0/24","10.0.2.0/24"]
TF_VAR_public_subnet_cidrs=["10.0.101.0/24","10.0.102.0/24"]

# ─── RDS ───────────────────────────────────────────────────
TF_VAR_db_instance_class=db.t4g.medium
TF_VAR_db_storage_gb=100
TF_VAR_db_multi_az=false

# ─── ECS / EKS ─────────────────────────────────────────────
TF_VAR_ecs_task_cpu=1024
TF_VAR_ecs_task_memory=2048
TF_VAR_ecs_desired_count=1

# ─── GPU (para IA self-hosted) ─────────────────────────────
# Si usas EC2 con GPU, o ECS con GPU
TF_VAR_gpu_instance_type=g4dn.xlarge    # 1× T4 16GB
# TF_VAR_gpu_instance_type=p4d.24xlarge  # 8× A100 40GB (producción)
```

---

## 7. Monorepo — Paquetes Compartidos

Archivo: `.env` (raíz del monorepo)

```bash
# ─── Turborepo ─────────────────────────────────────────────
TURBO_TOKEN=                      # Solo necesario para Remote Cache (Vercel)
TURBO_TEAM=

# ─── Node ──────────────────────────────────────────────────
NODE_VERSION=20
NPM_TOKEN=                        # Si usas paquetes privados

# ─── Docker Registry ───────────────────────────────────────
DOCKER_REGISTRY=localhost:5000
DOCKER_IMAGE_TAG=latest

# ─── CI/CD (GitHub Actions) ────────────────────────────────
CI=true
GITHUB_TOKEN=                     # Para publicar releases
```

---

## 8. Plantilla `.env.example` Completa

Puedes copiar este bloque a un archivo `.env.example` en la raíz del monorepo y que cada servicio tome lo que necesita:

```bash
# ═══════════════════════════════════════════════════════════════
# RELEVO + TIZA — Variables de Entorno
# ═══════════════════════════════════════════════════════════════
# Copiar este archivo a:
#   - apps/tiza-web/.env.local
#   - apps/relevo-web/.env.local
#   - apps/api/.env
#   - packages/database/.env
# ═══════════════════════════════════════════════════════════════

# ─── Entorno ──────────────────────────────────────────────────
NODE_ENV=development
ENVIRONMENT=development
LOG_LEVEL=DEBUG

# ─── URLs ─────────────────────────────────────────────────────
NEXTAUTH_URL_TIZA=http://localhost:3001
NEXTAUTH_URL_RELEVO=http://localhost:3002
API_URL=http://localhost:8000
TIZA_URL=https://tiza.app
RELEVO_URL=https://relevo.cl

# ─── Auth ─────────────────────────────────────────────────────
NEXTAUTH_SECRET=openssl-rand-hex-32
JWT_SECRET=openssl-rand-hex-32

# ─── Base de Datos ────────────────────────────────────────────
DATABASE_URL=postgresql://tiza_user:tiza_password@localhost:5432/tiza_dev
SHADOW_DATABASE_URL=postgresql://tiza_user:tiza_password@localhost:5432/tiza_shadow
REDIS_URL=redis://localhost:6379/0

# ─── AWS ──────────────────────────────────────────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_EVALUATIONS_BUCKET=tiza-evaluations-dev
S3_REPORTS_BUCKET=tiza-reports-dev
S3_CROPS_BUCKET=tiza-crops-dev
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/tiza-processing-queue

# ─── IA / Gemini ──────────────────────────────────────────────
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_BATCH_MODEL=gemini-2.5-pro
CONFIDENCE_THRESHOLD=0.65

# ─── IA / Pipeline Local ──────────────────────────────────────
OCR_ENSEMBLE_URL=http://localhost:8001
QWEN_LLM_URL=http://localhost:8002

# ─── Email ────────────────────────────────────────────────────
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_...
EMAIL_FROM_TIZA=noreply@tiza.app
EMAIL_FROM_RELEVO=noreply@relevo.cl

# ─── Stripe ───────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Encriptación ─────────────────────────────────────────────
ENCRYPTION_KEY=32-byte-hex-key
KMS_KEY_ARN=

# ─── Observabilidad ───────────────────────────────────────────
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=1.0

# ─── Feature Flags ────────────────────────────────────────────
FF_LITE_MODE=false
```

---

## 9. Secretos que Necesitas ANTES de Empezar

| # | Secreto | Cómo Obtenerlo | Prioridad |
|---|---------|---------------|-----------|
| 1 | **AWS Account** + IAM credentials | Crear cuenta AWS, generar access keys con permisos S3, SQS, RDS, KMS | 🔴 CRÍTICO |
| 2 | **Gemini API Key** | [Google AI Studio](https://aistudio.google.com/apikey) → Create API Key | 🔴 CRÍTICO |
| 3 | **Dominios**: `tiza.app`, `relevo.cl` | Comprar en registrador (Namecheap, AWS Route53, NIC Chile) | 🔴 CRÍTICO |
| 4 | **Email provider** (Resend/SendGrid) | Crear cuenta, verificar dominios, generar API key | 🟡 ALTO |
| 5 | **Stripe** (test mode) | [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API Keys | 🟡 ALTO |
| 6 | **Sentry** DSN | [Sentry.io](https://sentry.io) → Create Project → Client Keys DSN | 🟢 MEDIO |
| 7 | **GitHub Token** (CI/CD) | GitHub → Settings → Developer Settings → Personal Access Token | 🟢 MEDIO |
| 8 | **NEXTAUTH_SECRET** | `openssl rand -hex 32` | 🟢 MEDIO |
| 9 | **JWT_SECRET** | `openssl rand -hex 32` | 🟢 MEDIO |
| 10 | **ENCRYPTION_KEY** | `openssl rand -hex 32` | 🟢 MEDIO |

> ⚠️ **NUNCA** commitees estos valores al repositorio. Usa `.env.local` (gitignorado), AWS Secrets Manager, o Doppler para producción.

---

## Referencia Rápida: Puertos de Desarrollo

| Servicio | Puerto | URL Local |
|----------|--------|-----------|
| TIZA Web (Next.js) | 3001 | http://localhost:3001 |
| RELEVO Web (Next.js) | 3002 | http://localhost:3002 |
| Backend FastAPI | 8000 | http://localhost:8000 |
| OCR Ensemble | 8001 | http://localhost:8001 |
| LLM Qwen (vLLM) | 8002 | http://localhost:8002 |
| PostgreSQL | 5432 | postgresql://localhost:5432 |
| Redis | 6379 | redis://localhost:6379 |
| Stripe Webhook (local) | 8003 | http://localhost:8003/webhook |

---

*"La configuración no es código. Pero sin configuración, el código no hace nada."* — Bulma (CTO)
