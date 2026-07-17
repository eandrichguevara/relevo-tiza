import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthLayout from '../layout';

describe('AuthLayout', () => {
  it('renderiza el título RELEVO y subtítulo', () => {
    render(
      <AuthLayout>
        <div data-testid="children">Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('RELEVO')).toBeInTheDocument();
    expect(screen.getByText('Datos que transforman')).toBeInTheDocument();
  });

  it('renderiza el children dentro del card blanco', () => {
    render(
      <AuthLayout>
        <div data-testid="children">Form Content</div>
      </AuthLayout>
    );

    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByText('Form Content')).toBeInTheDocument();
  });

  it('tiene layout centrado con max-w-md', () => {
    const { container } = render(
      <AuthLayout>
        <div>Content</div>
      </AuthLayout>
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain('min-h-screen');
    expect(outerDiv.className).toContain('flex');
    expect(outerDiv.className).toContain('items-center');
    expect(outerDiv.className).toContain('justify-center');
  });
});
