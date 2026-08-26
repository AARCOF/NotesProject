const { sendJsonResponse } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const latestInfo = {
    version: '3.2.1',
    versionCode: 321,
    releasedAt: '2026-08-26',
    appName: 'NoteYou',
    downloadUrl: '/assets/downloads/NoteYou-v1.0.apk',
    releaseNotes: [
      'Nuevos widgets de escritorio para Android (Lista de tareas y Balance financiero).',
      'Corrección del cálculo de ingresos mensuales (sueldo) en el widget de finanzas.',
      'Descarga optimizada del APK como un único archivo directo y seguro.',
      'Correcciones de contraste de botones, color y tamaño de iconos en el panel.'
    ],
    isMandatory: false
  };

  return sendJsonResponse(res, 200, {
    success: true,
    ...latestInfo
  });
};
