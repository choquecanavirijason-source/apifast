declare module '*.css';

interface ImportMetaEnv {
	readonly VITE_API_URL: string;
	// Agrega aquí otras variables de entorno personalizadas si las tienes
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
