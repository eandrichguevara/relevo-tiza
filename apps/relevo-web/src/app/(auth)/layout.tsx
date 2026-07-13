export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-primary">RELEVO</h1>
          <p className="text-brand-secondary/60 mt-1">Datos que transforman</p>
        </div>
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">{children}</div>
      </div>
    </div>
  );
}
