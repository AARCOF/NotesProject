import { MongoClient, Db } from 'mongodb';

// En Vercel se configura MONGODB_URI en Settings > Environment Variables
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || '';
const DB_NAME = process.env.DB_NAME || 'noteyou_production';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI no está configurada en las variables de entorno de Vercel');
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Función auxiliar para respuestas JSON con CORS habilitado para Web y APK
export function sendJsonResponse(res: any, statusCode: number, data: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(statusCode).json(data);
}
