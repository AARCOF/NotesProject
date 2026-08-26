const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const { verifyAuthToken } = require('../lib/auth-middleware');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return sendJsonResponse(res, 401, { success: false, message: 'No autorizado. Token inválido o ausente.' });
  }

  try {
    const { db } = await connectToDatabase();
    const savedLinksCollection = db.collection('saved_links');
    const userId = authUser.sub;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    switch (req.method) {
      case 'GET': {
        const links = await savedLinksCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
        return sendJsonResponse(res, 200, { success: true, links });
      }

      case 'POST': {
        const linkData = body;
        if (!linkData || !linkData.title || !linkData.url) {
          return sendJsonResponse(res, 400, { success: false, message: 'El título y el enlace son obligatorios.' });
        }

        const newLink = {
          ...linkData,
          id: linkData.id || 'sl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId,
          createdAt: linkData.createdAt || new Date().toISOString()
        };

        await savedLinksCollection.updateOne(
          { id: newLink.id, userId },
          { $set: newLink },
          { upsert: true }
        );

        return sendJsonResponse(res, 201, { success: true, link: newLink });
      }

      case 'PUT': {
        const { id, ...updateData } = body || {};
        if (!id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID es obligatorio.' });
        }

        await savedLinksCollection.updateOne(
          { id, userId },
          { $set: updateData }
        );

        return sendJsonResponse(res, 200, { success: true, message: 'Enlace guardado actualizado.' });
      }

      case 'DELETE': {
        let id = req.query ? req.query.id : null;
        if (!id && req.url && req.url.includes('id=')) {
          const parts = req.url.split('id=');
          id = parts[1] ? parts[1].split('&')[0] : null;
        }
        if (!id && req.body && req.body.id) {
          id = req.body.id;
        }

        if (!id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID es requerido.' });
        }

        await savedLinksCollection.deleteOne({ id: id.toString(), userId });
        return sendJsonResponse(res, 200, { success: true, message: 'Enlace guardado eliminado.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en servidor de enlaces guardados: ' + (err ? err.message : err) });
  }
};
