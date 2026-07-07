// Secciones visibles para el rol "visor" (solo lectura). El resto (Horarios/edición,
// WhatsApp, Mensatek) queda oculto. 'config' se muestra pero con secciones acotadas
// (ver SettingsLayout) para permitir gestionar la cuenta y cerrar sesión.
export const VIEWER_NAV = new Set(['dashboard', 'cumplimiento', 'jornadas', 'riders', 'config'])

// Secciones de Ajustes visibles para el visor.
export const VIEWER_SETTINGS = new Set(['cuenta', 'seguridad'])
