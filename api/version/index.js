const { sendJsonResponse } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const latestInfo = {
    version: '3.1.0',
    versionCode: 310,
    releasedAt: '2026-08-26',
    appName: 'NoteYou',
    downloadUrl: 'https://expo.dev/artifacts/eas/Jf8cNEAUkUObLZuqZOX08W4ou185iTQpmuvHguP0iXg.apk',
    releaseNotes: [
      'Nuevo logo oficial blanco en alta definición.',
      'Soporte multi-moneda desde el perfil de usuario (PEN, USD, EUR, MXN, COP, etc.).',
      'Sincronización en tiempo real entre PC y Celular sin pérdida de datos.',
      'Proyección de pagos y recordatorios estrictamente desde la fecha actual hacia el futuro.',
      'Eliminación automática de registros no verificados tras 2 horas.'
    ],
    isMandatory: false
  };

  return sendJsonResponse(res, 200, {
    success: true,
    ...latestInfo
  });
};
