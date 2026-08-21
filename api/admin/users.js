const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const { verifyAuthToken } = require('../lib/auth-middleware');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const authUser = verifyAuthToken(req);
  const isSuper = authUser && authUser.role === 'superadmin';
  const isSelf = authUser && (authUser.sub === body?.userId || authUser.email === body?.userId);

  if (req.method === 'GET' && !isSuper) {
    return sendJsonResponse(res, 403, { success: false, message: 'Acceso restringido a Superadministradores.' });
  }
  if (req.method === 'DELETE' && !isSuper) {
    return sendJsonResponse(res, 403, { success: false, message: 'Acceso restringido a Superadministradores.' });
  }
  if (req.method === 'PUT' && !isSuper && !isSelf) {
    return sendJsonResponse(res, 403, { success: false, message: 'Acceso restringido.' });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    switch (req.method) {
      case 'GET': {
        const users = await usersCollection
          .find({}, { projection: { passwordHash: 0, verificationKey: 0 } })
          .toArray();
        return sendJsonResponse(res, 200, { success: true, users });
      }

      case 'PUT': {
        const { userId, role, isActive, isVerified, hasCompletedTutorial } = body || {};
        if (!userId) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID de usuario requerido.' });
        }

        const updateFields = {};
        if (isSuper && role) updateFields.role = role;
        if (isSuper && typeof isActive === 'boolean') updateFields.isActive = isActive;
        if (isSuper && typeof isVerified === 'boolean') updateFields.isVerified = isVerified;
        if (typeof hasCompletedTutorial === 'boolean') updateFields.hasCompletedTutorial = hasCompletedTutorial;

        await usersCollection.updateMany(
          { $or: [{ id: userId }, { email: userId }] },
          { $set: updateFields }
        );

        return sendJsonResponse(res, 200, { success: true, message: 'Usuario actualizado en MongoDB Atlas.' });
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
