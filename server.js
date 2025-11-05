import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, openSync, closeSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 80 : 3000);
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
// Configure CORS - Since frontend and backend are served from same origin (same domain/port),
// CORS isn't strictly needed, but we enable it for flexibility.
// If you need to restrict to specific domains (e.g., separate frontend/backend), set CORS_ORIGIN env var:
// CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
const corsOptions = process.env.CORS_ORIGIN 
  ? { 
      origin: process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
      credentials: true 
    }
  : {}; // Default: allow all origins (safe for same-origin setup)
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
    console.error(`Error releasing lock ${lockPath}:`, error);
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
    console.error(`Error reading ${filename}:`, error);
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
    console.error(`Error writing ${filename}:`, error);
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
    console.error(`Error in read-modify-write for ${filename}:`, error);
    throw error;
  } finally {
    releaseLock(lockPath);
  }
};

// API Routes

// RSVPs endpoints
app.get('/api/rsvps', (req, res) => {
  try {
    const rsvps = readJSONFile('rsvps.json');
    res.json(rsvps || []);
  } catch (error) {
    console.error('Error reading RSVPs:', error);
    res.status(500).json({ error: 'Failed to read RSVPs' });
  }
});

app.put('/api/rsvps', async (req, res) => {
  try {
    const { rsvps } = req.body;
    if (!Array.isArray(rsvps)) {
      return res.status(400).json({ error: 'RSVPs must be an array' });
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
    
    res.json({ success: true, rsvps: savedRsvps });
  } catch (error) {
    console.error('Error saving RSVPs:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else if (error.message.includes('Seat conflict')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to save RSVPs' });
    }
  }
});

// Menu endpoints
app.get('/api/menu', (req, res) => {
  try {
    const menu = readJSONFile('menu.json');
    res.json(menu || null);
  } catch (error) {
    console.error('Error reading menu:', error);
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
    
    res.json({ success: true, menuCategories: savedMenu });
  } catch (error) {
    console.error('Error saving menu:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save menu' });
    }
  }
});

// Config endpoints
app.get('/api/config', (req, res) => {
  try {
    const config = readJSONFile('config.json');
    res.json(config || { tablesCount: 5, seatsPerTable: 8 });
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const { tablesCount, seatsPerTable } = req.body;
    const config = {
      tablesCount: tablesCount || 5,
      seatsPerTable: seatsPerTable || 8
    };
    
    // Atomic read-modify-write with lock held throughout
    const savedConfig = await readModifyWriteJSONFile('config.json', () => {
      return config;
    });
    
    res.json({ success: true, ...savedConfig });
  } catch (error) {
    console.error('Error saving config:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to save config' });
    }
  }
});

// Catch all handler for SPA routing (only in production)
if (existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});

