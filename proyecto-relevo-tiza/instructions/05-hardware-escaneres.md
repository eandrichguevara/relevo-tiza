# 05 — Hardware (Escáneres)

> **Tiempo estimado**: 2-4 semanas (selección, compra, importación, testing)
> **Costo estimado**: $2-5M CLP (5-10 escáneres para piloto)
> **Bloqueante**: 🔴 SÍ — El escáner es el puente físico entre la prueba en papel y la IA. Sin escáner no hay producto.

---

## 5.1 Seleccionar Modelo de Escáner

### Requisitos del escáner

| Requisito | Especificación | Por qué |
|-----------|---------------|---------|
| **Velocidad** | ≥40 ppm (páginas por minuto) | Un profesor con 40 alumnos × 4 páginas = 160 páginas. No puede tardar 20 min. |
| **Dúplex** | Automático (doble cara) | Las pruebas pueden imprimirse a doble cara |
| **Alimentador** | ADF ≥50 hojas | Para no estar metiendo hojas de 5 en 5 |
| **Resolución** | ≥300 DPI | La IA necesita ver con claridad letra manuscrita |
| **Conectividad** | Ethernet + WiFi | SFTP requiere red. WiFi para flexibilidad de ubicación. |
| **Formato** | A4 + Carta | Estándar en colegios chilenos |
| **SFTP/Email** | Escaneo a SFTP/SMB/Email nativo | El escáner envía directo a S3 sin PC intermediaria |
| **Durabilidad** | Ciclo de trabajo ≥3,000 páginas/día | 1 colegio = ~2,000 páginas/día en época de pruebas |
| **Tamaño** | Compacto (escritorio) | La sala de profesores no es una bodega |

### Modelos recomendados

| Modelo | Precio (USD) | ppm | ADF | SFTP | Ciclo diario |
|--------|-------------|-----|-----|------|-------------|
| **Fujitsu fi-7160** | ~$800 | 60 | 80 hojas | ✅ | 4,000 |
| **Fujitsu fi-7180** | ~$1,200 | 80 | 80 hojas | ✅ | 6,000 |
| **Epson DS-870** | ~$600 | 65 | 100 hojas | ✅ (con software) | 7,000 |
| **Brother ADS-2700W** | ~$450 | 35 | 50 hojas | ✅ | 3,000 |
| **Canon DR-M160II** | ~$700 | 60 | 60 hojas | ✅ | 5,000 |

### Recomendación para piloto
- **Opción A (económica)**: Brother ADS-2700W — $450 USD, cumple con lo mínimo, fácil de conseguir
- **Opción B (recomendada)**: Fujitsu fi-7160 — $800 USD, balance velocidad/durabilidad/precio
- **Opción C (premium)**: Epson DS-870 — $600 USD, excelente relación calidad/precio

### Dónde comprar
- **Chile**: PC Factory, MercadoLibre, distribuidores Fujitsu/Epson Chile
- **Importación**: Amazon US + casilla Miami → Chile (más barato pero sin garantía local)
- **Recomendado**: Comprar en Chile los primeros 5 (garantía y soporte local), luego importar al por mayor

---

## 5.2 Comprar Escáneres para Piloto

### Cantidad
- 5 colegios × 1 escáner = 5 escáneres
- + 2 escáneres de backup (por si falla uno) = 7 escáneres
- + 1 escáner para desarrollo/testing = 8 escáneres

### Presupuesto

| Concepto | Unitario | Cantidad | Total |
|----------|----------|----------|-------|
| Fujitsu fi-7160 | $800 USD | 8 | $6,400 USD |
| Envío/aduana | ~$150 USD | 8 | $1,200 USD |
| Cables Ethernet | $10 USD | 8 | $80 USD |
| **Total** | | | **~$7,680 USD** (~$7.7M CLP) |

### Alternativa: Leasing operativo
- Arrendar escáneres en vez de comprar
- Ventaja: menor inversión inicial, renovación tecnológica cada 2-3 años
- Empresas en Chile: Ricoh, Konica Minolta, Xerox
- Costo: ~$30-50 USD/mes por escáner × 36 meses = ~$1,800 USD total/escáner
- **NO recomendado para piloto** (más caro a largo plazo, mejor comprar)

---

## 5.3 Probar Flujo: Escáner → SFTP → S3

### Qué es
Configurar y probar el flujo completo de digitalización ANTES de instalar en los colegios.

