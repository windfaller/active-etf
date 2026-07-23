import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let database: Db | null = null;
let databaseName: string | null = null;

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? "taiwan_active_etf";

  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  if (database && databaseName === dbName) {
    return database;
  }

  if (!clientPromise) {
    const pendingClient = new MongoClient(uri);
    clientPromise = pendingClient.connect().then(
      (connectedClient) => {
        client = connectedClient;
        return connectedClient;
      },
      (error) => {
        clientPromise = null;
        throw error;
      }
    );
  }

  const connectedClient = await clientPromise;
  database = connectedClient.db(dbName);
  databaseName = dbName;
  return database;
}

export async function closeDb(): Promise<void> {
  const connectedClient = client ?? await clientPromise?.catch(() => null);
  client = null;
  clientPromise = null;
  database = null;
  databaseName = null;
  if (connectedClient) await connectedClient.close();
}
