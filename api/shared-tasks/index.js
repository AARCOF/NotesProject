const { connectToDatabase, sendJsonResponse } = require('../lib/db');
const { verifyAuthToken } = require('../lib/auth-middleware');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJsonResponse(res, 200, { ok: true });
  }

  const authUser = verifyAuthToken(req);
  if (!authUser) {
    return sendJsonResponse(res, 401, { success: false, message: 'No autorizado. Token inválido o ausente.' });
  }

  try {
    const { db } = await connectToDatabase();
    const spacesCollection = db.collection('shared_spaces');
    const tasksCollection = db.collection('shared_tasks');
    const notifsCollection = db.collection('shared_notifications');

    const userId = authUser.sub;
    const isAdmin = authUser.role === 'admin' || authUser.role === 'superadmin';

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    switch (req.method) {
      case 'GET': {
        const userEmail = (authUser.email || '').toLowerCase().trim();
        const spaceQuery = isAdmin ? {} : {
          $or: [
            { createdBy: userId },
            { participantIds: userId },
            { participantIds: { $in: [userId] } },
            { participantEmails: userEmail },
            { [`participantEmails.${userId}`]: { $exists: true } }
          ]
        };
        const spaces = await spacesCollection.find(spaceQuery).sort({ createdAt: -1 }).toArray();
        const spaceIds = spaces.map(s => s.id);

        // Obtenemos las tareas asociadas a dichos espacios
        const taskQuery = isAdmin ? {} : { spaceId: { $in: spaceIds } };
        const tasks = spaceIds.length > 0 || isAdmin 
          ? await tasksCollection.find(taskQuery).sort({ createdAt: -1 }).toArray()
          : [];

        // Obtenemos las notificaciones del usuario
        const notifs = await notifsCollection.find({
          $or: [
            { recipientId: userId },
            { senderId: userId }
          ]
        }).sort({ createdAt: -1 }).toArray();

        return sendJsonResponse(res, 200, {
          success: true,
          spaces: spaces.map(s => { delete s._id; return s; }),
          tasks: tasks.map(t => { delete t._id; return t; }),
          notifications: notifs.map(n => { delete n._id; return n; })
        });
      }

      case 'POST': {
        const payload = body || {};
        const type = payload.type || 'task';

        if (type === 'space') {
          const spaceData = payload.data || payload;
          if (!spaceData.title) {
            return sendJsonResponse(res, 400, { success: false, message: 'Título del espacio es requerido.' });
          }
          const { _id, ...cleanSpace } = spaceData;
          cleanSpace.id = cleanSpace.id || 'space_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          cleanSpace.createdAt = cleanSpace.createdAt || new Date().toISOString();

          await spacesCollection.updateOne(
            { id: cleanSpace.id },
            { $set: cleanSpace },
            { upsert: true }
          );
          return sendJsonResponse(res, 201, { success: true, space: cleanSpace });
        }

        if (type === 'task') {
          const taskData = payload.data || payload;
          if (!taskData.title || !taskData.spaceId) {
            return sendJsonResponse(res, 400, { success: false, message: 'Título y espacio son requeridos para la tarea.' });
          }
          const { _id, ...cleanTask } = taskData;
          cleanTask.id = cleanTask.id || 'stask_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          cleanTask.createdAt = cleanTask.createdAt || new Date().toISOString();
          cleanTask.updatedAt = cleanTask.updatedAt || new Date().toISOString();

          await tasksCollection.updateOne(
            { id: cleanTask.id },
            { $set: cleanTask },
            { upsert: true }
          );
          return sendJsonResponse(res, 201, { success: true, task: cleanTask });
        }

        if (type === 'notification') {
          const notifData = payload.data || payload;
          const { _id, ...cleanNotif } = notifData;
          cleanNotif.id = cleanNotif.id || 'snotif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          cleanNotif.createdAt = cleanNotif.createdAt || new Date().toISOString();

          await notifsCollection.updateOne(
            { id: cleanNotif.id },
            { $set: cleanNotif },
            { upsert: true }
          );
          return sendJsonResponse(res, 201, { success: true, notification: cleanNotif });
        }

        if (type === 'bulk_sync') {
          const { spaces = [], tasks = [], notifications = [] } = payload;
          for (const s of spaces) {
            const { _id, ...clean } = s;
            await spacesCollection.updateOne({ id: clean.id }, { $set: clean }, { upsert: true });
          }
          for (const t of tasks) {
            const { _id, ...clean } = t;
            await tasksCollection.updateOne({ id: clean.id }, { $set: clean }, { upsert: true });
          }
          for (const n of notifications) {
            const { _id, ...clean } = n;
            await notifsCollection.updateOne({ id: clean.id }, { $set: clean }, { upsert: true });
          }
          return sendJsonResponse(res, 200, { success: true, message: 'Sincronización masiva completada.' });
        }

        return sendJsonResponse(res, 400, { success: false, message: 'Tipo no reconocido.' });
      }

      case 'PUT': {
        const payload = body || {};
        const type = payload.type || 'task';
        const itemData = payload.data || payload;

        if (!itemData.id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID es obligatorio para actualizar.' });
        }

        const { _id, ...cleanData } = itemData;

        if (type === 'space') {
          await spacesCollection.updateOne(
            { id: cleanData.id },
            { $set: cleanData },
            { upsert: true }
          );
          return sendJsonResponse(res, 200, { success: true, space: cleanData });
        }

        if (type === 'task') {
          cleanData.updatedAt = new Date().toISOString();
          await tasksCollection.updateOne(
            { id: cleanData.id },
            { $set: cleanData },
            { upsert: true }
          );
          return sendJsonResponse(res, 200, { success: true, task: cleanData });
        }

        if (type === 'notification') {
          await notifsCollection.updateOne(
            { id: cleanData.id },
            { $set: cleanData },
            { upsert: true }
          );
          return sendJsonResponse(res, 200, { success: true, notification: cleanData });
        }

        return sendJsonResponse(res, 400, { success: false, message: 'Tipo no soportado.' });
      }

      case 'DELETE': {
        let type = req.query ? req.query.type : null;
        let id = req.query ? req.query.id : null;

        if (!id && req.url && req.url.includes('id=')) {
          const parts = req.url.split('id=');
          id = parts[1] ? parts[1].split('&')[0] : null;
        }
        if (!type && req.url && req.url.includes('type=')) {
          const parts = req.url.split('type=');
          type = parts[1] ? parts[1].split('&')[0] : null;
        }
        if (!id && req.body && req.body.id) {
          id = req.body.id;
          type = req.body.type || type;
        }

        if (!id) {
          return sendJsonResponse(res, 400, { success: false, message: 'ID es requerido para eliminar.' });
        }

        if (type === 'space') {
          await spacesCollection.deleteOne({ id: id.toString() });
          await tasksCollection.deleteMany({ spaceId: id.toString() });
          return sendJsonResponse(res, 200, { success: true, message: 'Espacio y tareas asociadas eliminados.' });
        }

        if (type === 'task') {
          await tasksCollection.deleteOne({ id: id.toString() });
          return sendJsonResponse(res, 200, { success: true, message: 'Tarea compartida eliminada.' });
        }

        if (type === 'notification') {
          await notifsCollection.deleteOne({ id: id.toString() });
          return sendJsonResponse(res, 200, { success: true, message: 'Notificación eliminada.' });
        }

        // Por defecto eliminamos de tareas si no se especificó tipo
        await tasksCollection.deleteOne({ id: id.toString() });
        return sendJsonResponse(res, 200, { success: true, message: 'Elemento eliminado.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en servidor de tareas compartidas: ' + (err ? err.message : err) });
  }
};
