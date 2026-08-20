import { connectToDatabase, sendJsonResponse } from '../lib/db';
import { generateJwtToken } from '../lib/auth-middleware';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, { error: 'Método no permitido' });
  }

  try {
    const { email, key } = req.body || {};

    if (!email || !key) {
      return sendJsonResponse(res, 400, { success: false, message: 'Correo y código son requeridos' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanKey = key.toString().trim();

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: cleanEmail });
    if (!user) {
      return sendJsonResponse(res, 404, { success: false, message: 'Usuario no encontrado' });
    }

    if (user.isVerified) {
      const userData = {
        id: user.id || user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: true,
        isActive: true,
        hasCompletedTutorial: user.hasCompletedTutorial || false
      };
      const token = generateJwtToken(userData, '7d');
      return sendJsonResponse(res, 200, { success: true, message: 'La cuenta ya estaba verificada.', token, user: userData });
    }

    if (user.verificationKey !== cleanKey) {
      return sendJsonResponse(res, 400, { success: false, message: 'El código de seguridad ingresado es incorrecto.' });
    }

    if (user.keyExpiresAt && Date.now() > user.keyExpiresAt) {
      return sendJsonResponse(res, 400, { success: false, message: 'El código de seguridad ha expirado. Solicita uno nuevo.' });
    }

    // Activar usuario
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: { isVerified: true },
        $unset: { verificationKey: '', keyExpiresAt: '' }
      }
    );

    const userData = {
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: true,
      isActive: true,
      hasCompletedTutorial: false
    };

    const token = generateJwtToken(userData, '7d');

    return sendJsonResponse(res, 200, {
      success: true,
      message: 'Cuenta verificada exitosamente. Se ha iniciado sesión.',
      token,
      user: userData
    });
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error al verificar cuenta: ' + (err as any)?.message });
  }
}