### Setup de prueba
1. Conectar escáner a tu red local (Ethernet o WiFi)
2. Configurar perfil de escaneo:
   - Destino: SFTP
   - Servidor: `sftp.tiza.app` (AWS Transfer Family)
   - Puerto: 22
   - Auth: Key pair (generada en AWS)
   - Formato: PDF multipágina, 300 DPI, color
   - Nombre de archivo: `{timestamp}_{scanner_id}.pdf`
3. Escanear 10 pruebas de ejemplo
4. Verificar que los PDFs aparecen en S3
5. Verificar calidad de imagen (legibilidad, orientación, contraste)

### Check-list de calidad de escaneo

| Prueba | Resultado esperado |
|--------|-------------------|
| Texto impreso legible | ✅ 100% legible |
| Texto manuscrito con lápiz grafito | ✅ >95% legible |
| Texto manuscrito con lápiz pasta azul | ✅ >90% legible |
| Márgenes correctos (sin cortar) | ✅ Toda la página visible |
| Códigos QR legibles por ZBar | ✅ 100% detección |
| PDF multipágina (40 hojas) | ✅ Un solo archivo |
| Doble cara automático | ✅ Ambas caras, en orden |
| Papel arrugado/doblado | ✅ Se escanea sin atascar |
| Hojas de diferentes tamaños mezcladas | ✅ ADF las maneja |

### Configuración de AWS Transfer Family (SFTP)

```bash
# 1. Crear servidor SFTP
aws transfer create-server \
  --protocols SFTP \
  --identity-provider-type SERVICE_MANAGED \
  --domain S3

# 2. Crear usuario para el escáner
aws transfer create-user \
  --server-id s-1234567890abcdef \
  --user-name scanner-colegio-01 \
  --role arn:aws:iam::123456789:role/tiza-scanner-role \
  --ssh-public-key-body file://scanner-key.pub

# 3. Asignar bucket S3 como home directory
# El usuario solo puede escribir en s3://tiza-evaluaciones-dev/colegio-01/
```

### ⚠️ Problemas comunes y soluciones

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| PDFs no llegan a S3 | Firewall del colegio bloquea SFTP | Usar puerto 22 (estándar) o 2222 si bloqueado. O usar AWS Transfer en puerto 443 |
| Escaneo borroso | Resolución muy baja | Subir a 300 DPI mínimo |
| Hojas atascadas | Papel muy delgado o doblado | Usar papel bond 75g mínimo. Pedir que los alumnos NO doblen las pruebas |
| QR no se lee | Impresora de baja calidad | Usar impresora láser. QR de tamaño ≥2cm |
| Escáner no prende después de mudanza | Golpe en transporte | Embalar con espuma. Probar antes de instalar. Tener backup. |

---

## 5.4 Documentar Setup Físico por Colegio

### Entregable
Un manual de 1 página con instrucciones visuales para instalar el escáner en la sala de profesores.

### Contenido del manual

```
┌─────────────────────────────────────────────────────────────┐
│              TIZA — Guía de Instalación del Escáner          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. UBICAR                                                 │
│     - Mesa plana cerca de un enchufe                        │
│     - Cerca del router WiFi o punto de red                  │
│     - Lejos de ventanas (sol directo daña el escáner)       │
│                                                              │
│  2. CONECTAR                                                │
│     [Foto del cable de poder] → enchufe                      │
│     [Foto del cable Ethernet] → router                       │
│                                                              │
│  3. ENCENDER                                                │
│     - Botón POWER en panel frontal                          │
│     - Esperar 30 segundos a que inicialice                  │
│                                                              │
│  4. ESCANEAR                                                │
│     - Poner pruebas en el alimentador (boca abajo)          │
│     - Presionar botón SCAN (es el único botón azul)         │
│     - Las pruebas se envían automáticamente a TIZA          │
│                                                              │
│  5. VERIFICAR                                               │
│     - Abrir app TIZA en tu celular                          │
│     - Tus pruebas deberían aparecer en "Evaluaciones"       │
│     - Si no aparecen en 5 minutos, llamar a soporte         │
│                                                              │
│  SOPORTE: +56 9 XXXX XXXX (WhatsApp)                        │
│  "Profe, ¿problemas con el escáner? Mándanos un WhatsApp"   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Resumen de Hardware

| Métrica | Target |
|---------|--------|
| Escáneres para piloto | 7-8 |
| Costo total hardware | ~$8M CLP |
| Tasa de éxito de escaneo | >99% |
| Tiempo de setup por colegio | <30 minutos |
| Tiempo de envío a S3 | <10 segundos después de escanear |
| Backup escáneres | 2 (1 por cada 3 colegios) |

---

*"El mejor software del mundo no sirve de nada si el escáner no prende. Hardware first, software second."* — Bulma (CTO)
