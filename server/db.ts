import { MongoClient, Db, Collection } from 'mongodb';
import crypto from 'crypto';
import { Session } from '../src/types';
import { INITIAL_SESSIONS } from '../src/data';

let client: MongoClient | null = null;
let db: Db | null = null;
let sessionsCollection: Collection<Session> | null = null;

// Fallback in-memory storage for when MongoDB is unreachable or MONGODB_URI is not provided
interface InMemoryUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: Date;
}

let inMemoryUsers: InMemoryUser[] = [];
let inMemorySessions: Session[] = [];

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-deep-focus-german-app';

// Helper to hash password
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Token functions
export function createToken(userId: string): string {
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(userId).digest('hex');
  return `${userId}.${signature}`;
}

export function verifyToken(token: string): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [userId, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(userId).digest('hex');
  if (signature === expectedSignature) {
    return userId;
  }
  return null;
}

export async function getDb() {
  let uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI or MONGO_URI environment variable is missing! Falling back to in-memory storage.');
    return null;
  }

  // Sanitizing potential quotes around URI (extremely common copy-paste issue on Vercel)
  uri = uri.trim();
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }

  if (!client) {
    try {
      console.log('Connecting to MongoDB...');
      client = new MongoClient(uri, {
        connectTimeoutMS: 3000,
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 3000,
        maxPoolSize: 10,
        minPoolSize: 0
      });
      
      await client.connect();
      db = client.db();
      sessionsCollection = db.collection<Session>('sessions');
      console.log('✅ Connected successfully to MongoDB');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      client = null;
      db = null;
      sessionsCollection = null;
      return null;
    }
  }

  return { client, db, sessionsCollection };
}

// Generic runner with fallback and a strict 4-second timeout to prevent serverless function hanging
async function runWithFallback<T>(
  mongoOp: (dbObj: { client: MongoClient; db: Db; sessionsCollection: Collection<Session> }) => Promise<T>,
  fallbackOp: () => Promise<T>
): Promise<T> {
  const timeoutMs = 4000; // Strict 4 seconds timeout for connection + operation
  let timeoutId: NodeJS.Timeout | null = null;

  const runMongoProcess = async (): Promise<T> => {
    const dbObj = await getDb();
    if (dbObj && dbObj.db && dbObj.sessionsCollection) {
      return await mongoOp(dbObj as any);
    }
    throw new Error('MongoDB database not available');
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('MongoDB operation or connection timed out'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      runMongoProcess(),
      timeoutPromise
    ]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    console.error('⚠️ MongoDB operation failed or timed out, falling back to in-memory:', error);
  }
  
  return await fallbackOp();
}

// --- USER AUTHENTICATION LOGIC ---
export async function registerUser(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();

  return runWithFallback(
    async (dbObj) => {
      const usersCollection = dbObj.db.collection('users');
      const existing = await usersCollection.findOne({ username: normalizedUsername });
      if (existing) {
        throw new Error('Username already exists. Please choose another.');
      }
      
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const userId = `u-${Date.now()}`;
      
      const newUser = {
        id: userId,
        username: normalizedUsername,
        passwordHash,
        salt,
        createdAt: new Date()
      };
      
      await usersCollection.insertOne(newUser);
      return { id: userId, username: normalizedUsername };
    },
    async () => {
      const existing = inMemoryUsers.find(u => u.username === normalizedUsername);
      if (existing) {
        throw new Error('Username already exists. Please choose another.');
      }
      
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const userId = `u-${Date.now()}`;
      
      const newUser = {
        id: userId,
        username: normalizedUsername,
        passwordHash,
        salt,
        createdAt: new Date()
      };
      
      inMemoryUsers.push(newUser);
      return { id: userId, username: normalizedUsername, isFallback: true };
    }
  );
}

