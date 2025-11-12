import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, openSync, closeSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import logger from './server-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 80 : 3000);
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const BACKUP_DIR = process.env.BACKUP_DIR || join(DATA_DIR, 'backups');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const BACKUP_INTERVAL_HOURS = parseInt(process.env.BACKUP_INTERVAL_HOURS || '6', 10); // Default: every 6 hours
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10); // Default: keep 30 backups

// Simple in-memory session store for admin authentication
// In production, consider using proper session storage (Redis, database, etc.)
const adminSessions = new Set();

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  logger.info(`Created backup directory: ${BACKUP_DIR}`);
}

// Configure CORS - Since frontend and backend are served from same origin (same domain/port),
// CORS isn't strictly needed, but we enable it for flexibility.
// If you need to restrict to specific domains (e.g., separate frontend/backend), set CORS_ORIGIN env var:
// CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
const corsOptions = process.env.CORS_ORIGIN 
  ? { 
      origin: process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
      credentials: true 
    }
  : {
      // In development, allow Vite dev server (port 5173) and same origin
      origin: process.env.NODE_ENV === 'production' 
        ? true  // Allow all origins in production (or set CORS_ORIGIN)
        : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    };

const app = express();
const httpServer = createServer(app);

// Socket.io CORS configuration - needs to be more explicit
const socketCorsOptions = process.env.CORS_ORIGIN 
  ? { 
      origin: process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
      credentials: true,
      methods: ['GET', 'POST']
    }
  : {
      // In development, allow Vite dev server and same origin
      origin: process.env.NODE_ENV === 'production' 
        ? true  // Allow all origins in production
        : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST']
    };

