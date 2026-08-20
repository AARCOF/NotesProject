import { connectToDatabase, sendJsonResponse } from '../lib/db';
import { verifyAuthToken } from '../lib/auth-middleware';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return sendJsonResponse(res, 401, { success: false, message: 'No autorizado.' });
  }

  try {
    const { db } = await connectToDatabase();
    const categoriesCollection = db.collection('categories');
    const userId = authUser.sub;

    switch (req.method) {
      case 'GET': {
        const categories = await categoriesCollection.find({ userId }).toArray();
        return sendJsonResponse(res, 200, { success: true, categories });
      }

      case 'POST': {
        const catData = req.body;
        if (!catData.name) {
          return sendJsonResponse(res, 400, { success: false, message: 'El nombre de la categoría es requerido.' });
        }

        const newCategory = {
          ...catData,
          id: catData.id || 'cat_' + Date.now(),
          userId
        };

        await categoriesCollection.insertOne(newCategory);
        return sendJsonResponse(res, 201, { success: true, category: newCategory });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (!id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID es requerido.' });
        }

        await categoriesCollection.deleteOne({ id, userId });
        return sendJsonResponse(res, 200, { success: true, message: 'Categoría eliminada.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err: any) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en categorías: ' + err.message });
  }
}
