import express from 'express';
import { 
  fetchSessions, 
  addSession, 
  deleteSession, 
  resetSessions,
  registerUser,
  loginUser,
  getUserById,
  createToken,
  verifyToken 
} from '../server/db.ts';

const app = express();
app.use(express.json());

// Helper to extract authenticated user ID from Bearer token
const getUserId = (req: express.Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  return verifyToken(token);
};

// --- AUTHENTICATION ENDPOINTS ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || username.trim().length < 2 || password.trim().length < 4) {
      res.status(400).json({ error: 'Username (min 2 chars) and Password (min 4 chars) are required' });
      return;
    }
    const user = await registerUser(username, password);
    const token = createToken(user.id);
    res.json({ user, token });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and Password are required' });
      return;
    }
    const user = await loginUser(username, password);
    const token = createToken(user.id);
    res.json({ user, token });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Login failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await getUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- SESSIONS ENDPOINTS (SECURED BY USER ID) ---
app.get('/api/sessions', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sessions = await fetchSessions(userId);
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const session = req.body;
    if (!session || !session.id || !session.date || !session.category || typeof session.durationMinutes !== 'number') {
      res.status(400).json({ error: 'Invalid session data' });
      return;
    }
    const saved = await addSession(session, userId);
    res.json(saved);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add session' });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const success = await deleteSession(id, userId);
    res.json({ success });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

app.post('/api/sessions/reset', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const success = await resetSessions(userId);
    res.json({ success });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset sessions' });
  }
});

export default app;
