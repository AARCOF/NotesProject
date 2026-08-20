const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const bcrypt = require('bcryptjs');

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
    const { name, email, password } = body || {};

    if (!name || !email || !password) {
      return sendJsonResponse(res, 400, { success: false, message: 'Todos los campos son obligatorios' });
    }

    if (password.length < 6) {
      return sendJsonResponse(res, 400, { success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email: cleanEmail });
    if (existingUser && existingUser.isVerified) {
      return sendJsonResponse(res, 400, {
        success: false,
        message: 'Este correo electrónico ya está registrado y verificado. Procede al inicio de sesión.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const securityKey = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 60 * 60 * 1000;

    const assignedRole = cleanEmail === 'superadmin@noteyou.com' ? 'superadmin' : 'user';
    const userId = existingUser ? existingUser.id || existingUser._id.toString() : 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const userDoc = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: assignedRole,
      isVerified: false,
      isActive: true,
      verificationKey: securityKey,
      keyExpiresAt: expiresAt,
      createdAt: new Date().toISOString(),
      hasCompletedTutorial: false
    };

    if (existingUser) {
      await usersCollection.updateOne({ email: cleanEmail }, { $set: userDoc });
    } else {
      await usersCollection.insertOne(userDoc);
    }

    return sendJsonResponse(res, 201, {
      success: true,
      message: `Cuenta creada exitosamente. Se ha enviado un código de acceso a ${cleanEmail} válido por 1 hora.`,
      email: cleanEmail
    });
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error interno del servidor: ' + (err ? err.message : err) });
  }
};
