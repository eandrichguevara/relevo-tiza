import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-brand-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-brand-secondary mb-4">Página no encontrada</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          La página que buscas no existe o fue movida. Revisa la URL o vuelve al inicio.
        </p>
        <Link
          href="/"
          className="bg-brand-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-accent transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
