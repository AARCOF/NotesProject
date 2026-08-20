import { connectToDatabase, sendJsonResponse } from '../lib/db';
import { verifyAuthToken } from '../lib/auth-middleware';

export default async function handler(req: any, res: any) {
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

    switch (req.method) {
      case 'GET': {
        const notes = await notesCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
        return sendJsonResponse(res, 200, { success: true, notes });
      }

      case 'POST': {
        const noteData = req.body;
        if (!noteData.title) {
          return sendJsonResponse(res, 400, { success: false, message: 'El título de la nota es obligatorio.' });
        }

        const newNote = {
          ...noteData,
          id: noteData.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId,
          createdAt: noteData.createdAt || new Date().toISOString()
        };

        await notesCollection.insertOne(newNote);
        return sendJsonResponse(res, 201, { success: true, note: newNote });
      }

      case 'PUT': {
        const { id, ...updateData } = req.body;
        if (!id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID de nota es obligatorio.' });
        }

        const result = await notesCollection.updateOne(
          { id, userId },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return sendJsonResponse(res, 404, { success: false, message: 'Nota no encontrada o sin permisos.' });
        }

        const updatedNote = await notesCollection.findOne({ id, userId });
        return sendJsonResponse(res, 200, { success: true, note: updatedNote });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (!id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID de nota es requerido.' });
        }

        const result = await notesCollection.deleteOne({ id, userId });
        if (result.deletedCount === 0) {
          return sendJsonResponse(res, 404, { success: false, message: 'Nota no encontrada o sin permisos.' });
        }

        return sendJsonResponse(res, 200, { success: true, message: 'Nota eliminada correctamente.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en servidor de notas: ' + (err as any)?.message });
  }
}
