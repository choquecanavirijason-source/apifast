import { PackageSearch } from "lucide-react";

export default function MarketplaceCatalogPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
        <PackageSearch size={22} className="text-blue-600" /> Catálogo público
      </h1>
      <p className="text-sm text-gray-500 mb-8">Vista previa de cómo verán los productos los clientes en la app.</p>
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center text-blue-600">
        <PackageSearch size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-semibold">Vista previa en desarrollo</p>
        <p className="text-sm text-blue-400 mt-1">Próximamente podrás ver aquí el catálogo como lo ven tus clientes.</p>
      </div>
    </div>
  );
}
