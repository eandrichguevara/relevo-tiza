# Estrategia de IA (LLM) — Pipeline Híbrido

## Problema Crítico

El sistema debe leer **texto manuscrito por niños** en evaluaciones. Esta es una tarea extremadamente difícil porque:
- Letra variable e inconsistente
- Inversiones de letras (b ↔ d)
- Letras espejo
- Ortografía fonética
- Dibujos mezclados con texto

**Hallazgo clave**: Los modelos open-source generalistas NO alcanzan la calidad de Gemini 2.5 Pro en esta tarea específica.

---

## Benchmarks de Rendimiento (CER = Character Error Rate, menor es mejor)

| Modelo | CER en letra de niños | Tipo | Notas |
|--------|----------------------|------|-------|
| **E-TrOCR (especializado)** | **7.36%** | Open-source | Fine-tuned en 1,800 líneas de niños |
| **Gemini 2.5 Pro** | ~8-10% | API cerrada | Mejor rendimiento general |
| **GPT-4** | 12.62% | API cerrada | Buen rendimiento |
| **Qwen2.5-VL-72B** | ~12-15% | Open-source | Mejor VL open-source, pero no especializado |
| **TrOCR base** | 20.68% | Open-source | Mal rendimiento en niños |

**Conclusión**: Ningún modelo open-source generalista iguala a Gemini 2.5 Pro en letra de niños sin fine-tuning especializado.

---

## Opción Recomendada: Pipeline Híbrido

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE RECOMENDADO                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Imagen → Preprocesado → OCR Ensemble → LLM Comprensión         │
│           (deskew,              (TrOCR-hand +                  │
│            denoise,             TrOCR-print +                   │
│             binarize)            EasyOCR)                       │
│                    ↓              ↓                              │
│              Consensus Voting → FLAN-T5 Refine                  │
│                    ↓              ↓                              │
│              Texto limpio → LLM (Qwen2.5-7B / Llama 3.3 70B)   │
│                                  para:                          │
│                                  - Corrección ortográfica       │
│                                  - Extracción estructura        │
│                                  - Análisis semántico           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes

#### 1. OCR Ensemble (Local)
- **TrOCR-large-hand**: Especializado en letra manuscrita
- **TrOCR-large-print**: Especializado en letra impresa
- **EasyOCR**: Backup multilingüe
- **Consenso**: Votación por consenso, threshold 0.65

#### 2. LLM de Comprensión (Local o API)
- **Opción A (Local)**: Qwen2.5-7B-Instruct INT4 (3.3 GB VRAM)
- **Opción B (API)**: Gemini Flash (más barato que Pro)
- **Fallback**: Gemini 2.5 Pro solo cuando confianza < 0.65

#### 3. Refinamiento (Local)
- **FLAN-T5-small**: Corrección ortográfica, estructuración

### Costos

| Componente | Costo Mensual | Notas |
|------------|---------------|-------|
| GPU (1× RTX 3090) | ~$40-60/mes | Amortizado 3 años |
| Electricidad | ~$10-20/mes | |
| Fallback API (10% del tráfico) | ~$5-10/mes | Gemini Flash |
| **Total** | **~$55-90/mes** | vs $120/mes API pura |

### Ventajas
- Imágenes nunca salen de tu infraestructura (cumple Ley 19.628)
- Costo 50-60% menor que API pura
- Control total del pipeline
- Posibilidad de fine-tuning con datos chilenos

### Desventajas
- Calidad ~85-90% de Gemini 2.5 Pro
- Requiere mantenimiento de múltiples modelos
- Complejidad operativa mayor

---

## Roadmap de IA

### Fase 1: Pipeline Híbrido (Meses 1-3)
**Objetivo**: Deployar pipeline básico con calidad aceptable

**Acciones**:
1. Deployar FusionOCR (TrOCR-hand + TrOCR-print + EasyOCR) en 1× RTX 3090
2. Conectar con Qwen2.5-7B INT4 (local) para comprensión
3. Fallback a Gemini Flash API cuando confianza < 0.65
4. Medir CER en 100 evaluaciones reales
5. **Target**: CER < 15% (vs 8-10% de Gemini 2.5 Pro)

**Criterios de éxito**:
- CER < 15% en letra de niños
- Latencia < 30 segundos por evaluación
- Costo < $100/mes para 10K evaluaciones

### Fase 2: Fine-tuning Especializado (Meses 4-9)
**Objetivo**: Superar Gemini 2.5 Pro en contexto chileno

**Acciones**:
1. Construir dataset de correcciones (cada corrección del profesor = dato de entrenamiento)
2. Fine-tunar E-TrOCR con 1,800+ muestras de letra infantil chilena
3. Target: CER < 7% (mejor que Gemini 2.5 Pro)
4. Validar con A/B test en 5 colegios piloto

**Criterios de éxito**:
- CER < 7% en letra de niños chilenos
- Teacher override rate < 5%
- NPS profesor > 40

### Fase 3: Destilación de Conocimiento (Meses 10-18)
**Objetivo**: Modelo propio de alta calidad, costo mínimo

**Acciones**:
1. Destilar conocimiento de Gemini 2.5 Pro en Qwen2.5-VL-7B
2. Usar dataset propietario de letra infantil chilena
3. Self-hosted 100%, calidad frontier, costo $40/mes
4. **Moat**: Dataset propietario + modelo especializado

**Criterios de éxito**:
- Calidad comparable a Gemini 2.5 Pro (CER < 8%)
- Costo < $50/mes para 10K evaluaciones
- 100% datos en Chile (cumplimiento total Ley 19.628)

---

## Alternativas Consideradas

