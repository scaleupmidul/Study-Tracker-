import { MongoClient, Db, Collection } from 'mongodb';
import crypto from 'crypto';
import { Session } from '../src/types';
import { INITIAL_SESSIONS } from '../src/data';

// Globally cache the MongoDB client and database connections across serverless function invocations
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// Fallback in-memory storage for when MONGODB_URI is not provided
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
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI or MONGO_URI environment variable is missing! Falling back to in-memory storage.');
    return null;
  }

  if (cachedClient && cachedDb) {
    return {
      client: cachedClient,
      db: cachedDb,
      sessionsCollection: cachedDb.collection<Session>('sessions')
    };
  }

  try {
    // Optimize MongoDB connection settings for serverless/Vercel environments:
    // 1. family: 4 forces IPv4 to bypass slow or blocked IPv6 DNS resolution lookups on serverless
    // 2. connectTimeoutMS: 4000ms ensures we fail fast if blocked by network constraints
    // 3. serverSelectionTimeoutMS: 4000ms ensures queries fail quickly if DB is unreachable
    // 4. socketTimeoutMS: 5000ms prevents long-hanging requests
    // 5. maxPoolSize: 1 minimizes connection count overhead across dynamic serverless instances
    const clientInstance = new MongoClient(uri, {
      family: 4,
      connectTimeoutMS: 4000,
      serverSelectionTimeoutMS: 4000,
      socketTimeoutMS: 5000,
      maxPoolSize: 1,
    });

    // In modern MongoDB NodeJS driver (v4+), calling explicit .connect() is optional.
    // By omitting explicit await clientInstance.connect(), we avoid blocking the startup phase,
    // and let the driver lazily and safely connect when the first database operation is performed.
    const dbInstance = clientInstance.db();
    
    cachedClient = clientInstance;
    cachedDb = dbInstance;
    
    console.log('✅ Connected successfully to MongoDB (lazy)');
    return {
      client: clientInstance,
      db: dbInstance,
      sessionsCollection: dbInstance.collection<Session>('sessions')
    };
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    cachedClient = null;
    cachedDb = null;
    return null;
  }
}

// --- USER AUTHENTICATION LOGIC ---
export async function registerUser(username: string, password: string) {
  const dbObj = await getDb();
  if (!dbObj || !dbObj.db) {
    throw new Error('Database connection failed. Please verify that: 1) your MONGODB_URI is correctly configured in your Vercel Environment Variables, 2) your MongoDB Atlas IP Access List is set to allow access from anywhere (0.0.0.0/0) to accept Vercel\'s dynamic serverless IPs, and 3) special characters in your password are properly URL-encoded.');
  }
  
  const usersCollection = dbObj.db.collection('users');
  const normalizedUsername = username.trim().toLowerCase();
  
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
}

export async function loginUser(username: string, password: string) {
  const dbObj = await getDb();
  if (!dbObj || !dbObj.db) {
    throw new Error('Database connection failed. Please verify that: 1) your MONGODB_URI is correctly configured in your Vercel Environment Variables, 2) your MongoDB Atlas IP Access List is set to allow access from anywhere (0.0.0.0/0) to accept Vercel\'s dynamic serverless IPs, and 3) special characters in your password are properly URL-encoded.');
  }
  
  const usersCollection = dbObj.db.collection('users');
  const normalizedUsername = username.trim().toLowerCase();
  
  const user = await usersCollection.findOne({ username: normalizedUsername });
  if (!user) {
    throw new Error('Invalid username or password.');
  }
  
  const passwordHash = hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    throw new Error('Invalid username or password.');
  }
  
  return { id: user.id, username: user.username };
}

export async function getUserById(userId: string) {
  const dbObj = await getDb();
  if (!dbObj || !dbObj.db) return null;
  
  const usersCollection = dbObj.db.collection('users');
  const user = await usersCollection.findOne({ id: userId });
  if (!user) return null;
  return { id: user.id, username: user.username };
}

// --- SESSIONS LOGIC PER USER ---
export async function fetchSessions(userId: string): Promise<Session[]> {
  const dbObj = await getDb();
  if (dbObj && dbObj.sessionsCollection) {
    try {
      const docs = await dbObj.sessionsCollection.find({ userId }).toArray();
      // Seed initial sessions for this user if they don't have any sessions yet
      if (docs.length === 0) {
        console.log(`🌱 Seeding initial sessions for user ${userId} in MongoDB...`);
        const userInitial = INITIAL_SESSIONS.map((s, index) => ({
          ...s,
          id: `s-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
          userId
        }));
        await dbObj.sessionsCollection.insertMany(userInitial);
        return userInitial;
      }
      return docs.map(doc => {
        const { _id, ...sessionData } = doc as any;
        return sessionData as Session;
      });
    } catch (e) {
      console.error('Failed to fetch from MongoDB, falling back to in-memory:', e);
    }
  }
  
  // In-memory fallback
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

export async function addSession(session: Session, userId: string): Promise<Session> {
  const dbObj = await getDb();
  const sessionWithUser = { ...session, userId };
  if (dbObj && dbObj.sessionsCollection) {
    try {
      await dbObj.sessionsCollection.insertOne({ ...sessionWithUser } as any);
      return sessionWithUser;
    } catch (e) {
      console.error('Failed to insert to MongoDB, using in-memory:', e);
    }
  }
  inMemorySessions.push(sessionWithUser);
  return sessionWithUser;
}

export async function deleteSession(id: string, userId: string): Promise<boolean> {
  const dbObj = await getDb();
  if (dbObj && dbObj.sessionsCollection) {
    try {
      const result = await dbObj.sessionsCollection.deleteOne({ id, userId });
      return result.deletedCount > 0;
    } catch (e) {
      console.error('Failed to delete from MongoDB, using in-memory:', e);
    }
  }
  const index = inMemorySessions.findIndex(s => s.id === id && s.userId === userId);
  if (index !== -1) {
    inMemorySessions.splice(index, 1);
    return true;
  }
  return false;
}

export async function resetSessions(userId: string): Promise<boolean> {
  const dbObj = await getDb();
  if (dbObj && dbObj.sessionsCollection) {
    try {
      await dbObj.sessionsCollection.deleteMany({ userId });
      const userInitial = INITIAL_SESSIONS.map((s, index) => ({
        ...s,
        id: `s-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
        userId
      }));
      await dbObj.sessionsCollection.insertMany(userInitial);
      return true;
    } catch (e) {
      console.error('Failed to reset MongoDB, resetting in-memory:', e);
    }
  }
  inMemorySessions = inMemorySessions.filter(s => s.userId !== userId);
  const userInitial = INITIAL_SESSIONS.map((s, index) => ({
    ...s,
    id: `s-${Date.now()}-${index}`,
    userId
  }));
  inMemorySessions.push(...userInitial);
  return true;
}
