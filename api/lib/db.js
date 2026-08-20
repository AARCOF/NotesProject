const { MongoClient } = require('mongodb');

const CORRECT_URI = 'mongodb+srv://acaf504082_db_user:4gWF3FzDgb6pupsm@cluster0.1gpwhkf.mongodb.net/noteyou?retryWrites=true&w=majority&appName=Cluster0';

let rawUri = process.env.MONGODB_URI || process.env.DATABASE_URL || CORRECT_URI;

// Si en Vercel se guardó una URI sin el subdominio 1gpwhkf, forzar la URI exacta del clúster
if (!rawUri.includes('1gpwhkf')) {
  rawUri = CORRECT_URI;
}

const MONGODB_URI = rawUri;
const DB_NAME = process.env.DB_NAME || 'noteyou_production';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });

  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

function sendJsonResponse(res, statusCode, data) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } catch (e) {}

  if (res && typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }

  if (res) {
    res.statusCode = statusCode;
    try {
      res.setHeader('Content-Type', 'application/json');
    } catch (e) {}
    return res.end(JSON.stringify(data));
  }
}

module.exports = {
  connectToDatabase,
  sendJsonResponse
};