### Opción A: API Pura (Gemini 2.5 Pro)
- **Costo**: ~$120/mes (10K evaluaciones)
- **Calidad**: 100% (mejor en letra de niños)
- **Riesgo**: Imágenes salen a EE.UU. (requiere DPIA + SCC + consentimiento específico)
- **Dependencia**: 100% de Google

**Veredicto**: ❌ No viable a largo plazo por riesgos legales y dependencia

### Opción B: Self-Hosted con Qwen2.5-VL-72B
- **Hardware**: 2× A100 40GB (33 GB VRAM en INT4)
- **Costo**: ~$2,500-3,500/mes (cloud) o ~$150-200/mes (propio amortizado)
- **Calidad**: ~85-90% de Gemini 2.5 Pro
- **Ventaja**: Control total, datos en Chile

**Veredicto**: ⚠️ Viable solo si tienes equipo MLOps senior y volumen >50K evaluaciones/mes

### Opción C: Pipeline Híbrido (Recomendada)
- **Costo**: ~$55-90/mes
- **Calidad**: ~85-90% de Gemini 2.5 Pro
- **Ventaja**: Imágenes locales, costo bajo, fine-tunable

**Veredicto**: ✅ Mejor opción para etapa actual

---

## Modelos Open-Source Evaluados

### Qwen2.5-VL-72B-Instruct
- **VRAM**: 33 GB (INT4)
- **Calidad**: Mejor VL open-source (MMMU 70.2, DocVQA 96.1)
- **Problema**: No especializado en letra de niños
- **Uso**: Solo si tienes 2× A100 y equipo MLOps

### Llama 3.3 70B
- **VRAM**: 33 GB (INT4)
- **Problema**: NO tiene capacidad de visión (text-only)
- **Uso**: Solo para comprensión de texto (después de OCR)

### Llama 3.2 11B/90B Vision
- **VRAM**: 11B = 8 GB, 90B = 180 GB
- **Calidad**: Inferior a Qwen2.5-VL
- **Uso**: No recomendado

### E-TrOCR (Fine-tuned TrOCR)
- **VRAM**: ~3 GB
- **Calidad**: CER 7.36% (mejor que GPT-4 en niños)
- **Requisito**: 1,800+ muestras de letra infantil etiquetadas
- **Uso**: Fase 2 del roadmap

---

## Decisiones Críticas

### ✅ Hacer
- Pipeline híbrido (OCR local + LLM local/API)
- Fine-tuning con datos chilenos (Fase 2)
- Fallback a API solo cuando confianza baja
- Construir dataset propietario de correcciones
- Medir CER en cada iteración

### ❌ No Hacer
- Confiar en un solo modelo open-source generalista
- Enviar todas las imágenes a API externa (riesgo legal)
- Ignorar el fine-tuning especializado
- Subestimar la complejidad de letra de niños
- Lanzar sin validar calidad en 100+ evaluaciones reales

---

## Próximos Pasos Inmediatos

1. **Esta semana**: Deployar FusionOCR + Qwen2.5-7B en 1× RTX 3090
2. **Semana 2**: Probar con 100 evaluaciones reales, medir CER
3. **Semana 3**: Ajustar threshold de confianza (0.65 → ?)
4. **Semana 4**: Implementar fallback a Gemini Flash
5. **Mes 2**: Construir pipeline de dataset (cada corrección = dato)
6. **Mes 3**: Evaluar fine-tuning de E-TrOCR

---

## Métricas de Éxito

| Métrica | Target Fase 1 | Target Fase 2 | Target Fase 3 |
|---------|---------------|---------------|---------------|
| CER (Character Error Rate) | < 15% | < 7% | < 8% |
| Teacher override rate | < 20% | < 5% | < 5% |
| Latencia por evaluación | < 30s | < 20s | < 15s |
| Costo por 10K evaluaciones | < $100 | < $80 | < $50 |
| NPS profesor | > 30 | > 40 | > 50 |

---

## Recursos Técnicos

### Docker Compose (Fase 1)
```yaml
services:
  trocr-hand:
    image: microsoft/trocr-large-handwritten
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
  
  trocr-print:
    image: microsoft/trocr-large-printed
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
  
  qwen-7b:
    image: vllm/vllm-openai:latest
    command: >
      --model Qwen/Qwen2.5-7B-Instruct-AWQ
      --quantization awq
      --max-model-len 8192
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### Código de Ejemplo (OCR Ensemble)
```python
# ocr_ensemble.py
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
import easyocr

class FusionOCR:
    def __init__(self):
        self.processor_hand = TrOCRProcessor.from_pretrained("microsoft/trocr-large-handwritten")
        self.model_hand = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-large-handwritten")
        
        self.processor_print = TrOCRProcessor.from_pretrained("microsoft/trocr-large-printed")
        self.model_print = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-large-printed")
        
        self.reader = easyocr.Reader(['en', 'es'])
    
    def predict(self, image):
        # TrOCR handwritten
        inputs_hand = self.processor_hand(image, return_tensors="pt")
        output_hand = self.model_hand.generate(**inputs_hand)
        text_hand = self.processor_hand.batch_decode(output_hand, skip_special_tokens=True)[0]
        
        # TrOCR printed
        inputs_print = self.processor_print(image, return_tensors="pt")
        output_print = self.model_print.generate(**inputs_print)
        text_print = self.processor_print.batch_decode(output_print, skip_special_tokens=True)[0]
        
        # EasyOCR
        text_easy = self.reader.readtext(image, detail=0)
        text_easy = ' '.join(text_easy)
        
        # Consensus voting
        texts = [text_hand, text_print, text_easy]
        # ... implementar votación por consenso
        
        return best_text, confidence
```
