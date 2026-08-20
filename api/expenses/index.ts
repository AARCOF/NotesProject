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

  try {
    const { db } = await connectToDatabase();
    const expensesCollection = db.collection('user_expenses');
    const userId = authUser.sub;

    switch (req.method) {
      case 'GET': {
        const userExpenseDoc = await expensesCollection.findOne({ userId });
        const data = userExpenseDoc || {
          userId,
          categories: [],
          expenses: [],
          monthlyIncomes: []
        };
        return sendJsonResponse(res, 200, { success: true, data });
      }

      case 'POST': {
        const payload = req.body;
        const result = await expensesCollection.updateOne(
          { userId },
          {
            $set: {
              userId,
              categories: payload.categories || [],
              expenses: payload.expenses || [],
              monthlyIncomes: payload.monthlyIncomes || [],
              updatedAt: new Date().toISOString()
            }
          },
          { upsert: true }
        );

        return sendJsonResponse(res, 200, { success: true, message: 'Datos financieros actualizados en la nube.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err: any) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en finanzas: ' + err.message });
  }
}
