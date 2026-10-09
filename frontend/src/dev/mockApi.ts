// Simulação local para desenvolvimento enquanto o backend não está integrado.
// Só vale no servidor de desenvolvimento (npm run dev) e com VITE_MOCK_API=true
// (ver .env.local). No build de produção import.meta.env.DEV é false, então
// nenhuma conta é simulada e os adaptadores continuam devolvendo "unavailable".
export const MOCK_API = import.meta.env.DEV && import.meta.env.VITE_MOCK_API === "true";

export const mockDelay = (ms = 600) => new Promise<void>((resolve) => setTimeout(resolve, ms));
