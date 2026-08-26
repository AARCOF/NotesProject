const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const { generateJwtToken } = require('../lib/auth-middleware');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, { error: 'Método no permitido' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const { email, key } = body || {};

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

    const createdAtMs = user.createdAt ? new Date(user.createdAt).getTime() : 0;
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const isExpired = (Date.now() - createdAtMs) > twoHoursMs || (user.unverifiedExpiresAt && new Date(user.unverifiedExpiresAt).getTime() < Date.now());

    if (isExpired) {
      await usersCollection.deleteOne({ _id: user._id });
      return sendJsonResponse(res, 400, {
        success: false,
        message: 'El plazo de 2 horas para verificar tu cuenta ha expirado y tu registro ha sido eliminado. Por favor regístrate nuevamente.'
      });
    }

    if (user.verificationKey !== cleanKey) {
      return sendJsonResponse(res, 400, { success: false, message: 'El código de seguridad ingresado es incorrecto.' });
    }

    if (user.keyExpiresAt && Date.now() > user.keyExpiresAt) {
      return sendJsonResponse(res, 400, { success: false, message: 'El código de seguridad ha expirado. Solicita uno nuevo.' });
    }

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: { isVerified: true },
        $unset: { verificationKey: '', keyExpiresAt: '', unverifiedExpiresAt: '' }
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
    return sendJsonResponse(res, 500, { success: false, message: 'Error al verificar cuenta: ' + (err ? err.message : err) });
  }
};