export async function loginUser(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();

  return runWithFallback(
    async (dbObj) => {
      const usersCollection = dbObj.db.collection('users');
      const user = await usersCollection.findOne({ username: normalizedUsername });
      if (!user) {
        throw new Error('Invalid username or password.');
      }
      
      const passwordHash = hashPassword(password, user.salt);
      if (passwordHash !== user.passwordHash) {
        throw new Error('Invalid username or password.');
      }
      
      return { id: user.id, username: user.username };
    },
    async () => {
      const user = inMemoryUsers.find(u => u.username === normalizedUsername);
      if (!user) {
        throw new Error('Invalid username or password.');
      }
      
      const passwordHash = hashPassword(password, user.salt);
      if (passwordHash !== user.passwordHash) {
        throw new Error('Invalid username or password.');
      }
      
      return { id: user.id, username: user.username, isFallback: true };
    }
  );
}

export async function getUserById(userId: string) {
  return runWithFallback(
    async (dbObj) => {
      const usersCollection = dbObj.db.collection('users');
      const user = await usersCollection.findOne({ id: userId });
      if (!user) return null;
      return { id: user.id, username: user.username };
    },
    async () => {
      const user = inMemoryUsers.find(u => u.id === userId);
      if (!user) return null;
      return { id: user.id, username: user.username, isFallback: true };
    }
  );
}

// --- SESSIONS LOGIC PER USER ---
export async function fetchSessions(userId: string): Promise<Session[]> {
  return runWithFallback(
    async (dbObj) => {
      const docs = await dbObj.sessionsCollection.find({ userId }).toArray();
      if (docs.length === 0) {
        console.log(`🌱 Seeding initial sessions for user ${userId} in MongoDB...`);
        const userInitial = INITIAL_SESSIONS.map((s, index) => ({
          ...s,
          id: `s-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
          userId
        }));
        await dbObj.sessionsCollection.insertMany(userInitial);
        return userInitial;
      }
      return docs.map(doc => {
        const { _id, ...sessionData } = doc as any;
        return sessionData as Session;
      });
    },
    async () => {
      const userSessions = inMemorySessions.filter(s => s.userId === userId);
      if (userSessions.length === 0) {
        const userInitial = INITIAL_SESSIONS.map((s, index) => ({
          ...s,
          id: `s-${Date.now()}-${index}`,
          userId
        }));
        inMemorySessions.push(...userInitial);
        return userInitial;
      }
      return userSessions;
    }
  );
}

export async function addSession(session: Session, userId: string): Promise<Session> {
  const sessionWithUser = { ...session, userId };
  return runWithFallback(
    async (dbObj) => {
      await dbObj.sessionsCollection.insertOne({ ...sessionWithUser } as any);
      return sessionWithUser;
    },
    async () => {
      inMemorySessions.push(sessionWithUser);
      return sessionWithUser;
    }
  );
}

export async function deleteSession(id: string, userId: string): Promise<boolean> {
  return runWithFallback(
    async (dbObj) => {
      const result = await dbObj.sessionsCollection.deleteOne({ id, userId });
      return result.deletedCount > 0;
    },
    async () => {
      const index = inMemorySessions.findIndex(s => s.id === id && s.userId === userId);
      if (index !== -1) {
        inMemorySessions.splice(index, 1);
        return true;
      }
      return false;
    }
  );
}

export async function resetSessions(userId: string): Promise<boolean> {
  return runWithFallback(
    async (dbObj) => {
      await dbObj.sessionsCollection.deleteMany({ userId });
      const userInitial = INITIAL_SESSIONS.map((s, index) => ({
        ...s,
        id: `s-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        userId
      }));
      await dbObj.sessionsCollection.insertMany(userInitial);
      return true;
    },
    async () => {
      inMemorySessions = inMemorySessions.filter(s => s.userId !== userId);
      const userInitial = INITIAL_SESSIONS.map((s, index) => ({
        ...s,
        id: `s-${Date.now()}-${index}`,
        userId
      }));
      inMemorySessions.push(...userInitial);
      return true;
    }
  );
}
