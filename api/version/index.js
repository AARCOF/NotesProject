const { sendJsonResponse } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const latestInfo = {
    version: '3.7.0',
    versionCode: 370,
    releasedAt: '2026-08-30',
    appName: 'NoteYou',
    downloadUrl: '/assets/downloads/NoteYou-v1.0.apk',
    releaseNotes: [
      'Widgets de pantalla de inicio con diseño premium Liquid Glass y orbes ambientales translúcidos.',
      'Íconos vectoriales nativos en widgets en lugar de emojis.',
      'Optimización de escalado responsivo para cuadrículas 2x2 y 4x2.',
      'Actualización directa in-place sin necesidad de desinstalar la app.'
    ],
    isMandatory: false
  };

  return sendJsonResponse(res, 200, {
    success: true,
    ...latestInfo
  });
};
