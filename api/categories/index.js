const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const { verifyAuthToken } = require('../lib/auth-middleware');

module.exports = async function handler(req, res) {
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

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    switch (req.method) {
      case 'GET': {
        const categories = await categoriesCollection.find({ userId }).toArray();
        return sendJsonResponse(res, 200, { success: true, categories });
      }

      case 'POST': {
        const catData = body || {};
        if (!catData.name) {
          return sendJsonResponse(res, 400, { success: false, message: 'El nombre de la categoría es requerido.' });
        }

        const newCategory = {
          ...catData,
          id: catData.id || 'cat_' + Date.now(),
          userId
        };

        await categoriesCollection.updateOne(
          { id: newCategory.id, userId },
          { $set: newCategory },
          { upsert: true }
        );

        return sendJsonResponse(res, 201, { success: true, category: newCategory });
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

        await categoriesCollection.deleteMany({ id: id.toString() });
        return sendJsonResponse(res, 200, { success: true, message: 'Categoría eliminada.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en categorías: ' + (err ? err.message : err) });
  }
};
