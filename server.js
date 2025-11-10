import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, openSync, closeSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 80 : 3000);
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
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
    
    // Emit real-time update to all connected clients
    console.log(`Emitting rsvps:updated to ${io.sockets.sockets.size} connected clients`);
    io.emit('rsvps:updated', savedRsvps);
    
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
        console.error('Error saving normalized menu:', err);
      });
    }
    
    res.json(normalizedMenu || null);
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
    
    // Emit real-time update to all connected clients
    io.emit('menu:updated', savedMenu);
    
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

// Lift Sharing endpoints
app.get('/api/liftshares', (req, res) => {
  try {
    const liftShares = readJSONFile('liftshares.json');
    res.json(liftShares || []);
  } catch (error) {
    console.error('Error reading lift shares:', error);
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
    console.error('Error saving lift shares:', error);
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
    console.error('Error reading event details:', error);
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
    console.error('Error saving event details:', error);
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
    console.error('Error reading feedback:', error);
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
    console.error('Error saving feedback:', error);
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
    console.error('Error deleting feedback:', error);
    if (error.message.includes('lock')) {
      res.status(503).json({ error: 'Server is busy processing another request. Please try again in a moment.' });
    } else {
      res.status(500).json({ error: 'Failed to delete feedback' });
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
    const { tablesCount, seatsPerTable, tablePositions, customAreas, gridCols, gridRows, tableDisplayNames } = req.body;
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id} (Total clients: ${io.sockets.sockets.size})`);
  
  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id}, reason: ${reason} (Total clients: ${io.sockets.sockets.size})`);
  });
  
  // Send a test message on connection
  socket.emit('test', { message: 'WebSocket connection established' });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`WebSocket server ready for real-time updates`);
});

