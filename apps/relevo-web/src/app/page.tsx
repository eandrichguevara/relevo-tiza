import Link from 'next/link';
import { BarChart3, School, TrendingUp, Shield } from 'lucide-react';

export default function RelevoHome() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-brand-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <School className="h-8 w-8" />
            <span className="text-2xl font-bold">RELEVO</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="border-2 border-white text-white hover:bg-white hover:text-brand-primary px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="bg-white text-brand-primary px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Solicitar demo
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-brand-primary text-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl font-bold mb-6">Datos que transforman la educación</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-10">
              La plataforma de analítica educativa que convierte evaluaciones en decisiones. Para
              sostenedores que quieren ver más allá de las notas.
            </p>
            <Link
              href="/register"
              className="bg-white text-brand-primary px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
            >
              Agenda una demo
            </Link>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid md:grid-cols-4 gap-8">
          <div className="text-center p-6">
            <BarChart3 className="h-10 w-10 text-brand-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">KPIs en tiempo real</h3>
            <p className="text-sm text-gray-600">
              Dashboards ejecutivos con datos actualizados al instante.
            </p>
          </div>
          <div className="text-center p-6">
            <School className="h-10 w-10 text-brand-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Multi-colegio</h3>
            <p className="text-sm text-gray-600">
              Gestiona todos tus establecimientos desde un solo lugar.
            </p>
          </div>
          <div className="text-center p-6">
            <TrendingUp className="h-10 w-10 text-brand-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Predicción SIMCE</h3>
            <p className="text-sm text-gray-600">
              Anticipa resultados con datos reales de tus evaluaciones.
            </p>
          </div>
          <div className="text-center p-6">
            <Shield className="h-10 w-10 text-brand-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Datos en Chile</h3>
            <p className="text-sm text-gray-600">
              Cumplimiento total Ley 19.628. Tus datos nunca salen del país.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-gray-500 text-sm">
        <p>RELEVO SpA — &copy; 2026. Santiago, Chile.</p>
      </footer>
    </div>
  );
}
