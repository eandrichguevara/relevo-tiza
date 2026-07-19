# RELEVO + TIZA — Dream Team Project

## Stack Tecnológico

| Capa                        | Tecnología                                          |
| --------------------------- | --------------------------------------------------- |
| **Frontend (Profesores)**   | Next.js 14 (App Router), Tailwind CSS — puerto 3001 |
| **Frontend (Sostenedores)** | Next.js 14 (App Router), Tailwind CSS — puerto 3002 |
| **Backend**                 | FastAPI (Python) — puerto 8000                      |
| **Base de datos**           | PostgreSQL 16 (puerto 5432)                         |
| **Cache / Queue**           | Redis 7 (puerto 6379)                               |
| **Monorepo**                | Turborepo + pnpm                                    |
| **Infra**                   | Docker Compose (dev), GitHub Actions (CI/CD)        |

## Estructura del Monorepo

```
relevo-tiza/
├── apps/
│   ├── tiza-web/          # Next.js 14 — App de profesores (puerto 3001)
│   ├── relevo-web/        # Next.js 14 — Dashboard sostenedores (puerto 3002)
│   └── api/               # FastAPI Python — Backend unificado (puerto 8000)
├── packages/
│   ├── config/            # Feature flags y config compartida
│   ├── types/             # Tipos TypeScript/Python compartidos
│   ├── ui/                # Componentes React compartidos (Tailwind)
│   └── database/          # Prisma schema + migraciones
├── docker-compose.yml     # PostgreSQL 16 + Redis 7 para desarrollo local
├── turbo.json             # Pipeline de Turborepo
├── package.json           # Root package.json
└── pnpm-workspace.yaml    # Workspaces de pnpm
```

## Variables de Entorno

El archivo `.env` ya existe en la raíz con:

- `GEMINI_APIKEY` — API key para Google Gemini

## Puertos de Desarrollo

| Servicio             | Puerto |
| -------------------- | ------ |
| tiza-web (Next.js)   | 3001   |
| relevo-web (Next.js) | 3002   |
| api (FastAPI)        | 8000   |
| PostgreSQL           | 5432   |
| Redis                | 6379   |

## Infraestructura Local

Para desarrollo local, levantar servicios con:

```bash
docker compose up -d       # PostgreSQL + Redis
pnpm install               # Instalar dependencias
pnpm dev                   # Levantar todos los servicios
```

## CI/CD

Pipeline automatizado con GitHub Actions:

- Push a `main` → tests → build → deploy
- Quality Gates: QA (Raven + Echo) → Security (Warden)