const io = new Server(httpServer, {
  cors: socketCorsOptions,
  allowEIO3: true
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from dist directory (only in production or if dist exists)
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// File locking mechanism
const MAX_LOCK_RETRIES = 20;
const LOCK_RETRY_DELAY = 50; // milliseconds

const acquireLock = async (filename) => {
  const lockPath = join(DATA_DIR, `${filename}.lock`);
  let retries = 0;
  
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  while (retries < MAX_LOCK_RETRIES) {
    try {
      // Try to create lock file exclusively (wx flag)
      const fd = openSync(lockPath, 'wx');
      closeSync(fd);
      return lockPath;
    } catch (error) {
      // Lock file exists, wait and retry
      retries++;
      if (retries >= MAX_LOCK_RETRIES) {
        throw new Error(`Failed to acquire lock for ${filename} after ${MAX_LOCK_RETRIES} retries`);
      }
      // Wait before retrying (non-blocking)
      await sleep(LOCK_RETRY_DELAY);
    }
  }
  return null;
};

const releaseLock = (lockPath) => {
  try {
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  } catch (error) {
    logger.error(`Error releasing lock ${lockPath}:`, error);
  }
};

// Helper function to read JSON file
const readJSONFile = (filename) => {
  const filePath = join(DATA_DIR, filename);
  try {
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error(`Error reading ${filename}:`, error);
  }
  return null;
};

// Helper function to read JSON file with lock (for read-then-write operations)
const readJSONFileWithLock = async (filename) => {
  const lockPath = await acquireLock(filename);
  if (!lockPath) {
    throw new Error(`Failed to acquire lock for reading ${filename}`);
  }
  
  try {
    return readJSONFile(filename);
  } finally {
    releaseLock(lockPath);
  }
};

// Helper function to write JSON file with lock
const writeJSONFile = async (filename, data) => {
  const lockPath = await acquireLock(filename);
  if (!lockPath) {
    return false;
  }
  
  try {
    const filePath = join(DATA_DIR, filename);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error(`Error writing ${filename}:`, error);
    return false;
  } finally {
    releaseLock(lockPath);
  }
};

// Helper function to read-modify-write atomically (single lock held throughout)
const readModifyWriteJSONFile = async (filename, modifyFn) => {
  const lockPath = await acquireLock(filename);
  if (!lockPath) {
    throw new Error(`Failed to acquire lock for ${filename}`);
  }
  
  try {
    // Read current data
    const currentData = readJSONFile(filename);
    // Modify
    const newData = modifyFn(currentData);
    // Write
    const filePath = join(DATA_DIR, filename);
    writeFileSync(filePath, JSON.stringify(newData, null, 2), 'utf8');
    return newData;
  } catch (error) {
    logger.error(`Error in read-modify-write for ${filename}:`, error);
    throw error;
  } finally {
    releaseLock(lockPath);
  }
};

// Backup functions
const createBackup = async (filename = 'rsvps.json') => {
  try {
    const sourcePath = join(DATA_DIR, filename);
    
    // Check if source file exists
    if (!existsSync(sourcePath)) {
      logger.warn(`Source file ${filename} does not exist, skipping backup`);
      return null;
    }
    
    // Create timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const backupFilename = `${filename.replace('.json', '')}_backup_${timestamp}.json`;
    const backupPath = join(BACKUP_DIR, backupFilename);
    
    // Copy file to backup directory
    copyFileSync(sourcePath, backupPath);
    
    logger.info(`Created backup: ${backupFilename}`);
    return backupPath;
  } catch (error) {
    logger.error(`Error creating backup for ${filename}:`, error);
    return null;
  }
};

const cleanupOldBackups = (filename = 'rsvps.json', maxBackups = MAX_BACKUPS) => {
  try {
    const prefix = filename.replace('.json', '') + '_backup_';
    const files = readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith(prefix) && file.endsWith('.json'))
      .map(file => {
        const filePath = join(BACKUP_DIR, file);
        return {
          name: file,
          path: filePath,
          mtime: statSync(filePath).mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first
    
    // Remove old backups if we exceed the limit
    if (files.length > maxBackups) {
      const filesToDelete = files.slice(maxBackups);
      filesToDelete.forEach(file => {
        try {
          unlinkSync(file.path);
          logger.info(`Deleted old backup: ${file.name}`);
        } catch (error) {
          logger.error(`Error deleting backup ${file.name}:`, error);
        }
      });
    }
  } catch (error) {
    logger.error('Error cleaning up old backups:', error);
  }
};

// Scheduled backup task
const scheduleBackups = () => {
  const backupInterval = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
  
  // Files to backup
  const filesToBackup = ['rsvps.json', 'framies.json', 'liftshares.json', 'awards.json'];
  
  // Create initial backup on startup
  logger.info('Creating initial backup...');
  filesToBackup.forEach(filename => {
    createBackup(filename).then(() => {
      cleanupOldBackups(filename);
    });
  });
  
  // Schedule periodic backups
  setInterval(() => {
    logger.info('Running scheduled backup...');
    filesToBackup.forEach(filename => {
      createBackup(filename).then(() => {
        cleanupOldBackups(filename);
      });
    });
  }, backupInterval);
  
  logger.info(`Backup system initialized: backups will be created every ${BACKUP_INTERVAL_HOURS} hours`);
  logger.info(`Maximum backups to keep: ${MAX_BACKUPS}`);
  logger.info(`Files being backed up: ${filesToBackup.join(', ')}`);
};

// Start backup scheduler
scheduleBackups();

// API Routes

// RSVPs endpoints
app.get('/api/rsvps', (req, res) => {
  try {
    const rsvps = readJSONFile('rsvps.json');
    res.json(rsvps || []);
  } catch (error) {
    logger.error('Error reading RSVPs:', error);
    res.status(500).json({ error: 'Failed to read RSVPs' });
  }
});

app.put('/api/rsvps', async (req, res) => {
  try {
    const { rsvps } = req.body;
    if (!Array.isArray(rsvps)) {
      return res.status(400).json({ error: 'RSVPs must be an array' });
    }
    
    // Check if RSVPs are locked
    const config = readJSONFile('config.json');
    if (config && config.rsvpLocked) {
      return res.status(403).json({ error: 'RSVPs are currently locked. Please contact the administrator.' });
    }
    
    // Atomic read-modify-write with lock held throughout
    const savedRsvps = await readModifyWriteJSONFile('rsvps.json', (currentRsvps) => {
      const existingRsvps = currentRsvps || [];
      
      // Server-side validation: Check for seat conflicts
      // First, build a map of existing seat assignments
      const seatMap = new Map();
      for (const rsvp of existingRsvps) {
        if (rsvp.table && rsvp.seat) {
          const seatKey = `${rsvp.table}-${rsvp.seat}`;
          seatMap.set(seatKey, rsvp);
        }
      }
      
      // Check if seating is locked and if any RSVP has seat changes
      const seatingLocked = config && config.seatingLocked;
      if (seatingLocked) {
        // Check if any RSVP is trying to change or add a seat assignment
        for (const rsvp of rsvps) {
          if (rsvp.table && rsvp.seat) {
            const existing = existingRsvps.find(r => r.email === rsvp.email);
            // If this is a new seat assignment or a change to existing seat
            if (!existing || existing.table !== rsvp.table || existing.seat !== rsvp.seat) {
              throw new Error('Seating plan is currently locked. Seat changes are not allowed.');
            }
          }
        }
      }
      
      // Now check new RSVPs against existing ones and within themselves
      for (const rsvp of rsvps) {
        if (rsvp.table && rsvp.seat) {
          const seatKey = `${rsvp.table}-${rsvp.seat}`;
          const existing = seatMap.get(seatKey);
          
          // Check if seat is already taken by a different person
          if (existing && existing.email !== rsvp.email) {
            throw new Error(`Seat conflict: Seat ${rsvp.seat} at Table ${rsvp.table} is already claimed by ${existing.name || existing.email}`);
          }
          
          // Update map for duplicate detection within the new array
          seatMap.set(seatKey, rsvp);
        }
      }
      
      // Return the new data to write
      return rsvps;
    });
    
    // Emit real-time update to all connected clients
    logger.info(`Emitting rsvps:updated to ${io.sockets.sockets.size} connected clients`);
    io.emit('rsvps:updated', savedRsvps);
    
    res.json({ success: true, rsvps: savedRsvps });
  } catch (error) {
    logger.error('Error saving RSVPs:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else if (error.message.includes('Seat conflict')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to save RSVPs' });
    }
  }
});

// Helper function to convert old menu object format to array format
const normalizeMenuToArray = (menu) => {
  if (!menu) return null;
  if (Array.isArray(menu)) return menu;
  
  // Handle old object format with numeric keys
  if (typeof menu === 'object' && !Array.isArray(menu)) {
    const keys = Object.keys(menu).filter(key => key !== '_version' && !isNaN(parseInt(key)));
    if (keys.length > 0) {
      // Convert object with numeric keys to array
      const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
      return sortedKeys.map(key => menu[key]);
    }
  }
  
  return menu;
};

// Menu endpoints
app.get('/api/menu', (req, res) => {
  try {
    const menu = readJSONFile('menu.json');
    const normalizedMenu = normalizeMenuToArray(menu);
    
    // If we had to normalize, save it back in the correct format
    if (normalizedMenu && normalizedMenu !== menu && Array.isArray(normalizedMenu)) {
      writeJSONFile('menu.json', normalizedMenu).catch(err => {
        logger.error('Error saving normalized menu:', err);
      });
    }
    
    res.json(normalizedMenu || null);
  } catch (error) {
    logger.error('Error reading menu:', error);
    res.status(500).json({ error: 'Failed to read menu' });
  }
});

app.put('/api/menu', async (req, res) => {
  try {
    const { menuCategories } = req.body;
    if (!Array.isArray(menuCategories)) {
      return res.status(400).json({ error: 'Menu categories must be an array' });
    }
    
    // Atomic read-modify-write with lock held throughout
    const savedMenu = await readModifyWriteJSONFile('menu.json', () => {
      return menuCategories;
    });
    
    // Emit real-time update to all connected clients
    io.emit('menu:updated', savedMenu);
    
    res.json({ success: true, menuCategories: savedMenu });
  } catch (error) {
    logger.error('Error saving menu:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save menu' });
    }
  }
});

