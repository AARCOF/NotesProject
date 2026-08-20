import { connectToDatabase, sendJsonResponse } from '../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, { error: 'Método no permitido' });
  }

  try {
    const { name, email, password } = req.body || {};

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

    // Hash seguro con bcrypt (unidireccional e irreversible)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Llave de verificación de 6 dígitos
    const securityKey = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hora de validez

    const assignedRole = cleanEmail === 'acaf504082@gmail.com' ? 'superadmin' : 'user';

    const userId = existingUser ? existingUser._id.toString() : 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

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

    // Envío de correo mediante EmailJS API desde el servidor
    try {
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
    } catch (emailErr) {
      // Continúa aunque falle el servicio externo de correo
    }

    return sendJsonResponse(res, 201, {
      success: true,
      message: `Cuenta creada exitosamente. Se ha enviado un código de acceso a ${cleanEmail} válido por 1 hora.`,
      email: cleanEmail
    });
  } catch (err: any) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error interno del servidor: ' + err.message });
  }
}
