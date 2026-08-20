import { connectToDatabase, sendJsonResponse } from '../lib/db';
import { generateJwtToken } from '../lib/auth-middleware';
import * as bcrypt from 'bcryptjs';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, { error: 'Método no permitido' });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return sendJsonResponse(res, 400, { success: false, message: 'Por favor ingresa correo y contraseña' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: cleanEmail });
    if (!user) {
      return sendJsonResponse(res, 401, { success: false, message: 'Credenciales inválidas. Por favor verifica tu correo y contraseña.' });
    }

    // Comparación segura con bcrypt
    let isMatch = false;
    if (user.passwordHash && (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$'))) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } else {
      // Compatibilidad con contraseñas legadas Base64
      isMatch = user.passwordHash === btoa(password);
      if (isMatch) {
        // Auto-actualizar al vuelo a hash seguro bcrypt
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
      return sendJsonResponse(res, 403, {
        success: false,
        requiresVerification: true,
        message: 'Tu cuenta requiere verificación por correo. Ingresa el código de 6 dígitos enviado.'
      });
    }

    // Auto-elevación a superadmin para acaf504082@gmail.com si aún no lo tiene
    let userRole = user.role;
    if (cleanEmail === 'acaf504082@gmail.com' && userRole !== 'superadmin') {
      userRole = 'superadmin';
      await usersCollection.updateOne({ _id: user._id }, { $set: { role: 'superadmin' } });
    }

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
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error interno del servidor: ' + (err as any)?.message });
  }
}
