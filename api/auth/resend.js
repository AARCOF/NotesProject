const { connectToDatabase, sendJsonResponse } = require('../lib/db');

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
    const { email } = body || {};

    if (!email) {
      return sendJsonResponse(res, 400, { success: false, message: 'El correo electrónico es requerido' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: cleanEmail });
    if (!user) {
      return sendJsonResponse(res, 404, { success: false, message: 'Usuario no encontrado' });
    }

    if (user.isVerified) {
      return sendJsonResponse(res, 400, { success: false, message: 'Esta cuenta ya está verificada. Procede al inicio de sesión.' });
    }

    const securityKey = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 60 * 60 * 1000;

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          verificationKey: securityKey,
          keyExpiresAt: expiresAt
        }
      }
    );

    // Enviar correo a través de EmailJS
    try {
      if (typeof fetch !== 'undefined') {
        await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: 'NoteYou_er',
            template_id: 'template_01akdg7',
            user_id: 'NJyM41WnepByrp24u',
            template_params: {
              to_email: cleanEmail,
              security_key: securityKey,
              expire_time: '1 hora'
            }
          })
        });
      }
    } catch (e) {}

    return sendJsonResponse(res, 200, {
      success: true,
      message: `Se ha enviado un nuevo código de acceso a ${cleanEmail} con validez de 1 hora.`,
      keyExpiresAt: expiresAt
    });
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error al reenviar código: ' + (err ? err.message : err) });
  }
};
