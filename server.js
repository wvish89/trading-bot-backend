const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.options('*', cors());
app.use(express.json());

// Import routes
const tradesRouter = require('./routes/trades');
const positionsRouter = require('./routes/positions');
const portfolioRouter = require('./routes/portfolio');
const syncRouter = require('./routes/sync');
const notificationsRouter = require('./routes/notifications');

// Use routes
app.use('/api/trades', tradesRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/sync', syncRouter);
app.use('/api/notifications', notificationsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Config
app.get('/config', (req, res) => {
  res.json({ 
    success: true,
    config: {
      databaseConnected: !!process.env.DATABASE_URL,
      binanceConfigured: !!(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET),
      telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      liveTradingAvailable: !!(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'Trading Bot API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      config: '/config',
      trades: '/api/trades',
      positions: '/api/positions',
      portfolio: '/api/portfolio',
      sync: '/api/sync',
      notifications: '/api/notifications'
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

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? '✅' : '❌'}`);
  console.log(`🔑 Binance: ${process.env.BINANCE_API_KEY ? '✅' : '❌'}`);
  console.log(`📱 Telegram: ${process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID ? '✅' : '❌'}`);
});

module.exports = app;