// Lift Sharing endpoints
app.get('/api/liftshares', (req, res) => {
  try {
    const liftShares = readJSONFile('liftshares.json');
    res.json(liftShares || []);
  } catch (error) {
    logger.error('Error reading lift shares:', error);
    res.status(500).json({ error: 'Failed to read lift shares' });
  }
});

app.put('/api/liftshares', async (req, res) => {
  try {
    const { liftShares } = req.body;
    if (!Array.isArray(liftShares)) {
      return res.status(400).json({ error: 'Lift shares must be an array' });
    }
    
    // Atomic read-modify-write with lock held throughout
    const savedLiftShares = await readModifyWriteJSONFile('liftshares.json', () => {
      return liftShares;
    });
    
    // Emit real-time update to all connected clients
    io.emit('liftshares:updated', savedLiftShares);
    
    res.json({ success: true, liftShares: savedLiftShares });
  } catch (error) {
    logger.error('Error saving lift shares:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save lift shares' });
    }
  }
});

// Event Details endpoints
app.get('/api/event', (req, res) => {
  try {
    const eventDetails = readJSONFile('event.json');
    res.json(eventDetails || null);
  } catch (error) {
    logger.error('Error reading event details:', error);
    res.status(500).json({ error: 'Failed to read event details' });
  }
});

