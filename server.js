import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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

// Helper function to write JSON file
const writeJSONFile = (filename, data) => {
  const filePath = join(DATA_DIR, filename);
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    return false;
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

app.put('/api/rsvps', (req, res) => {
  try {
    const { rsvps } = req.body;
    if (!Array.isArray(rsvps)) {
      return res.status(400).json({ error: 'RSVPs must be an array' });
    }
    if (writeJSONFile('rsvps.json', rsvps)) {
      res.json({ success: true, rsvps });
    } else {
      res.status(500).json({ error: 'Failed to save RSVPs' });
    }
  } catch (error) {
    console.error('Error saving RSVPs:', error);
    res.status(500).json({ error: 'Failed to save RSVPs' });
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

app.put('/api/menu', (req, res) => {
  try {
    const { menuCategories } = req.body;
    if (!Array.isArray(menuCategories)) {
      return res.status(400).json({ error: 'Menu categories must be an array' });
    }
    if (writeJSONFile('menu.json', menuCategories)) {
      res.json({ success: true, menuCategories });
    } else {
      res.status(500).json({ error: 'Failed to save menu' });
    }
  } catch (error) {
    console.error('Error saving menu:', error);
    res.status(500).json({ error: 'Failed to save menu' });
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

app.put('/api/config', (req, res) => {
  try {
    const { tablesCount, seatsPerTable } = req.body;
    const config = {
      tablesCount: tablesCount || 5,
      seatsPerTable: seatsPerTable || 8
    };
    if (writeJSONFile('config.json', config)) {
      res.json({ success: true, ...config });
    } else {
      res.status(500).json({ error: 'Failed to save config' });
    }
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save config' });
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

