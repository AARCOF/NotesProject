import { connectToDatabase, sendJsonResponse } from './lib/db';

export default async function handler(req: any, res: any) {
  try {
    const { db } = await connectToDatabase();
    const collections = await db.listCollections().toArray();
    return sendJsonResponse(res, 200, {
      status: 'ok',
      connected: true,
      collections: collections.map(c => c.name)
    });
  } catch (err: any) {
    return sendJsonResponse(res, 500, {
      status: 'error',
      connected: false,
      message: (err as any)?.message || 'Database connection error'
    });
  }
}
