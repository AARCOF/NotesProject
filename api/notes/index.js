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
    const notesCollection = db.collection('notes');
    const userId = authUser.sub;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    switch (req.method) {
      case 'GET': {
        const notes = await notesCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
        return sendJsonResponse(res, 200, { success: true, notes });
      }

      case 'POST': {
        const noteData = body;
        if (!noteData || !noteData.title) {
          return sendJsonResponse(res, 400, { success: false, message: 'El título de la nota es obligatorio.' });
        }

        const newNote = {
          ...noteData,
          id: noteData.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId,
          createdAt: noteData.createdAt || new Date().toISOString()
        };

        // Upsert by id and userId so batch sync or creation works cleanly
        await notesCollection.updateOne(
          { id: newNote.id, userId },
          { $set: newNote },
          { upsert: true }
        );

        return sendJsonResponse(res, 201, { success: true, note: newNote });
      }

      case 'PUT': {
        const { id, ...updateData } = body || {};
        if (!id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID de nota es obligatorio.' });
        }

        const result = await notesCollection.updateOne(
          { id, userId },
          { $set: updateData },
          { upsert: true }
        );

        const updatedNote = await notesCollection.findOne({ id, userId });
        return sendJsonResponse(res, 200, { success: true, note: updatedNote });
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
          return sendJsonResponse(res, 400, { success: false, message: 'ID de nota es requerido.' });
        }

        await notesCollection.deleteMany({ id: id.toString() });
        return sendJsonResponse(res, 200, { success: true, message: 'Nota eliminada correctamente.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en servidor de notas: ' + (err ? err.message : err) });
  }
};
