const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// 🔥 CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',           // Local development
  'https://trading-bot-frontend-1rur001lm-vishvanaths-projects-b8636267.vercel.app/', // Your deployed frontend URL
  'https://claude.ai',               // Claude.ai (won't work due to CSP)
  '*'                                // Allow all for testing
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Import routes
const tradesRouter = require('./routes/trades');
const positionsRouter = require('./routes/positions');

// Use routes
app.use('/api/trades', tradesRouter);
app.use('/api/positions', positionsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Configuration status endpoint
app.get('/config', (req, res) => {
  res.json({ 
    success: true,
    config: {
      databaseConnected: !!process.env.DATABASE_URL,
      binanceConfigured: !!(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET),
      liveTradingAvailable: !!(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Trading Bot API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      trades: '/api/trades',
      positions: '/api/positions'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const { testConnection } = require('./config/database');

// Test database connection on startup
testConnection();

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 API URL: http://localhost:${PORT}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
  console.log(`🔑 Binance: ${process.env.BINANCE_API_KEY ? 'Configured' : 'NOT CONFIGURED (Paper trading only)'}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 API URL: http://localhost:${PORT}`);
});

module.exports = app;

