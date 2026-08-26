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
    const expensesCollection = db.collection('expenses');
    const userId = authUser.sub;

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    switch (req.method) {
      case 'GET': {
        const data = await expensesCollection.findOne({ userId });
        return sendJsonResponse(res, 200, {
          success: true,
          expenses: data ? data.expenses || [] : [],
          budgets: data ? data.budgets || [] : [],
          extraIncomes: data ? data.extraIncomes || [] : [],
          categories: data ? data.categories || [] : [],
          subcategories: data ? data.subcategories || [] : [],
          baseMonthlyIncome: data ? data.baseMonthlyIncome || 0 : 0
        });
      }

      case 'POST':
      case 'PUT': {
        const payload = body || {};
        await expensesCollection.updateOne(
          { userId },
          {
            $set: {
              userId,
              expenses: payload.expenses || [],
              budgets: payload.budgets || [],
              extraIncomes: payload.extraIncomes || [],
              categories: payload.categories || [],
              subcategories: payload.subcategories || [],
              baseMonthlyIncome: Number(payload.baseMonthlyIncome) || 0,
              updatedAt: new Date().toISOString()
            }
          },
          { upsert: true }
        );

        return sendJsonResponse(res, 200, { success: true, message: 'Datos de pagos y finanzas sincronizados.' });
      }

      default:
        return sendJsonResponse(res, 405, { error: 'Método no soportado.' });
    }
  } catch (err) {
    return sendJsonResponse(res, 500, { success: false, message: 'Error en finanzas: ' + (err ? err.message : err) });
  }
};
