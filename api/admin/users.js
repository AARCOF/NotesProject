const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const { verifyAuthToken } = require('../lib/auth-middleware');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const authUser = verifyAuthToken(req);
  if (!authUser || authUser.role !== 'superadmin') {
    return sendJsonResponse(res, 403, { success: false, message: 'Acceso restringido a Superadministradores.' });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    switch (req.method) {
      case 'GET': {
        const users = await usersCollection
          .find({}, { projection: { passwordHash: 0, verificationKey: 0 } })
          .toArray();
        return sendJsonResponse(res, 200, { success: true, users });
      }

      case 'PUT': {
        const { userId, role, isActive } = body || {};
        if (!userId) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID de usuario requerido.' });
        }

        const updateFields = {};
        if (role) updateFields.role = role;
        if (typeof isActive === 'boolean') updateFields.isActive = isActive;

        await usersCollection.updateOne(
          { id: userId },
          { $set: updateFields }
        );

        return sendJsonResponse(res, 200, { success: true, message: 'Usuario actualizado.' });
      }

      case 'DELETE': {
        const { userId } = req.query || {};
        if (!userId) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID de usuario requerido.' });
        }

        await usersCollection.deleteOne({ id: userId });
        return sendJsonResponse(res, 200, { success: true, message: 'Usuario eliminado.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en administración de usuarios: ' + (err ? err.message : err) });
  }
};
