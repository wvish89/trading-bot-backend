const express = require('express');
const router = express.Router();
const BinanceAPI = require('../services/binanceAPI');

let binance = null;

// Initialize Binance API if credentials are available
function initBinance() {
  if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
    if (!binance) {
      binance = new BinanceAPI(
        process.env.BINANCE_API_KEY,
        process.env.BINANCE_SECRET
      );
      console.log('✅ Binance API initialized for sync');
    }
    return true;
  }
  return false;
}

// GET account balance from Binance
router.get('/balance', async (req, res) => {
  try {
    console.log('🔄 Balance sync request received');
    
    // Try to initialize Binance
    const hasCredentials = initBinance();
    
    if (!hasCredentials || !binance) {
      console.log('⚠️ Binance API not configured - returning demo mode');
      return res.json({
        success: true,
        demo: true,
        message: 'Binance API not configured. Using demo mode.',
        balances: {
          USDT: { asset: 'USDT', free: 10000, locked: 0, total: 10000 },
          BTC: { asset: 'BTC', free: 0, locked: 0, total: 0 }
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Try to get real balance
    try {
      const usdtBalance = await binance.getBalance('USDT');
      const btcBalance = await binance.getBalance('BTC');
      
      console.log('✅ Real balance fetched from Binance');
      
      res.json({
        success: true,
        demo: false,
        balances: {
          USDT: usdtBalance,
          BTC: btcBalance
        },
        timestamp: new Date().toISOString()
      });
    } catch (apiError) {
      console.error('❌ Binance API error:', apiError.message);
      
      // Return demo mode if API fails
      res.json({
        success: true,
        demo: true,
        error: apiError.message,
        message: 'Binance API error. Using demo mode.',
        balances: {
          USDT: { asset: 'USDT', free: 10000, locked: 0, total: 10000 },
          BTC: { asset: 'BTC', free: 0, locked: 0, total: 0 }
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Sync balance error:', error);
    
    // Never return 500 - always return demo mode as fallback
    res.json({
      success: true,
      demo: true,
      error: error.message,
      message: 'Service error. Using demo mode.',
      balances: {
        USDT: { asset: 'USDT', free: 10000, locked: 0, total: 10000 },
        BTC: { asset: 'BTC', free: 0, locked: 0, total: 0 }
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET full account snapshot from Binance
router.get('/account', async (req, res) => {
  try {
    const hasCredentials = initBinance();
    
    if (!hasCredentials || !binance) {
      return res.json({
        success: true,
        demo: true,
        message: 'Binance API not configured',
        account: {
          balances: [],
          canTrade: false,
          canWithdraw: false,
          canDeposit: false
        },
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      const snapshot = await binance.getAccountSnapshot();
      
      res.json({
        success: true,
        demo: false,
        account: snapshot,
        timestamp: new Date().toISOString()
      });
    } catch (apiError) {
      res.json({
        success: true,
        demo: true,
        error: apiError.message,
        account: {
          balances: [],
          canTrade: false
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error syncing account:', error);
    res.json({
      success: true,
      demo: true,
      error: error.message,
      account: { balances: [] },
      timestamp: new Date().toISOString()
    });
  }
});

// GET open orders from Binance
router.get('/orders', async (req, res) => {
  try {
    const hasCredentials = initBinance();
    
    if (!hasCredentials || !binance) {
      return res.json({
        success: true,
        demo: true,
        orders: [],
        count: 0,
        message: 'Binance API not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      const symbol = req.query.symbol;
      const orders = await binance.getOpenOrders(symbol);
      
      res.json({
        success: true,
        demo: false,
        orders: orders,
        count: orders.length,
        timestamp: new Date().toISOString()
      });
    } catch (apiError) {
      res.json({
        success: true,
        demo: true,
        orders: [],
        count: 0,
        error: apiError.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error getting open orders:', error);
    res.json({
      success: true,
      demo: true,
      orders: [],
      count: 0,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
