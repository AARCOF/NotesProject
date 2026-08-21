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
    const quickNotesCollection = db.collection('quick_notes');
    const userId = authUser.sub;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    switch (req.method) {
      case 'GET': {
        const quickNotes = await quickNotesCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
        return sendJsonResponse(res, 200, { success: true, quickNotes });
      }

      case 'POST': {
        const noteData = body;
        if (!noteData || !noteData.content) {
          return sendJsonResponse(res, 400, { success: false, message: 'El contenido es obligatorio.' });
        }

        const newQuickNote = {
          ...noteData,
          id: noteData.id || 'qn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId,
          createdAt: noteData.createdAt || new Date().toISOString()
        };

        await quickNotesCollection.updateOne(
          { id: newQuickNote.id, userId },
          { $set: newQuickNote },
          { upsert: true }
        );

        return sendJsonResponse(res, 201, { success: true, quickNote: newQuickNote });
      }

      case 'PUT': {
        const { id, ...updateData } = body || {};
        if (!id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID es obligatorio.' });
        }

        await quickNotesCollection.updateOne(
          { id, userId },
          { $set: updateData },
          { upsert: true }
        );

        return sendJsonResponse(res, 200, { success: true, message: 'Nota rápida actualizada.' });
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

        await quickNotesCollection.deleteMany({ id: id.toString() });
        return sendJsonResponse(res, 200, { success: true, message: 'Nota rápida eliminada correctamente.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en servidor de notas rápidas: ' + (err ? err.message : err) });
  }
};
