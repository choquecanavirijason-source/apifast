export default function LoaderScreen() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 z-9999">
            <div className="relative w-48 h-48 mb-8">
                {/* Anillo exterior giratorio */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#F5D238] border-r-[#1A1B16] animate-spin-slow"></div>
                {/* Anillo interior giratorio en dirección opuesta */}
                <div className="absolute inset-4 rounded-full border-2 border-transparent border-b-[#F5D238] border-l-[#1A1B16] animate-spin-slow-reverse"></div>
                {/* Punto central */}
                <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-[#F5D238] rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10"></div>
            </div>
            {/* Texto de carga */}
            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 animate-pulse text-center mb-4">
                Cargando...
            </p>
            {/* Texto secundario opcional */}
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                Por favor espere mientras cargamos el contenido
            </p>
            <style>
                {`
            @keyframes spin-slow {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes spin-slow-reverse {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(-360deg); }
            }
            .animate-spin-slow {
              animation: spin-slow 3s linear infinite;
            }
            .animate-spin-slow-reverse {
              animation: spin-slow-reverse 2s linear infinite;
            }
          `}
            </style>
        </div>
    );
}
