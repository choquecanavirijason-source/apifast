declare module '*.css';

interface ImportMetaEnv {
	readonly VITE_API_URL: string;
	readonly VITE_PROFESSIONAL_COMMISSION_RATE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
