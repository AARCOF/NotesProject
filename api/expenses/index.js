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
          baseMonthlyIncome: data ? data.baseMonthlyIncome || 0 : 0,
          currency: data ? data.currency || 'S/.' : 'S/.'
        });
      }

      case 'POST':
      case 'PUT': {
        const payload = body || {};
        delete payload._id;

        const cleanList = (arr) => Array.isArray(arr) ? arr.map(item => {
          if (item && typeof item === 'object') {
            const { _id, ...rest } = item;
            return rest;
          }
          return item;
        }) : [];

        const cleanExpenses = cleanList(payload.expenses);
        const cleanBudgets = cleanList(payload.budgets);
        const cleanExtraIncomes = cleanList(payload.extraIncomes);
        const cleanCategories = cleanList(payload.categories);
        const cleanSubcategories = cleanList(payload.subcategories);

        await expensesCollection.updateOne(
          { userId },
          {
            $set: {
              userId,
              expenses: cleanExpenses,
              budgets: cleanBudgets,
              extraIncomes: cleanExtraIncomes,
              categories: cleanCategories,
              subcategories: cleanSubcategories,
              baseMonthlyIncome: Number(payload.baseMonthlyIncome) || 0,
              currency: payload.currency ? String(payload.currency).trim() : 'S/.',
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
