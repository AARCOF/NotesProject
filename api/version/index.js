const { sendJsonResponse } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const latestInfo = {
    version: '3.2.2',
    versionCode: 322,
    releasedAt: '2026-08-26',
    appName: 'NoteYou',
    downloadUrl: '/assets/downloads/NoteYou-v1.0.apk',
    releaseNotes: [
      'Actualización instantánea en tiempo real de los widgets nativos de Android (Tareas y Finanzas).',
      'Corrección definitiva del parpadeo y cierre automático de modales al seleccionar categorías y subcategorías.',
      'Nuevo diseño estilizado tipo Bottom Sheet para modales en móvil con soporte táctil y animación suave.',
      'Estabilidad optimizada en la sincronización en segundo plano.'
    ],
    isMandatory: false
  };

  return sendJsonResponse(res, 200, {
    success: true,
    ...latestInfo
  });
};
