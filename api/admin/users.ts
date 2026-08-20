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

  // Validación estricta de Superadministrador en servidor
  if (authUser.role !== 'superadmin' && authUser.email !== 'acaf504082@gmail.com') {
    return sendJsonResponse(res, 403, { success: false, message: 'Acceso denegado. Solo el Superadministrador puede acceder a este recurso.' });
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
        const { targetUserId, newRole, isActive } = req.body;
        if (!targetUserId) {
          return sendJsonResponse(res, 400, { success: false, message: 'targetUserId es requerido.' });
        }

        const updateFields: any = {};
        if (newRole) updateFields.role = newRole;
        if (typeof isActive === 'boolean') updateFields.isActive = isActive;

        await usersCollection.updateOne({ id: targetUserId }, { $set: updateFields });
        return sendJsonResponse(res, 200, { success: true, message: 'Usuario actualizado correctamente por el Superadministrador.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err: any) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en administración de usuarios: ' + err.message });
  }
}
