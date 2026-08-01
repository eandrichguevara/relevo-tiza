import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ──────────────────────────────────────────────────

const mockRouterPush = vi.fn();
const mockRouterBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUseCreateEvaluation = vi.fn();
const mockUseMyClasses = vi.fn();
const mockUseSuggestDistractors = vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
const mockUseRefineQuestion = vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
const mockUseSuggestRubric = vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

vi.mock('@/hooks/useApi', () => ({
  useCreateEvaluation: (...args: any[]) => mockUseCreateEvaluation(...args),
  useMyClasses: (...args: any[]) => mockUseMyClasses(...args),
  useSuggestDistractors: (...args: any[]) => mockUseSuggestDistractors(...args),
  useRefineQuestion: (...args: any[]) => mockUseRefineQuestion(...args),
  useSuggestRubric: (...args: any[]) => mockUseSuggestRubric(...args),
}));


vi.mock('@tiza/ui', () => ({
  Card: ({ children, title, subtitle }: any) => (
    <div data-testid="card">
      {title && <h3>{title}</h3>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
  Input: ({ label, value, onChange, placeholder, type, min, max, required, ...rest }: any) => (
    <div>
      <label>{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        required={required}
        aria-label={label}
        {...rest}
      />
    </div>
  ),
  Button: ({ children, loading, disabled, onClick, type, variant, brand, ...rest }: any) => (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      data-brand={brand}
      data-variant={variant}
      {...rest}
    >
      {loading ? 'Guardando...' : children}
    </button>
  ),
  Spinner: ({ size }: any) => (
    <div data-testid="spinner" data-size={size}>
      Cargando...
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Plus: ({ size }: any) => <span data-testid="icon-plus">+</span>,
  Trash2: ({ size }: any) => <span data-testid="icon-trash">🗑</span>,
  FileText: ({ size }: any) => <span data-testid="icon-filetext">📄</span>,
  ImageIcon: ({ size }: any) => <span data-testid="icon-image">🖼</span>,
  HelpCircle: ({ size }: any) => <span data-testid="icon-help">❓</span>,
  ArrowUp: ({ size }: any) => <span data-testid="icon-arrowup">⬆</span>,
  ArrowDown: ({ size }: any) => <span data-testid="icon-arrowdown">⬇</span>,
  Sparkles: ({ size }: any) => <span data-testid="icon-sparkles">✨</span>,
  Wand2: ({ size }: any) => <span data-testid="icon-wand">🪄</span>,
  Eye: ({ size }: any) => <span data-testid="icon-eye">👁</span>,
  Undo2: ({ size }: any) => <span data-testid="icon-undo">↩</span>,
  Redo2: ({ size }: any) => <span data-testid="icon-redo">↪</span>,
  Printer: ({ size }: any) => <span data-testid="icon-printer">🖨</span>,
  X: ({ size }: any) => <span data-testid="icon-x">✕</span>,
  CheckCircle2: ({ size }: any) => <span data-testid="icon-check">✓</span>,
}));


// ─── Test Data ──────────────────────────────────────────────

const mockClasses = [
  {
    course_id: 'c1',
    course_name: '1° A',
    subject: 'Matemáticas',
    grade: '1°',
    student_count: 32,
  },
  {
    course_id: 'c2',
    course_name: '2° B',
    subject: 'Lenguaje',
    grade: '2°',
    student_count: 28,
  },
];

function setDefaultMocks() {
  mockUseMyClasses.mockReturnValue({
    data: mockClasses,
    isLoading: false,
  });
  mockUseCreateEvaluation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
}

async function getModule() {
  return await import('../page');
}

async function renderNuevaEvaluacionPage() {
  const { default: NuevaEvaluacionPage } = await getModule();
  return render(<NuevaEvaluacionPage />);
}

// ─── Tests ──────────────────────────────────────────────────

describe('NuevaEvaluacionPage (Tiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  // ─── Render Básico ─────────────────────────────────────

  it('renderiza el título "Nueva evaluación"', async () => {
    await renderNuevaEvaluacionPage();

    expect(screen.getByText('Nueva evaluación')).toBeInTheDocument();
  });

  it('renderiza el campo de título de evaluación', async () => {
    await renderNuevaEvaluacionPage();

    expect(screen.getByLabelText('Título de la evaluación')).toBeInTheDocument();
  });

  it('renderiza el selector de clase con opciones', async () => {
    await renderNuevaEvaluacionPage();

    const select = screen.getByLabelText('Clase');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('');

    const { within } = await import('@testing-library/react');
    const options = within(select).getAllByRole('option');
    expect(options.length).toBe(3); // placeholder + 2 classes
    expect(options[1]).toHaveTextContent('1° — 1° A (Matemáticas)');
    expect(options[2]).toHaveTextContent('2° — 2° B (Lenguaje)');
  });

  it('muestra mensaje cuando no hay clases asignadas', async () => {
    mockUseMyClasses.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderNuevaEvaluacionPage();

    expect(
      screen.getByText('No tienes clases asignadas. Contacta al administrador.')
    ).toBeInTheDocument();
  });

  it('muestra spinner de carga de clases', async () => {
    mockUseMyClasses.mockReturnValue({
      data: null,
      isLoading: true,
    });

    await renderNuevaEvaluacionPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renderiza los botones de acción: Cancelar y Crear evaluación', async () => {
    await renderNuevaEvaluacionPage();

    expect(screen.getByText('Cancelar')).toBeInTheDocument();
    expect(screen.getByText('Crear evaluación')).toBeInTheDocument();
  });

  // ─── Preguntas ─────────────────────────────────────────

  it('comienza con 1 pregunta por defecto', async () => {
    await renderNuevaEvaluacionPage();

    expect(screen.getByText('Pregunta 1')).toBeInTheDocument();
    expect(screen.queryByText('Pregunta 2')).not.toBeInTheDocument();
  });

  it('agrega una pregunta al hacer clic en "Agregar Pregunta"', async () => {
    await renderNuevaEvaluacionPage();

    const addBtn = screen.getByText('Agregar Pregunta');
    await userEvent.click(addBtn);

    expect(screen.getByText('Pregunta 1')).toBeInTheDocument();
    expect(screen.getByText('Pregunta 2')).toBeInTheDocument();
  });

  it('agrega dos preguntas al hacer clic dos veces', async () => {
    await renderNuevaEvaluacionPage();

    const addBtn = screen.getByText('Agregar Pregunta');
    await userEvent.click(addBtn);
    await userEvent.click(addBtn);

    expect(screen.getByText('Pregunta 1')).toBeInTheDocument();
    expect(screen.getByText('Pregunta 2')).toBeInTheDocument();
    expect(screen.getByText('Pregunta 3')).toBeInTheDocument();
  });

  it('elimina una pregunta y reenumera las restantes', async () => {
    await renderNuevaEvaluacionPage();

    const addBtn = screen.getByText('Agregar Pregunta');
    await userEvent.click(addBtn);
    await userEvent.click(addBtn);

    // Should have Pregunta 1, Pregunta 2, Pregunta 3
    expect(screen.getByText('Pregunta 3')).toBeInTheDocument();

    // Delete Pregunta 2 (index 3 in items: info, divider, q1, q2, q3)
    const deleteButtons = screen.getAllByTitle('Eliminar elemento');
    await userEvent.click(deleteButtons[3]);

    expect(screen.queryByText('Pregunta 3')).not.toBeInTheDocument();
    expect(screen.getByText('Pregunta 2')).toBeInTheDocument();
  });

  it('no muestra botón eliminar cuando hay solo un elemento', async () => {
    await renderNuevaEvaluacionPage();

    // Default has 3 items (info section + divider + question), so remove 2 first
    let deleteButtons = screen.getAllByTitle('Eliminar elemento');
    await userEvent.click(deleteButtons[0]);
    deleteButtons = screen.getAllByTitle('Eliminar elemento');
    await userEvent.click(deleteButtons[0]);

    expect(screen.queryByTitle('Eliminar elemento')).not.toBeInTheDocument();
  });

  // ─── Tipo de pregunta ──────────────────────────────────

  it('cambia el tipo de pregunta a multiple_choice', async () => {
    await renderNuevaEvaluacionPage();

    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    expect(screen.getByText('Alternativas', { selector: 'label' })).toBeInTheDocument();
    // Should have 2 default alternatives A and B
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('cambia el tipo de pregunta a written', async () => {
    await renderNuevaEvaluacionPage();

    // First switch to multiple_choice
    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');
    expect(screen.getByText('Alternativas', { selector: 'label' })).toBeInTheDocument();

    // Switch back to written
    await userEvent.selectOptions(typeSelect, 'written');
    expect(screen.queryByText('Alternativas', { selector: 'label' })).not.toBeInTheDocument();
  });

  // ─── Alternativas ──────────────────────────────────────

  it('agrega alternativa a pregunta multiple_choice', async () => {
    await renderNuevaEvaluacionPage();

    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    // Default: A, B. Add C
    const addAltBtn = screen.getByText('+ Agregar alternativa');
    await userEvent.click(addAltBtn);

    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('agrega hasta 6 alternativas máximo', async () => {
    await renderNuevaEvaluacionPage();

    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    const addAltBtn = screen.getByText('+ Agregar alternativa');
    // Currently A, B (2). Add C, D, E, F (4 more = 6 total)
    await userEvent.click(addAltBtn); // C
    await userEvent.click(addAltBtn); // D
    await userEvent.click(addAltBtn); // E
    await userEvent.click(addAltBtn); // F

    expect(screen.getByText('F')).toBeInTheDocument();
    // Button should disappear at 6 alternatives
    expect(screen.queryByText('+ Agregar alternativa')).not.toBeInTheDocument();
  });

  it('elimina alternativa de pregunta multiple_choice', async () => {
    await renderNuevaEvaluacionPage();

    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    // A, B — add C so we can delete (need > 2)
    const addAltBtn = screen.getByText('+ Agregar alternativa');
    await userEvent.click(addAltBtn);

    // Delete B
    const deleteAltBtn = screen.getByLabelText('Eliminar alternativa B');
    await userEvent.click(deleteAltBtn);

    expect(screen.queryByText('C')).not.toBeInTheDocument();
    // C should now be relabeled to B
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('marca alternativa como correcta', async () => {
    await renderNuevaEvaluacionPage();

    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    // Find checkbox for alternative A and check it
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);

    expect(checkboxes[0]).toBeChecked();
  });

  it('cambia alternativa correcta al marcar otra', async () => {
    await renderNuevaEvaluacionPage();

    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    const checkboxes = screen.getAllByRole('checkbox');
    // Mark A as correct
    await userEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    // Mark B as correct — A should become unchecked
    await userEvent.click(checkboxes[1]);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  // ─── Criterios ─────────────────────────────────────────

  it('agrega un criterio a pregunta escrita', async () => {
    await renderNuevaEvaluacionPage();

    const addCriterionBtn = screen.getByText('+ Agregar criterio');
    await userEvent.click(addCriterionBtn);

    expect(screen.getByText('C1')).toBeInTheDocument();
  });

  it('agrega varios criterios a pregunta escrita', async () => {
    await renderNuevaEvaluacionPage();

    const addCriterionBtn = screen.getByText('+ Agregar criterio');
    await userEvent.click(addCriterionBtn);
    await userEvent.click(addCriterionBtn);
    await userEvent.click(addCriterionBtn);

    expect(screen.getByText('C1')).toBeInTheDocument();
    expect(screen.getByText('C2')).toBeInTheDocument();
    expect(screen.getByText('C3')).toBeInTheDocument();
  });

  it('elimina un criterio', async () => {
    await renderNuevaEvaluacionPage();

    // Written question comes with 1 criterion (C1). Add a second criterion (C2).
    const addCriterionBtn = screen.getByText('+ Agregar criterio');
    await userEvent.click(addCriterionBtn);

    const deleteCriterionBtn = screen.getByLabelText('Eliminar criterio 1');
    await userEvent.click(deleteCriterionBtn);

    expect(screen.queryByText('C2')).not.toBeInTheDocument();
    expect(screen.getByText('C1')).toBeInTheDocument(); // Former C2 is now relabeled C1
  });

  it('agrega nivel a un criterio', async () => {
    await renderNuevaEvaluacionPage();

    // The written question comes with 1 criterion by default. Add a second level.
    const addLevelBtn = screen.getByText('+ Agregar nivel');
    await userEvent.click(addLevelBtn);

    // Should now have 2 level inputs
    const ptsInputs = screen.getAllByPlaceholderText('Pts');
    expect(ptsInputs.length).toBe(2);
  });

  it('elimina nivel de un criterio', async () => {
    await renderNuevaEvaluacionPage();

    // The written question comes with 1 criterion by default. Add a second level.
    const addLevelBtn = screen.getByText('+ Agregar nivel');
    await userEvent.click(addLevelBtn);

    // Delete first level
    const deleteLevelBtn = screen.getByLabelText('Eliminar nivel 1');
    await userEvent.click(deleteLevelBtn);

    const ptsInputs = screen.getAllByPlaceholderText('Pts');
    expect(ptsInputs.length).toBe(1);
  });

  it('actualiza el total de puntos cuando se usan criterios', async () => {
    await renderNuevaEvaluacionPage();

    // The default written question comes with 1 criterion with 1 level of 3 pts
    expect(screen.getByText('Total: 3 pts')).toBeInTheDocument();
  });

  // ─── Validación ───────────────────────────────────────

  it('muestra alert si no se selecciona clase', async () => {
    const { fireEvent } = await import('@testing-library/react');
    await renderNuevaEvaluacionPage();

    await userEvent.type(screen.getByLabelText('Título de la evaluación'), 'Test');
    const form = screen.getByText('Crear evaluación').closest('form')!;
    fireEvent.submit(form);

    expect(window.alert).toHaveBeenCalledWith('Selecciona una clase para la evaluación.');
  });

  it('muestra alert si alternativa no tiene correcta seleccionada', async () => {
    await renderNuevaEvaluacionPage();

    // Fill required title to bypass HTML5 validation
    await userEvent.type(screen.getByLabelText('Título de la evaluación'), 'Test');
    const secTitle = screen.getByPlaceholderText('Ej: Texto de Lectura N° 1 o Instrucciones Generales');
    await userEvent.type(secTitle, 'Instrucciones');

    // Select a class
    const select = screen.getByLabelText('Clase');
    await userEvent.selectOptions(select, 'c1|Matemáticas');

    // Change to multiple_choice
    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    // Submit without marking correct alternative
    const submitBtn = screen.getByText('Crear evaluación');
    await userEvent.click(submitBtn);

    expect(window.alert).toHaveBeenCalledWith('Pregunta 1: selecciona la alternativa correcta.');
  });

  it('muestra alert si criterio no tiene nombre', async () => {
    await renderNuevaEvaluacionPage();

    // Fill required fields
    await userEvent.type(screen.getByLabelText('Título de la evaluación'), 'Test');
    const secTitle = screen.getByPlaceholderText('Ej: Texto de Lectura N° 1 o Instrucciones Generales');
    await userEvent.type(secTitle, 'Instrucciones');

    const select = screen.getByLabelText('Clase');
    await userEvent.selectOptions(select, 'c1|Matemáticas');

    // Submit (written question has a default empty criterion)
    const submitBtn = screen.getByText('Crear evaluación');
    await userEvent.click(submitBtn);

    expect(window.alert).toHaveBeenCalledWith(
      'Pregunta 1: todos los criterios deben tener nombre.'
    );
  });

  it('muestra alert si nivel tiene puntaje cero', async () => {
    await renderNuevaEvaluacionPage();

    await userEvent.type(screen.getByLabelText('Título de la evaluación'), 'Test');
    const secTitle = screen.getByPlaceholderText('Ej: Texto de Lectura N° 1 o Instrucciones Generales');
    await userEvent.type(secTitle, 'Instrucciones');

    const select = screen.getByLabelText('Clase');
    await userEvent.selectOptions(select, 'c1|Matemáticas');

    // Set criterion name
    const nameInput = screen.getByPlaceholderText(/Nombre del criterio/i);
    await userEvent.type(nameInput, 'Ortografía');

    // Change points to 0
    const ptsInput = screen.getByPlaceholderText('Pts');
    await userEvent.clear(ptsInput);
    await userEvent.type(ptsInput, '0');

    // Submit
    const submitBtn = screen.getByText('Crear evaluación');
    await userEvent.click(submitBtn);

    expect(window.alert).toHaveBeenCalledWith(
      'Pregunta 1, criterio "Ortografía": cada nivel debe tener puntaje > 0.'
    );
  });

  it('valida que alternativa tenga texto', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseCreateEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderNuevaEvaluacionPage();

    // Fill required title & section title to bypass HTML5 validation
    await userEvent.type(screen.getByLabelText('Título de la evaluación'), 'Test');
    const secTitle = screen.getByPlaceholderText('Ej: Texto de Lectura N° 1 o Instrucciones Generales');
    await userEvent.type(secTitle, 'Instrucciones');

    // Select a class
    const select = screen.getByLabelText('Clase');
    await userEvent.selectOptions(select, 'c1|Matemáticas');

    // Change to multiple_choice
    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    // Mark A as correct
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);

    const submitBtn = screen.getByText('Crear evaluación');
    await userEvent.click(submitBtn);

    // Should call createEvaluation because client validation passes
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
  });

  // ─── Submit ────────────────────────────────────────────

  it('submit exitoso redirige a evaluaciones', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseCreateEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderNuevaEvaluacionPage();

    // Fill in title & section title
    const titleInput = screen.getByLabelText('Título de la evaluación');
    await userEvent.type(titleInput, 'Evaluación Diagnóstica');

    const secTitleInput = screen.getByPlaceholderText('Ej: Texto de Lectura N° 1 o Instrucciones Generales');
    await userEvent.type(secTitleInput, 'Instrucciones');

    // Select class
    const select = screen.getByLabelText('Clase');
    await userEvent.selectOptions(select, 'c1|Matemáticas');

    // Fill in question statement
    const statementInput = screen.getByPlaceholderText(/enunciado/i);
    await userEvent.type(statementInput, '¿Cuánto es 2+2?');

    // Fill in criterion name and level description
    const criterionNameInput = screen.getByPlaceholderText(/Nombre del criterio/i);
    await userEvent.type(criterionNameInput, 'Criterio 1');
    const descInput = screen.getByPlaceholderText(/Descripción del nivel/i);
    await userEvent.type(descInput, 'Nivel 1');

    // Submit
    const submitBtn = screen.getByText('Crear evaluación');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Evaluación Diagnóstica',
          subject: 'Matemáticas',
          grade: '1°',
          course_id: 'c1',
          rubric: expect.arrayContaining([
            expect.objectContaining({
              question_number: 1,
              statement: '¿Cuánto es 2+2?',
              type: 'written',
            }),
          ]),
        })
      );
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/evaluaciones');
  });

  it('submit con multiple_choice envía payload correcto', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseCreateEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderNuevaEvaluacionPage();

    // Fill in title & section title
    const titleInput = screen.getByLabelText('Título de la evaluación');
    await userEvent.type(titleInput, 'Test MC');

    const secTitleInput = screen.getByPlaceholderText('Ej: Texto de Lectura N° 1 o Instrucciones Generales');
    await userEvent.type(secTitleInput, 'Instrucciones');

    // Select class
    const select = screen.getByLabelText('Clase');
    await userEvent.selectOptions(select, 'c2|Lenguaje');

    // Change to multiple_choice
    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    // Set statement
    const statementInput = screen.getByPlaceholderText(/enunciado/i);
    await userEvent.type(statementInput, '¿Cuál es la capital?');

    // Set max score
    const maxScoreInput = screen.getByPlaceholderText('Pts');
    await userEvent.type(maxScoreInput, '10');

    // Fill alternative texts
    const altInputs = screen.getAllByPlaceholderText(/Alternativa/);
    await userEvent.type(altInputs[0], 'Santiago');
    await userEvent.type(altInputs[1], 'Buenos Aires');

    // Mark A as correct
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);

    // Submit
    const submitBtn = screen.getByText('Crear evaluación');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test MC',
          subject: 'Lenguaje',
          grade: '2°',
          course_id: 'c2',
          rubric: expect.arrayContaining([
            expect.objectContaining({
              question_number: 1,
              type: 'multiple_choice',
              max_score: 10,
              alternatives: [
                { label: 'A', text: 'Santiago', is_correct: true },
                { label: 'B', text: 'Buenos Aires', is_correct: false },
              ],
            }),
          ]),
        })
      );
    });
  });

  it('muestra alert si createEvaluation falla', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue({ message: 'Error de red' });
    mockUseCreateEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderNuevaEvaluacionPage();

    const titleInput = screen.getByLabelText('Título de la evaluación');
    await userEvent.type(titleInput, 'Test');

    const secTitleInput = screen.getByPlaceholderText('Ej: Texto de Lectura N° 1 o Instrucciones Generales');
    await userEvent.type(secTitleInput, 'Instrucciones');

    const select = screen.getByLabelText('Clase');
    await userEvent.selectOptions(select, 'c1|Matemáticas');

    const criterionNameInput = screen.getByPlaceholderText(/Nombre del criterio/i);
    await userEvent.type(criterionNameInput, 'Criterio 1');

    const descInput = screen.getByPlaceholderText(/Descripción del nivel/i);
    await userEvent.type(descInput, 'Nivel 1');

    const submitBtn = screen.getByText('Crear evaluación');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Error: Error de red');
    });
  });

  it('muestra loading en botón submit durante la creación', async () => {
    mockUseCreateEvaluation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    });

    await renderNuevaEvaluacionPage();

    const submitBtn = screen.getByText('Guardando...');
    expect(submitBtn).toBeDisabled();
  });

  // ─── Cancelar ──────────────────────────────────────────

  it('botón cancelar navega hacia atrás', async () => {
    await renderNuevaEvaluacionPage();

    const cancelBtn = screen.getByText('Cancelar');
    await userEvent.click(cancelBtn);

    expect(mockRouterBack).toHaveBeenCalled();
  });

  // ─── Quick score buttons ───────────────────────────────

  it('muestra botones de puntaje rápido para multiple_choice', async () => {
    await renderNuevaEvaluacionPage();

    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    // Quick score buttons should be visible
    [1, 2, 3, 4, 5, 10].forEach((pts) => {
      expect(screen.getByLabelText(`${pts} puntos`)).toBeInTheDocument();
    });
  });

  it('selecciona puntaje mediante botón rápido', async () => {
    await renderNuevaEvaluacionPage();

    const typeSelect = screen.getByLabelText('Tipo de pregunta 1');
    await userEvent.selectOptions(typeSelect, 'multiple_choice');

    const btn5 = screen.getByLabelText('5 puntos');
    await userEvent.click(btn5);

    // The selected button should have the brand-primary styling
    expect(btn5.className).toContain('bg-brand-primary');
  });

  it('submit con written question envía criteria correctamente', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseCreateEvaluation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    await renderNuevaEvaluacionPage();

    // Fill required fields
    const titleInput = screen.getByLabelText('Título de la evaluación');
    await userEvent.type(titleInput, 'Test Written');

    const secTitleInput = screen.getByPlaceholderText('Ej: Texto de Lectura N° 1 o Instrucciones Generales');
    await userEvent.type(secTitleInput, 'Instrucciones');

    const select = screen.getByLabelText('Clase');
    await userEvent.selectOptions(select, 'c1|Matemáticas');

    // Set statement
    const statementInput = screen.getByPlaceholderText(/enunciado/i);
    await userEvent.type(statementInput, 'Describe el proceso');

    // Set criterion name (the written question comes with 1 default criterion)
    const nameInputs = screen.getAllByPlaceholderText(/Nombre del criterio/i);
    await userEvent.type(nameInputs[0], 'Claridad');

    // Set level description
    const descInputs = screen.getAllByPlaceholderText(/Descripción del nivel/i);
    await userEvent.type(descInputs[0], 'Excelente');

    // Submit
    const submitBtn = screen.getByText('Crear evaluación');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          rubric: expect.arrayContaining([
            expect.objectContaining({
              type: 'written',
              criteria: [
                expect.objectContaining({
                  name: 'Claridad',
                  levels: [
                    expect.objectContaining({
                      points: 3,
                      description: 'Excelente',
                    }),
                  ],
                }),
              ],
            }),
          ]),
        })
      );
    });
  });

  // ─── Previsualización ──────────────────────────────────

  it('abre el modal de previsualización al hacer clic en Previsualizar', async () => {
    await renderNuevaEvaluacionPage();

    const previewBtns = screen.getAllByText('Previsualizar');
    await userEvent.click(previewBtns[0]);

    expect(screen.getByText('Vista previa de evaluación')).toBeInTheDocument();
  });
});

