// Base del backend (Express). Vacío -> rutas relativas (/api/...), que funcionan
// tanto en dev (Vite reenvía /api por proxy) como en prod (mismo origen, el backend
// sirve el SPA). Define VITE_API_BASE solo si el front y el backend viven en
// orígenes distintos (p. ej. front en Vercel y backend en Railway).
export const API_BASE = import.meta.env.VITE_API_BASE || ''
