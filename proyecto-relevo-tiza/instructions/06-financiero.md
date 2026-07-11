# 06 — Financiero

> **Tiempo estimado**: 2-4 semanas
> **Costo estimado**: $0-2M CLP (setup inicial)
> **Bloqueante**: 🔴 Parcial — Cuenta bancaria es BLOQUEANTE. Pricing y modelos pueden esperar al piloto.

---

## 6.1 Abrir Cuenta Bancaria Empresarial

### Qué es
Cuenta corriente o cuenta vista a nombre de Relevo SpA para operar financieramente.

### Requisitos (Chile)
- Escritura de constitución de la SpA
- RUT de la empresa
- Cédula de identidad del representante legal
- Inicio de actividades en SII
- Comprobante de domicilio comercial

### Bancos recomendados para startups
| Banco | Cuenta | Costo mensual | Ventaja |
|-------|--------|---------------|---------|
| **BancoEstado** | Cuenta RUT Empresa | $0 | Sin costo, pero límites bajos |
| **BCI** | Cuenta Corriente Digital | ~$15,000 CLP | Buena app, atención startups |
| **Santander** | Cuenta Corriente Life | ~$20,000 CLP | Integraciones, API |
| **Itaú** | Cuenta Digital Empresas | ~$10,000 CLP | Buen programa startup |
| **Mach** (BCI) | Cuenta Vista | $0 | 100% digital, rápida apertura |

### Recomendación
1. Abrir **Mach Empresas** o **BancoEstado Cuenta RUT** para empezar (rápido, sin costo)
2. Migrar a **BCI** o **Santander** cuando empieces a recibir pagos de colegios ($3-5K USD/mes)

### También necesitas
- Tarjeta de crédito empresarial (para pagar AWS, APIs, suscripciones)
- Si no calificas para crédito empresarial, usa tarjeta de crédito personal y reembólsate

---

## 6.2 Configurar Stripe Connect (Chile)

### Qué es
Activar Stripe para recibir pagos de colegios en CLP y USD.

### Estado de Stripe en Chile (2026)
- Stripe está disponible en Chile (lanzó en 2024)
- Soporta CLP y USD
- Métodos de pago: tarjeta de crédito/débito, Webpay (próximamente), transferencia
- Liquidación a cuenta bancaria chilena
- 2.9% + $0.30 por transacción

### Paso a paso
1. Completar perfil de negocio en Stripe (RUT empresa, datos legales)
2. Verificar identidad del representante legal
3. Conectar cuenta bancaria para recibir pagos
4. Configurar suscripciones recurrentes (anuales)
5. Configurar facturación electrónica (Stripe Tax o integración con SII)

### Para el piloto
- **NO necesitas Stripe en vivo para el piloto** (es gratuito)
- Pero sí necesitas la cuenta creada y testeada
- Usar Stripe Test Mode para desarrollo

---

## 6.3 Definir Precios Finales (Pricing Tiers)

### Estructura de precios propuesta

| Plan | Estudiantes | Precio/año | Qué incluye |
|------|-------------|------------|-------------|
| **RELEVO Light** | < 300 | $3,000 USD | Escáner + TIZA para todos los profesores + Dashboard básico |
| **RELEVO Pro** | 300-800 | $4,000 USD | Light + Analytics avanzados + Soporte prioritario |
| **RELEVO Enterprise** | 800+ | $5,000 USD | Pro + Múltiples colegios (holding) + Marca blanca + API |

### Decisiones que debes tomar ANTES de desarrollar

1. **¿Facturación mensual o anual?**
   - Recomendado: Anual (mejor cash flow, menor churn)
   - Opción: Mensual con 20% recargo

2. **¿Precio en CLP o USD?**
   - Recomendado: USD (protege contra inflación chilena)
   - Pero ofrecer conversión a CLP al tipo de cambio del día

3. **¿Descuento por múltiples colegios?**
   - Holding con 3+ colegios: 10-20% descuento
   - Esto requiere feature flag `multiSchool: true`

4. **¿Cobrar por profesor extra?**
   - NO recomendado. Va contra la propuesta de valor ("todos los profesores, sin límite")
   - El pricing por estudiante es más justo y predecible

5. **¿Setup fee?**
   - $500 USD one-time (cubre instalación de escáner + onboarding)
   - Se puede waivear para pilotos o como incentivo de venta

### Qué necesita saber Stripe de estos precios
- Product ID + Price ID para cada tier
- Estas variables van en las variables de entorno:
  ```
  STRIPE_PRICE_LIGHT=price_xxx
  STRIPE_PRICE_PRO=price_xxx
  STRIPE_PRICE_ENTERPRISE=price_xxx
  ```

---

## 6.4 Preparar Modelo Financiero (3 Años)

### Qué es
Spreadsheet con proyecciones financieras que usarás para levantar capital.

### Debe incluir

#### Hoja 1: Revenue Model
| | Year 1 | Year 2 | Year 3 |
|---|--------|--------|--------|
| Colegios | 80 | 300 | 800 |
| ARR | $400K | $1.5M | $4M |
| Crecimiento | — | 275% | 167% |

#### Hoja 2: Costos
| Concepto | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
| Infraestructura (AWS) | $20K | $60K | $150K |
| Gemini API | $2K | $10K | $30K |
| Escáneres (amortizados) | $8K | $30K | $80K |
| Equipo (salarios) | $150K | $400K | $1.2M |
| Legal + seguros | $60K | $80K | $100K |
| Marketing | $30K | $100K | $250K |

#### Hoja 3: Unit Economics
- CAC (Customer Acquisition Cost): $2,000
- LTV (Lifetime Value): $15,000 (3 años × $5K)
- LTV/CAC: 7.5x
- Gross margin: 85-90%
- Payback period: <12 meses

#### Hoja 4: Cash Flow
- Burn rate mensual
- Runway (meses de caja disponible)
- Meses hasta break-even

### Herramientas
- Google Sheets / Excel
- Plantillas: [SaaS Financial Model](https://www.saastr.com/saastr-financial-model/) de SaaStr

---

## 6.5 Cotizar y Contratar Seguros

### Seguros necesarios

| Seguro | Cobertura | Costo anual |
|--------|-----------|-------------|
| **RC Profesional** | Errores de software, fuga de datos, infracción IP, defensa legal | $8-12M CLP |
| **Cyber Insurance** | Incidentes de ciberseguridad, ransomware, notificación a afectados | $5-10M CLP |
| **Seguro de equipos** | Robo/daño de escáneres en colegios | $1-2M CLP |

### Cómo cotizar
1. Contactar corredor de seguros (ej. Marsh, Aon, Sura)
2. Entregar descripción del negocio (SaaS educativo, IA, datos de menores)
3. Especificar coberturas necesarias
4. Comparar 3 cotizaciones
5. Elegir y contratar

### Documentos que te pedirán
- Escritura de constitución
- Descripción del servicio
- Medidas de seguridad implementadas
- Volumen estimado de datos procesados

---

## 📊 Resumen Financiero

| Métrica | Target Year 1 |
|---------|---------------|
| ARR | $400K USD |
| Gross Margin | >85% |
| Burn Rate | ~$50K/mes |
| Runway post-Seed | 18 meses |
| CAC Payback | <12 meses |
| Cuenta bancaria | Abierta ✅ |
| Stripe configurado | Test ✅ |

---

*"El revenue es vanidad, el profit es sanidad, pero el cash es realidad."* — Tyrion Lannister