app.put('/api/event', async (req, res) => {
  try {
    const { eventDetails } = req.body;
    if (!eventDetails || typeof eventDetails !== 'object') {
      return res.status(400).json({ error: 'Event details must be an object' });
    }
    
    // Atomic read-modify-write with lock held throughout
    const savedEventDetails = await readModifyWriteJSONFile('event.json', () => {
      return eventDetails;
    });
    
    // Emit real-time update to all connected clients
    io.emit('event:updated', savedEventDetails);
    
    res.json({ success: true, eventDetails: savedEventDetails });
  } catch (error) {
    logger.error('Error saving event details:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save event details' });
    }
  }
});

// Feedback endpoints
app.get('/api/feedback', (req, res) => {
  try {
    const feedback = readJSONFile('feedback.json');
    res.json(feedback || []);
  } catch (error) {
    logger.error('Error reading feedback:', error);
    res.status(500).json({ error: 'Failed to read feedback' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { feedback: newFeedback } = req.body;
    if (!newFeedback || typeof newFeedback !== 'object') {
      return res.status(400).json({ error: 'Feedback must be an object' });
    }
    
    // Atomic read-modify-write with lock held throughout
    const savedFeedback = await readModifyWriteJSONFile('feedback.json', (currentFeedback) => {
      const feedbackList = currentFeedback || [];
      return [...feedbackList, newFeedback];
    });
    
    // Emit real-time update to all connected clients
    io.emit('feedback:updated', savedFeedback);
    
    res.json({ success: true, feedback: newFeedback });
  } catch (error) {
    logger.error('Error saving feedback:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  }
});

app.delete('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Atomic read-modify-write with lock held throughout
    const updatedFeedback = await readModifyWriteJSONFile('feedback.json', (currentFeedback) => {
      const feedbackList = currentFeedback || [];
      return feedbackList.filter(f => f.id !== id);
    });
    
    // Emit real-time update to all connected clients
    io.emit('feedback:updated', updatedFeedback);
    
    res.json({ success: true, feedback: updatedFeedback });
  } catch (error) {
    logger.error('Error deleting feedback:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to delete feedback' });
    }
  }
});

// Framies endpoints
app.get('/api/framies', (req, res) => {
  try {
    const framiesData = readJSONFile('framies.json');
    res.json(framiesData || { nominations: [], votes: [] });
  } catch (error) {
    logger.error('Error reading framies data:', error);
    res.status(500).json({ error: 'Failed to read framies data' });
  }
});

app.put('/api/framies', async (req, res) => {
  try {
    const { framiesData } = req.body;
    if (!framiesData || typeof framiesData !== 'object') {
      return res.status(400).json({ error: 'Framies data must be an object' });
    }
    
    // Atomic read-modify-write with lock held throughout
    const savedFramies = await readModifyWriteJSONFile('framies.json', () => {
      return framiesData;
    });
    
    // Emit real-time update to all connected clients
    io.emit('framies:updated', savedFramies);
    
    res.json({ success: true, framiesData: savedFramies });
  } catch (error) {
    logger.error('Error saving framies data:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save framies data' });
    }
  }
});

// Awards endpoints
app.get('/api/awards', (req, res) => {
  try {
    const awards = readJSONFile('awards.json');
    res.json(awards || []);
  } catch (error) {
    logger.error('Error reading awards:', error);
    res.status(500).json({ error: 'Failed to read awards' });
  }
});

app.put('/api/awards', async (req, res) => {
  try {
    const { awards } = req.body;
    if (!Array.isArray(awards)) {
      return res.status(400).json({ error: 'Awards must be an array' });
    }
    
    // Validate award structure
    for (const award of awards) {
      if (!award.id || !award.label) {
        return res.status(400).json({ error: 'Each award must have id and label' });
      }
    }
    
    // Atomic read-modify-write with lock held throughout
    const savedAwards = await readModifyWriteJSONFile('awards.json', () => {
      return awards;
    });
    
    // Emit real-time update to all connected clients
    io.emit('awards:updated', savedAwards);
    
    res.json({ success: true, awards: savedAwards });
  } catch (error) {
    logger.error('Error saving awards:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save awards' });
    }
  }
});

