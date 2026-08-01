import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvaluationPreviewModal, PreviewEvaluationItem } from '../EvaluationPreviewModal';

vi.mock('@tiza/ui', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Eye: () => <span>[Eye]</span>,
  Printer: () => <span>[Printer]</span>,
  X: () => <span>[X]</span>,
  FileText: () => <span>[FileText]</span>,
  CheckCircle2: () => <span>[CheckCircle2]</span>,
  HelpCircle: () => <span>[HelpCircle]</span>,
}));

const mockItems: PreviewEvaluationItem[] = [
  {
    id: 'sec-1',
    item_type: 'info_section',
    section_title: 'Lectura Inicial',
    section_content: 'Lee con atención el siguiente texto.',
  },
  {
    id: 'div-1',
    item_type: 'divider',
    section_title: 'Sección I: Selección Múltiple',
  },
  {
    id: 'q-1',
    item_type: 'question',
    question_number: 1,
    statement: '¿Cuál es la capital de Chile?',
    type: 'multiple_choice',
    max_score: 2,
    alternatives: [
      { label: 'A', text: 'Santiago', is_correct: true },
      { label: 'B', text: 'Valparaíso', is_correct: false },
    ],
  },
  {
    id: 'q-2',
    item_type: 'question',
    question_number: 2,
    statement: 'Explica el concepto de ecosistema.',
    type: 'written',
    criteria: [
      {
        name: 'Dominio de contenidos',
        levels: [
          { points: 3, description: 'Excelente explicación' },
          { points: 1, description: 'Explicación parcial' },
        ],
      },
    ],
  },
];

describe('EvaluationPreviewModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Evaluación de Ciencias',
    subject: 'Ciencias Naturales',
    grade: '5° Básico',
    items: mockItems,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza nada si isOpen es false', () => {
    const { container } = render(<EvaluationPreviewModal {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza el título, asignatura, nivel y puntaje ideal correctamente', () => {
    render(<EvaluationPreviewModal {...defaultProps} />);

    expect(screen.getByText('Vista previa de evaluación')).toBeInTheDocument();
    expect(screen.getByText(/Evaluación de Ciencias/i)).toBeInTheDocument();
    expect(screen.getByText(/Ciencias Naturales — 5° Básico/)).toBeInTheDocument();
    // Puntaje ideal: Q1 (2 pts) + Q2 (3 pts) = 5 pts
    expect(screen.getByText('5 pts')).toBeInTheDocument();
  });

  it('renderiza secciones informativas, divisores y preguntas', () => {
    render(<EvaluationPreviewModal {...defaultProps} />);

    expect(screen.getByText('Lectura Inicial')).toBeInTheDocument();
    expect(screen.getByText('Lee con atención el siguiente texto.')).toBeInTheDocument();
    expect(screen.getByText(/Sección I: Selección Múltiple/i)).toBeInTheDocument();


    expect(screen.getByText('¿Cuál es la capital de Chile?')).toBeInTheDocument();
    expect(screen.getByText('Santiago')).toBeInTheDocument();
    expect(screen.getByText('Valparaíso')).toBeInTheDocument();

    expect(screen.getByText('Explica el concepto de ecosistema.')).toBeInTheDocument();
  });

  it('permite conmutar entre Vista Estudiante, Pauta Profesor y Hoja de Respuestas', async () => {
    render(<EvaluationPreviewModal {...defaultProps} />);

    // Por defecto es Vista Estudiante, no se muestra "Modo Pauta de Corrección" ni la Hoja de Respuestas
    expect(screen.queryByText(/Modo Pauta de Corrección/)).not.toBeInTheDocument();
    expect(screen.queryByText('Dominio de contenidos')).not.toBeInTheDocument();
    expect(screen.queryByText('HOJA DE RESPUESTAS')).not.toBeInTheDocument();

    // Cambiar a Pauta Profesor
    const teacherBtn = screen.getByText('Pauta Profesor');
    await userEvent.click(teacherBtn);

    expect(screen.getByText(/Modo Pauta de Corrección/)).toBeInTheDocument();
    expect(screen.getByText('Correcta')).toBeInTheDocument(); // Badge en alternativa A
    expect(screen.getByText(/Dominio de contenidos/)).toBeInTheDocument();
    expect(screen.getByText('Excelente explicación')).toBeInTheDocument();

    // Cambiar a Hoja de Respuestas
    const answerSheetBtn = screen.getByText('Hoja de Respuestas');
    await userEvent.click(answerSheetBtn);

    expect(screen.getByText('HOJA DE RESPUESTAS')).toBeInTheDocument();
    expect(screen.getByText(/Instrucciones generales:/)).toBeInTheDocument();
    expect(screen.getByTestId('answer-block-1')).toBeInTheDocument();
    expect(screen.getByTestId('answer-block-2')).toBeInTheDocument();
    expect(screen.queryByText(/400x400/)).not.toBeInTheDocument();
  });

  it('llama a window.print al presionar Imprimir', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<EvaluationPreviewModal {...defaultProps} />);

    const printBtn = screen.getByText(/Imprimir \/ PDF/);
    await userEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
  });

  it('llama a onClose al hacer clic en el botón de cerrar X', async () => {
    render(<EvaluationPreviewModal {...defaultProps} />);

    const closeBtn = screen.getByLabelText('Cerrar previsualización');
    await userEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
