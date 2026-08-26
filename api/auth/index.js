const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const { generateJwtToken } = require('../lib/auth-middleware');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, { error: 'Método no permitido' });
  }

  const url = req.url || '';
  const queryAction = req.query?.action;
  let action = queryAction;
  if (!action) {
    if (url.includes('/login') || url.includes('action=login')) action = 'login';
    else if (url.includes('/register') || url.includes('action=register')) action = 'register';
    else if (url.includes('/verify') || url.includes('action=verify')) action = 'verify';
    else if (url.includes('/resend') || url.includes('action=resend')) action = 'resend';
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }
  const payload = body || {};

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // Limpieza activa global: eliminar registros no verificados que hayan superado las 2 horas
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await usersCollection.deleteMany({
        isVerified: false,
        $or: [
          { createdAt: { $lt: twoHoursAgo } },
          { unverifiedExpiresAt: { $lt: new Date() } },
          { keyExpiresAt: { $lt: Date.now() } },
          { createdAt: { $exists: false } }
        ]
      });
    } catch (cleanupErr) {
      console.error('Error en limpieza activa de usuarios no verificados:', cleanupErr);
    }

    switch (action) {
      // ----------------------------------------------------
      // 1. INICIO DE SESIÓN (LOGIN)
      // ----------------------------------------------------
      case 'login': {
        const { email, password } = payload;
        if (!email || !password) {
          return sendJsonResponse(res, 400, { success: false, message: 'Por favor ingresa correo y contraseña' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const user = await usersCollection.findOne({ email: cleanEmail });
        if (!user) {
          return sendJsonResponse(res, 401, { success: false, message: 'Credenciales inválidas. Por favor verifica tu correo y contraseña.' });
        }

        let isMatch = false;
        if (user.passwordHash && (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$'))) {
          isMatch = await bcrypt.compare(password, user.passwordHash);
        } else {
          isMatch = user.passwordHash === Buffer.from(password).toString('base64');
          if (isMatch) {
            const salt = await bcrypt.genSalt(10);
            const newHash = await bcrypt.hash(password, salt);
            await usersCollection.updateOne({ _id: user._id }, { $set: { passwordHash: newHash } });
          }
        }

        if (!isMatch) {
          return sendJsonResponse(res, 401, { success: false, message: 'Credenciales inválidas. Por favor verifica tu correo y contraseña.' });
        }

        if (user.isActive === false) {
          return sendJsonResponse(res, 403, { success: false, message: 'Tu cuenta ha sido desactivada por un administrador del sistema.' });
        }

        if (!user.isVerified) {
          const createdAtMs = user.createdAt ? new Date(user.createdAt).getTime() : 0;
          const twoHoursMs = 2 * 60 * 60 * 1000;
          const isExpired = (Date.now() - createdAtMs) > twoHoursMs || (user.unverifiedExpiresAt && new Date(user.unverifiedExpiresAt).getTime() < Date.now());

          if (isExpired) {
            await usersCollection.deleteOne({ _id: user._id });
            return sendJsonResponse(res, 403, {
              success: false,
              message: 'El plazo de 2 horas para verificar tu cuenta ha expirado y tu registro ha sido eliminado. Por favor regístrate nuevamente.'
            });
          }

          return sendJsonResponse(res, 403, {
            success: false,
            requiresVerification: true,
            message: 'Tu cuenta requiere verificación por correo. Ingresa el código de 6 dígitos enviado.'
          });
        }

        const userRole = user.role || 'user';
        const userData = {
          id: user.id || user._id.toString(),
          name: user.name,
          email: user.email,
          role: userRole,
          isVerified: true,
          isActive: true,
          hasCompletedTutorial: user.hasCompletedTutorial || false
        };

        const token = generateJwtToken(userData, '7d');
        return sendJsonResponse(res, 200, {
          success: true,
          message: 'Inicio de sesión exitoso',
          token,
          user: userData
        });
      }

      // ----------------------------------------------------
      // 2. REGISTRO DE CUENTA (REGISTER)
      // ----------------------------------------------------
      case 'register': {
        const { name, email, password } = payload;
        if (!name || !email || !password) {
          return sendJsonResponse(res, 400, { success: false, message: 'Todos los campos son obligatorios' });
        }

        if (password.length < 6) {
          return sendJsonResponse(res, 400, { success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Crear índice TTL automático para eliminar usuarios no verificados tras 2 horas si aún no existe
        try {
          await usersCollection.createIndex({ unverifiedExpiresAt: 1 }, { expireAfterSeconds: 0 });
        } catch (e) {}

        // Limpieza activa: eliminar registros no verificados que hayan superado las 2 horas
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        await usersCollection.deleteMany({
          isVerified: false,
          $or: [
            { createdAt: { $lt: twoHoursAgo } },
            { unverifiedExpiresAt: { $lt: new Date() } }
          ]
        });

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
        const twoHoursMs = 2 * 60 * 60 * 1000;
        const expiresAt = Date.now() + twoHoursMs;
        const unverifiedExpiresAt = new Date(Date.now() + twoHoursMs);

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
          unverifiedExpiresAt: unverifiedExpiresAt,
          createdAt: new Date().toISOString(),
          hasCompletedTutorial: false
        };

        if (existingUser) {
          await usersCollection.updateOne({ email: cleanEmail }, { $set: userDoc });
        } else {
          await usersCollection.insertOne(userDoc);
        }

        // Enviar correo de verificación mediante EmailJS desde el backend
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
                  expire_time: '2 horas'
                }
              })
            });
          }
        } catch (e) {}

        return sendJsonResponse(res, 201, {
          success: true,
          message: `Cuenta creada exitosamente. Se ha enviado un código de acceso a ${cleanEmail} con validez de 2 horas. Si no se verifica en 2 horas, la cuenta será eliminada.`,
          email: cleanEmail,
          securityKey,
          keyExpiresAt: expiresAt
        });
      }

      // ----------------------------------------------------
      // 3. VERIFICACIÓN DE CUENTA (VERIFY)
      // ----------------------------------------------------
      case 'verify': {
        const { email, key } = payload;
        if (!email || !key) {
          return sendJsonResponse(res, 400, { success: false, message: 'Correo y código son requeridos' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanKey = key.toString().trim();

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
      }

      // ----------------------------------------------------
      // 4. REENVÍO DE CÓDIGO (RESEND)
      // ----------------------------------------------------
      case 'resend': {
        const { email } = payload;
        if (!email) {
          return sendJsonResponse(res, 400, { success: false, message: 'El correo electrónico es requerido' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const user = await usersCollection.findOne({ email: cleanEmail });
        if (!user) {
          return sendJsonResponse(res, 404, { success: false, message: 'Usuario no encontrado' });
        }

        if (user.isVerified) {
          return sendJsonResponse(res, 400, { success: false, message: 'Esta cuenta ya está verificada. Procede al inicio de sesión.' });
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

        const securityKey = Math.floor(100000 + Math.random() * 900000).toString();
        const remainingTime = Math.max(0, (createdAtMs + twoHoursMs) - Date.now());
        const expiresAt = Date.now() + Math.min(60 * 60 * 1000, remainingTime);

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
                  expire_time: '2 horas'
                }
              })
            });
          }
        } catch (e) {}

        return sendJsonResponse(res, 200, {
          success: true,
          message: `Se ha enviado un nuevo código de acceso a ${cleanEmail} con validez de 2 horas.`,
          keyExpiresAt: expiresAt
        });
      }

      default:
        return sendJsonResponse(res, 404, { success: false, message: 'Acción de autenticación no válida.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error interno en autenticación: ' + (err ? err.message : err) });
  }
};
