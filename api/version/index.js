const { sendJsonResponse } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const latestInfo = {
    version: '3.4.0',
    versionCode: 340,
    releasedAt: '2026-08-30',
    appName: 'NoteYou',
    downloadUrl: '/assets/downloads/NoteYou-v1.0.apk',
    releaseNotes: [
      'Widgets nativos para la pantalla de inicio de Android con diseño Glassmorphism (Tareas y Finanzas).',
      'Edición rápida de Enlaces Guardados y marcadores favoritos.',
      'Mejoras en paneles de categorías y gráficas estadísticas.',
      'Optimizaciones visuales de alto contraste y correcciones de rendimiento.'
    ],
    isMandatory: false
  };

  return sendJsonResponse(res, 200, {
    success: true,
    ...latestInfo
  });
};
