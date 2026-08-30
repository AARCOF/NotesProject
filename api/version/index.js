const { sendJsonResponse } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const latestInfo = {
    version: '3.3.0',
    versionCode: 330,
    releasedAt: '2026-08-30',
    appName: 'NoteYou',
    downloadUrl: '/assets/downloads/NoteYou-v1.0.apk',
    releaseNotes: [
      'Espacios de Trabajo Compartidos con pestañas estilo navegador web.',
      'Contorno animado interactivo Snake LED en tareas, entregables y categorías.',
      'Sistema de modales interactivos de confirmación y alertas de alta fidelidad.',
      'Optimización de layout responsive y APK móvil de alto rendimiento.'
    ],
    isMandatory: false
  };

  return sendJsonResponse(res, 200, {
    success: true,
    ...latestInfo
  });
};
