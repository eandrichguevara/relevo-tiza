import Link from 'next/link';
import { BookOpen, Clock, BarChart3 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-brand-light">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-brand-primary" />
            <span className="text-2xl font-bold text-brand-secondary">TIZA</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-accent transition-colors font-medium"
            >
              Registrarse gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-5xl font-bold text-brand-secondary mb-6">Tu tiempo, tu enseñanza</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Corrige evaluaciones automáticamente con IA y recupera horas para lo que realmente
            importa: tus alumnos.
          </p>
          <Link
            href="/register"
            className="bg-brand-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-brand-accent transition-colors inline-block"
          >
            Comienza gratis
          </Link>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <Clock className="h-12 w-12 text-brand-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ahorra 15 horas semanales</h3>
            <p className="text-gray-600">
              Automatiza la corrección de pruebas y dedica tu tiempo a planificar clases.
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <BookOpen className="h-12 w-12 text-brand-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Corrección inteligente</h3>
            <p className="text-gray-600">
              IA que entiende letra manuscrita y corrige según tu rúbrica personalizada.
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <BarChart3 className="h-12 w-12 text-brand-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Reportes detallados</h3>
            <p className="text-gray-600">
              Visualiza el progreso de cada alumno con reportes pedagógicos automáticos.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500 text-sm">
          <p className="flex items-center justify-center gap-1">
            TIZA — &copy; 2026. Hecho con
            <svg
              className="h-4 w-4 text-red-500 inline-block"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            en Chile.
          </p>
        </div>
      </footer>
    </div>
  );
}
