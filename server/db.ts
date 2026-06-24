import { MongoClient, Db, Collection } from 'mongodb';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Session } from '../src/types';
import { INITIAL_SESSIONS } from '../src/data';

interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface LocalDbData {
  users: UserRecord[];
  sessions: Session[];
}

let client: MongoClient | null = null;
let db: Db | null = null;
let sessionsCollection: Collection<Session> | null = null;

const LOCAL_DB_PATH = path.join(process.cwd(), '.local_db.json');

function loadLocalDb(): LocalDbData {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('⚠️ Failed to load local DB file:', e);
  }
  return { users: [], sessions: [] };
}

function saveLocalDb(data: LocalDbData) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('⚠️ Failed to save local DB file:', e);
  }
}

let localDb = loadLocalDb();

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
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<username>') || uri.includes('<cluster>')) {
    return null;
  }

  if (!client) {
    try {
      client = new MongoClient(uri, {
        connectTimeoutMS: 3000,
        serverSelectionTimeoutMS: 3000
      });
      await client.connect();
      db = client.db();
      sessionsCollection = db.collection<Session>('sessions');
      console.log('✅ Connected successfully to MongoDB');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB, using local file persistence:', error);
      client = null;
      db = null;
      sessionsCollection = null;
      return null;
    }
  }

  return { client, db, sessionsCollection };
}

// --- USER AUTHENTICATION LOGIC ---
export async function registerUser(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const dbObj = await getDb();
  
  if (dbObj && dbObj.db) {
    try {
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
    } catch (e: any) {
      if (e.message?.includes('already exists')) throw e;
      console.error('MongoDB register failed, falling back to local storage:', e);
    }
  }
  
  // Local file storage fallback
  const existingLocal = localDb.users.find(u => u.username === normalizedUsername);
  if (existingLocal) {
    throw new Error('Username already exists. Please choose another.');
  }
  
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const userId = `u-${Date.now()}`;
  
  const newUserRecord: UserRecord = {
    id: userId,
    username: normalizedUsername,
    passwordHash,
    salt,
    createdAt: new Date().toISOString()
  };
  
  localDb.users.push(newUserRecord);
  
  // Seed initial study sessions for new user
  const userInitial = INITIAL_SESSIONS.map((s, index) => ({
    ...s,
    id: `s-${Date.now()}-${index}`,
    userId
  }));
  localDb.sessions.push(...userInitial);
  
  saveLocalDb(localDb);
  return { id: userId, username: normalizedUsername };
}

export async function loginUser(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const dbObj = await getDb();
  
  if (dbObj && dbObj.db) {
    try {
      const usersCollection = dbObj.db.collection('users');
      const user = await usersCollection.findOne({ username: normalizedUsername });
      if (user) {
        const passwordHash = hashPassword(password, user.salt);
        if (passwordHash !== user.passwordHash) {
          throw new Error('Invalid username or password.');
        }
        return { id: user.id, username: user.username };
      }
    } catch (e: any) {
      if (e.message?.includes('Invalid username')) throw e;
      console.error('MongoDB login failed, checking local storage:', e);
    }
  }
  
  // Local file storage fallback
  const userLocal = localDb.users.find(u => u.username === normalizedUsername);
  if (!userLocal) {
    throw new Error('Invalid username or password.');
  }
  
  const passwordHash = hashPassword(password, userLocal.salt);
  if (passwordHash !== userLocal.passwordHash) {
    throw new Error('Invalid username or password.');
  }
  
  return { id: userLocal.id, username: userLocal.username };
}

export async function getUserById(userId: string) {
  const dbObj = await getDb();
  if (dbObj && dbObj.db) {
    try {
      const usersCollection = dbObj.db.collection('users');
      const user = await usersCollection.findOne({ id: userId });
      if (user) return { id: user.id, username: user.username };
    } catch (e) {
      console.error('MongoDB getUserById error:', e);
    }
  }
  
  const userLocal = localDb.users.find(u => u.id === userId);
  if (!userLocal) return null;
  return { id: userLocal.id, username: userLocal.username };
}

// --- SESSIONS LOGIC PER USER ---
export async function fetchSessions(userId: string): Promise<Session[]> {
  const dbObj = await getDb();
  if (dbObj && dbObj.sessionsCollection) {
    try {
      const docs = await dbObj.sessionsCollection.find({ userId }).toArray();
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
      console.error('Failed to fetch from MongoDB, falling back to local file:', e);
    }
  }
  
  // Local file fallback
  const userSessions = localDb.sessions.filter(s => s.userId === userId);
  if (userSessions.length === 0) {
    const userInitial = INITIAL_SESSIONS.map((s, index) => ({
      ...s,
      id: `s-${Date.now()}-${index}`,
      userId
    }));
    localDb.sessions.push(...userInitial);
    saveLocalDb(localDb);
    return userInitial;
  }
  return userSessions;
}

export async function addSession(session: Session, userId: string): Promise<Session> {
  const sessionWithUser = { ...session, userId };
  const dbObj = await getDb();
  if (dbObj && dbObj.sessionsCollection) {
    try {
      await dbObj.sessionsCollection.insertOne({ ...sessionWithUser } as any);
      return sessionWithUser;
    } catch (e) {
      console.error('Failed to insert to MongoDB, using local file:', e);
    }
  }
  localDb.sessions.push(sessionWithUser);
  saveLocalDb(localDb);
  return sessionWithUser;
}

export async function deleteSession(id: string, userId: string): Promise<boolean> {
  const dbObj = await getDb();
  if (dbObj && dbObj.sessionsCollection) {
    try {
      const result = await dbObj.sessionsCollection.deleteOne({ id, userId });
      return result.deletedCount > 0;
    } catch (e) {
      console.error('Failed to delete from MongoDB, using local file:', e);
    }
  }
  const index = localDb.sessions.findIndex(s => s.id === id && s.userId === userId);
  if (index !== -1) {
    localDb.sessions.splice(index, 1);
    saveLocalDb(localDb);
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
      console.error('Failed to reset MongoDB, resetting local file:', e);
    }
  }
  localDb.sessions = localDb.sessions.filter(s => s.userId !== userId);
  const userInitial = INITIAL_SESSIONS.map((s, index) => ({
    ...s,
    id: `s-${Date.now()}-${index}`,
    userId
  }));
  localDb.sessions.push(...userInitial);
  saveLocalDb(localDb);
  return true;
}
