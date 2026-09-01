const { sendJsonResponse } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const latestInfo = {
    version: '3.8.0',
    versionCode: 380,
    releasedAt: '2026-09-01',
    appName: 'NoteYou',
    downloadUrl: '/assets/downloads/NoteYou-v1.0.apk',
    releaseNotes: [
      'Scroll vertical fluido y sin límites de páginas en celulares (Redmi 10 / 12 y todos los dispositivos).',
      'Desplazamiento interno independiente por columna en Tablero Kanban en computadora.',
      'Modales de confirmación con diseño unificado NoteYou y alineación responsive perfeccionada.',
      'Sistema de verificación y descarga dinámica de actualizaciones en tiempo real.'
    ],
    isMandatory: false
  };

  return sendJsonResponse(res, 200, {
    success: true,
    ...latestInfo
  });
};
