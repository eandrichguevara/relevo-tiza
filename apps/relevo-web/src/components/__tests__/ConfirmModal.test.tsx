import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '../ConfirmModal';

// Mock @tiza/ui Button
vi.mock('@tiza/ui', () => ({
  Button: ({ children, onClick, disabled, loading, variant, brand: _brand, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled || loading} data-variant={variant} {...rest}>
      {loading ? 'Aceptar...' : children}
    </button>
  ),
}));

describe('ConfirmModal', () => {
  let props: ReturnType<typeof makeProps>;

  function makeProps(overrides?: Record<string, unknown>) {
    return {
      title: 'Confirmar acción',
      children: <p>¿Estás seguro?</p>,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      confirmLabel: 'Aceptar',
      ...overrides,
    };
  }

  beforeEach(() => {
    props = makeProps();
  });

  it('renderiza título y children', () => {
    render(<ConfirmModal {...props} />);
    expect(screen.getByText('Confirmar acción')).toBeInTheDocument();
    expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument();
  });

  it('renderiza los botones Cancelar y confirmLabel', () => {
    render(<ConfirmModal {...props} />);
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
    expect(screen.getByText('Aceptar')).toBeInTheDocument();
  });

  it('llama onConfirm al hacer click en el botón de confirmar', () => {
    render(<ConfirmModal {...props} />);
    fireEvent.click(screen.getByText('Aceptar'));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('llama onCancel al hacer click en Cancelar', () => {
    render(<ConfirmModal {...props} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('llama onCancel al hacer click en el backdrop', () => {
    render(<ConfirmModal {...props} />);
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('tiene role="dialog" y aria-modal="true"', () => {
    render(<ConfirmModal {...props} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Confirmar acción');
  });

  it('deshabilita botones cuando loading es true', () => {
    const loadingProps = makeProps({ loading: true });
    render(<ConfirmModal {...loadingProps} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('no llama onConfirm cuando loading es true (botón deshabilitado)', () => {
    const loadingProps = makeProps({ loading: true });
    render(<ConfirmModal {...loadingProps} />);
    const confirmBtn = screen.getByText('Aceptar...');
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(loadingProps.onConfirm).not.toHaveBeenCalled();
  });

  it('usa variant danger cuando se especifica', () => {
    const dangerProps = makeProps({ confirmVariant: 'danger' });
    render(<ConfirmModal {...dangerProps} />);
    const confirmBtn = screen.getByText('Aceptar');
    expect(confirmBtn).toHaveAttribute('data-variant', 'danger');
  });

  it('usa variant primary por defecto', () => {
    render(<ConfirmModal {...props} />);
    const confirmBtn = screen.getByText('Aceptar');
    expect(confirmBtn).toHaveAttribute('data-variant', 'primary');
  });
});