// Config endpoints
app.get('/api/config', (req, res) => {
  try {
    const config = readJSONFile('config.json');
    res.json(config || { tablesCount: 5, seatsPerTable: 8 });
  } catch (error) {
    logger.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const { tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, tableDisplayNames, rsvpLocked, seatingLocked } = req.body;
    const config = {
      tablesCount: tablesCount || 5,
      seatsPerTable: seatsPerTable || 8
    };
    
    // Include tablePositions if provided (can be null to clear)
    if (tablePositions !== undefined) {
      config.tablePositions = tablePositions;
    }
    
    // Include customAreas if provided (can be null to clear)
    if (customAreas !== undefined) {
      config.customAreas = customAreas;
    }
    
    // Include gridCols if provided
    if (gridCols !== undefined && gridCols !== null) {
      config.gridCols = gridCols;
    }
    
    // Include gridRows if provided
    if (gridRows !== undefined && gridRows !== null) {
      config.gridRows = gridRows;
    }
    
    // Include tableDisplayNames if provided (can be null to clear)
    if (tableDisplayNames !== undefined) {
      config.tableDisplayNames = tableDisplayNames;
    }
    
    // Include lock states if provided
    if (rsvpLocked !== undefined) {
      config.rsvpLocked = rsvpLocked;
    }
    
    if (seatingLocked !== undefined) {
      config.seatingLocked = seatingLocked;
    }
    
    // Atomic read-modify-write with lock held throughout
    const savedConfig = await readModifyWriteJSONFile('config.json', (currentConfig) => {
      // Merge with existing config to preserve any other fields
      const existingConfig = currentConfig || {};
      return { ...existingConfig, ...config };
    });
    
    // Emit real-time update to all connected clients
    io.emit('config:updated', savedConfig);
    
    res.json({ success: true, ...savedConfig });
  } catch (error) {
    logger.error('Error saving config:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save config' });
    }
  }
});

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  const sessionId = req.headers['x-admin-session'];
  if (!sessionId || !adminSessions.has(sessionId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    if (password === ADMIN_PASSWORD) {
      // Generate a simple session ID (in production, use proper session tokens)
      const sessionId = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      adminSessions.add(sessionId);
      
      // Session expires after 24 hours (in production, implement proper expiration)
      setTimeout(() => {
        adminSessions.delete(sessionId);
      }, 24 * 60 * 60 * 1000);
      
      res.json({ success: true, sessionId });
    } else {
      res.status(401).json({ error: 'Incorrect password' });
    }
  } catch (error) {
    logger.error('Error in admin login:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

// Admin logout endpoint
app.post('/api/admin/logout', (req, res) => {
  try {
    const sessionId = req.headers['x-admin-session'];
    if (sessionId) {
      adminSessions.delete(sessionId);
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error in admin logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Admin session check endpoint
app.get('/api/admin/check', requireAdmin, (req, res) => {
  res.json({ success: true, authenticated: true });
});

// Admin manual backup endpoint
app.post('/api/admin/backup', requireAdmin, async (req, res) => {
  try {
    const filesToBackup = ['rsvps.json', 'framies.json', 'liftshares.json', 'awards.json'];
    const backupPaths = [];
    
    for (const filename of filesToBackup) {
      const backupPath = await createBackup(filename);
      if (backupPath) {
        cleanupOldBackups(filename);
        backupPaths.push({ file: filename, path: backupPath });
      }
    }
    
    if (backupPaths.length > 0) {
      res.json({ 
        success: true, 
        message: 'Backups created successfully', 
        backups: backupPaths 
      });
    } else {
      res.status(500).json({ error: 'Failed to create backups' });
    }
  } catch (error) {
    logger.error('Error in manual backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Catch all handler for SPA routing (only in production)
if (existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id} (Total clients: ${io.sockets.sockets.size})`);
  
  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason} (Total clients: ${io.sockets.sockets.size})`);
  });
  
  // Send a test message on connection
  socket.emit('test', { message: 'WebSocket connection established' });
});

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Data directory: ${DATA_DIR}`);
  logger.info(`WebSocket server ready for real-time updates`);
});

