const express = require('express');
const router = express.Router();
const BinanceAPI = require('../services/binanceAPI');

let binance = null;
if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
  binance = new BinanceAPI(
    process.env.BINANCE_API_KEY,
    process.env.BINANCE_SECRET
  );
}

// GET account balance from Binance
router.get('/balance', async (req, res) => {
  try {
    if (!binance) {
      return res.status(503).json({
        success: false,
        error: 'Binance API not configured. Add BINANCE_API_KEY and BINANCE_SECRET to environment variables.'
      });
    }
    
    const usdtBalance = await binance.getBalance('USDT');
    const btcBalance = await binance.getBalance('BTC');
    
    res.json({
      success: true,
      balances: {
        USDT: usdtBalance,
        BTC: btcBalance
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET full account snapshot from Binance
router.get('/account', async (req, res) => {
  try {
    if (!binance) {
      return res.status(503).json({
        success: false,
        error: 'Binance API not configured'
      });
    }
    
    const snapshot = await binance.getAccountSnapshot();
    
    res.json({
      success: true,
      account: snapshot,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET open orders from Binance
router.get('/orders', async (req, res) => {
  try {
    if (!binance) {
      return res.status(503).json({
        success: false,
        error: 'Binance API not configured'
      });
    }
    
    const symbol = req.query.symbol;
    const orders = await binance.getOpenOrders(symbol);
    
    res.json({
      success: true,
      orders: orders,
      count: orders.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting open orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
