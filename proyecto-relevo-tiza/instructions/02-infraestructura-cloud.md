# 02 — Infraestructura Cloud (AWS)

> **Tiempo estimado**: 1-2 semanas
> **Costo estimado**: $50-200 USD/mes (desarrollo), $500-2,000 USD/mes (producción inicial)
> **Bloqueante**: 🔴 SÍ — Sin infraestructura no hay backend, no hay almacenamiento, no hay nada.

---

## 2.1 Crear Cuenta AWS

### Qué es
Abrir una cuenta en Amazon Web Services para hospedar toda la infraestructura del proyecto.

### Qué implica exactamente
1. Ir a [aws.amazon.com](https://aws.amazon.com)
2. Crear cuenta con email empresarial (no personal)
3. Registrar tarjeta de crédito/débito internacional
4. Verificar identidad (llamada telefónica o SMS)
5. Elegir plan de soporte: **Basic** (gratis) es suficiente para empezar

### Consideraciones para Chile
- Tarjeta de crédito internacional (Visa/Mastercard funcionan sin problema)
- Facturación en USD (considera el tipo de cambio en tu modelo financiero)
- Región recomendada: **us-east-1** (N. Virginia) — menor latencia desde Sudamérica que otras regiones de EE.UU.
- Alternativa: **sa-east-1** (São Paulo) si necesitas datos en Sudamérica, pero servicios son más limitados y caros

### Costo
- Cuenta: $0
- Costos de infraestructura: ver abajo

### Tiempo
- 15-30 minutos

---

## 2.2 Configurar IAM + Access Keys

### Qué es
Crear usuarios, roles y políticas de acceso en AWS Identity and Access Management.

### Usuarios a crear

| Usuario | Propósito | Permisos |
|---------|-----------|----------|
| `tiza-admin` | Tu cuenta personal (consola) | AdministratorAccess |
| `tiza-terraform` | IaC / CI/CD | S3, RDS, SQS, Lambda, ECS, KMS, Route53, ACM, CloudFront, WAF |
| `tiza-api` | Backend FastAPI | S3 (lectura/escritura), SQS, KMS (decrypt), RDS |
| `tiza-scanner` | SFTP del escáner | S3 (solo escritura a bucket específico) |

### Reglas de seguridad
- **NUNCA** uses la cuenta root para operaciones diarias
- Activar MFA en todas las cuentas (root + admin)
- Access keys rotarlas cada 90 días
- Permisos de mínimo privilegio: cada servicio solo accede a lo que necesita
- El usuario `tiza-scanner` solo puede hacer `s3:PutObject` en el bucket de evaluaciones

### Política IAM mínima para `tiza-api`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::tiza-evaluaciones-*",
        "arn:aws:s3:::tiza-reportes-*",
        "arn:aws:s3:::tiza-crops-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage"
      ],
      "Resource": "arn:aws:sqs:us-east-1:*:tiza-processing-queue"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:*:key/*"
    }
  ]
}
```

### Costo
- IAM: $0
- MFA device físico (opcional): $20 USD (YubiKey)

### Tiempo
- 1 hora

---

## 2.3 Comprar Dominios

### Qué necesitas

| Dominio | Uso | Registrador |
|---------|-----|-------------|
| `tiza.app` | App para profesores + subdominios wildcard | Namecheap, Google Domains, o NIC Chile |
| `relevo.cl` | Portal corporativo + subdominios wildcard | NIC Chile (obligatorio para .cl) |

### Dónde comprar
- **tiza.app**: [Namecheap](https://namecheap.com) (~$15-20 USD/año) — .app requiere SSL
- **relevo.cl**: [NIC Chile](https://nic.cl) (~$15-20 USD/año) — solo se puede comprar en NIC Chile

### Configuración necesaria
- Ambos dominios deben apuntar a Route53 (NS records)
- Wildcard subdomain `*.tiza.app` → CloudFront → Next.js
- Wildcard subdomain `*.relevo.cl` → CloudFront → Next.js
- Subdominio `api.tiza.app` → API Gateway / ALB → FastAPI

### Verificación
- Verificar que `colegio-prueba.tiza.app` resuelve correctamente
- Verificar que `colegio-prueba.relevo.cl` resuelve correctamente

### Por qué es BLOQUEANTE
- La arquitectura entera se basa en subdominios wildcard para resolución de tenant
- Los certificados SSL necesitan los dominios verificados
- NextAuth requiere URL canónica (no localhost en staging/prod)

---

## 2.4 Configurar Route53 (DNS)

### Qué es
Servicio DNS de AWS. Necesitas crear hosted zones y configurar registros.

### Hosted Zones a crear

```
tiza.app → NS records → apuntar a Namecheap
relevo.cl → NS records → apuntar a NIC Chile
```

### Registros DNS necesarios

| Tipo | Nombre | Valor | Propósito |
|------|--------|-------|-----------|
| A | `tiza.app` | CloudFront distribution | Landing page TIZA |
| A | `*.tiza.app` | CloudFront distribution | Subdominios de colegios |
| A | `relevo.cl` | CloudFront distribution | Landing page RELEVO |
| A | `*.relevo.cl` | CloudFront distribution | Subdominios de colegios |
| CNAME | `api.tiza.app` | API Gateway / ALB | Backend FastAPI |
| MX | `tiza.app` | Resend/SendGrid | Email transaccional |
| MX | `relevo.cl` | Resend/SendGrid | Email transaccional |
| TXT | `tiza.app` | SPF + DKIM + DMARC | Autenticación email |
| TXT | `relevo.cl` | SPF + DKIM + DMARC | Autenticación email |

### Costo
- Route53 Hosted Zone: $0.50/mes por dominio
- **Total**: ~$1 USD/mes

### Tiempo
- 1-2 horas (más 24-48h de propagación DNS)

---

## 2.5 Obtener Certificados SSL (ACM)

### Qué es
AWS Certificate Manager. Necesitas certificados SSL/TLS para servir las apps con HTTPS.

### Certificados necesarios

| Dominio | Tipo | Validación |
|---------|------|------------|
| `*.tiza.app` | Wildcard | DNS (CNAME en Route53) |
| `tiza.app` | Exact | DNS |
| `*.relevo.cl` | Wildcard | DNS |
| `relevo.cl` | Exact | DNS |
| `api.tiza.app` | Exact | DNS |

### Proceso
1. Ir a AWS Console → Certificate Manager → Request certificate
2. Solicitar certificado público
3. Agregar nombres de dominio (incluir wildcard y exact)
4. Elegir validación DNS
5. Crear registros CNAME en Route53 (ACM lo hace automáticamente si usas Route53)
6. Esperar validación (5-30 minutos)

### Regionalidad
- Certificados para CloudFront DEBEN estar en `us-east-1`
- Certificados para ALB/API Gateway en la región donde despliegues

### Costo
- ACM: **gratuito** (solo pagas por el recurso que usa el certificado)

### Tiempo
- 30 minutos (más validación DNS)

---

## 2.6 Configurar AWS KMS (Claves de Cifrado)

### Qué es
AWS Key Management Service. Necesitas claves maestras para cifrar datos sensibles en PostgreSQL (pgcrypto) y en S3 (SSE-KMS).

### Claves a crear

| Key Alias | Propósito | Rotación |
|-----------|-----------|----------|
| `tiza-db-encryption` | Cifrar columnas sensibles en PostgreSQL (RUT, nombres) | Anual |
| `tiza-s3-encryption` | Cifrar objetos en S3 (evaluaciones, reportes) | Anual |
| `tiza-jwt-signing` | Firmar tokens JWT (opcional, HS256 no requiere KMS) | Trimestral |

### Política de key mínima

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789:role/tiza-api-role"
      },
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "*"
    }
  ]
}
```

### Costo
- KMS Customer Managed Key: $1 USD/mes por key
- Operaciones criptográficas: $0.03 por 10,000 requests
- **Total**: ~$5-15 USD/mes

### Por qué es BLOQUEANTE
- pgcrypto necesita una key externa para no almacenar la clave en la misma DB
- S3 con SSE-KMS es requisito para compliance (Ley 19.628)
- Sin KMS, los datos "cifrados" son un chiste (la key está en la DB)

---

## 2.7 Solicitar Límites de Servicio

### Qué es
AWS tiene límites por defecto en cuentas nuevas. Para producción necesitas solicitar aumentos.

### Límites a revisar/solicitar

| Servicio | Límite por defecto | Necesitas | Cuándo |
|----------|-------------------|-----------|--------|
| EC2 vCPUs (GPU) | 0 (las GPU requieren solicitud) | 4-8 vCPUs | Antes de Mes 3 |
| RDS Storage | 100 GB | 500 GB | Antes de producción |
| SQS Messages | Ilimitado (throttling inicial) | N/A | Monitorear |
| S3 Buckets | 100 | ~10 | Suficiente |
| Lambda Concurrent | 1,000 | N/A | Si usas serverless |

### Proceso
1. AWS Console → Service Quotas
2. Buscar el servicio → Request increase
3. Justificar uso (ej. "GPU instances for ML inference on educational data")
4. Esperar aprobación (1-3 días para GPU, inmediato para storage)

---

## 📊 Costos Mensuales Estimados (Desarrollo)

| Servicio | Costo |
|----------|-------|
| Route53 (2 zonas) | $1 USD |
| KMS (3 claves) | $3 USD |
| RDS db.t4g.micro (1 instancia) | $15 USD |
| S3 (100 GB + operaciones) | $3 USD |
| SQS (10K mensajes) | $0 |
| CloudFront (1 TB) | $85 USD |
| **Total mensual dev** | **~$107 USD** |

> ⚠️ **AWS Free Tier** cubre la mayoría de esto los primeros 12 meses si es cuenta nueva. Aprovéchalo.

---

*"La nube no es magia. Es el computador de alguien más. Y ese alguien te cobra por minuto."* — Bulma (CTO)
