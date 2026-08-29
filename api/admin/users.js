const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const { verifyAuthToken } = require('../lib/auth-middleware');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return sendJsonResponse(res, 401, { success: false, message: 'No autorizado. Token inválido o ausente.' });
  }

  const isSuper = authUser.role === 'superadmin';
  const isAdmin = authUser.role === 'admin';
  const isAdminOrSuper = isSuper || isAdmin;
  const targetUserId = body?.userId;
  const isSelf = authUser.sub === targetUserId || authUser.email === targetUserId;

  if (req.method === 'GET' && !isAdminOrSuper) {
    return sendJsonResponse(res, 403, { success: false, message: 'Acceso restringido a Administradores.' });
  }
  if (req.method === 'DELETE' && !isSuper) {
    return sendJsonResponse(res, 403, { success: false, message: 'Acceso restringido a Superadministradores.' });
  }
  if (req.method === 'PUT' && !isAdminOrSuper && !isSelf) {
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

        // Si quien realiza la petición es un administrador (no superadmin), no puede modificar a un superadmin
        if (!isSuper) {
          const targetUser = await usersCollection.findOne({
            $or: [{ id: userId }, { email: userId }]
          });

          if (targetUser && targetUser.role === 'superadmin') {
            return sendJsonResponse(res, 403, {
              success: false,
              message: 'Los administradores no pueden modificar el estado de un Superadministrador.'
            });
          }
        }

        const updateFields = {};
        if (isSuper && role) updateFields.role = role;
        if (isSuper && typeof isActive === 'boolean') updateFields.isActive = isActive;
        if ((isSuper || isAdmin) && typeof isVerified === 'boolean') updateFields.isVerified = isVerified;
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
