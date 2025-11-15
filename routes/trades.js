const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const BinanceAPI = require('../services/binanceAPI');

function canTradeLive() {
  return !!(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET && binance);
}

// Initialize Binance API (only if keys are provided)
let binance = null;
if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
  binance = new BinanceAPI(
    process.env.BINANCE_API_KEY,
    process.env.BINANCE_SECRET
  );
}

// GET all trades
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const symbol = req.query.symbol;
    
    let queryText = 'SELECT * FROM trades';
    let queryParams = [];
    
    if (symbol) {
      queryText += ' WHERE symbol = $1';
      queryParams.push(symbol);
    }
    
    queryText += ' ORDER BY created_at DESC LIMIT $' + (queryParams.length + 1);
    queryParams.push(limit);
    
    const result = await query(queryText, queryParams);
    
    res.json({ 
      success: true,
      count: result.rows.length,
      trades: result.rows 
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET trade by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM trades WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Trade not found' 
      });
    }
    
    res.json({ 
      success: true,
      trade: result.rows[0] 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// POST create new trade (and execute on Binance if live mode)
router.post('/', async (req, res) => {
  try {
    const { 
      symbol, 
      trade_type,  // BUY or SELL
      price, 
      quantity, 
      confidence,
      strategy,
      mode  // 'paper' or 'live'
    } = req.body;
    
    // Validate required fields
    if (!symbol || !trade_type || !price || !quantity) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: symbol, trade_type, price, quantity' 
      });
    }

    // 🔥 NEW: Check if live trading is possible
    if (mode === 'live' && !canTradeLive()) {
      return res.status(400).json({
        success: false,
        error: 'Live trading not available. Binance API credentials not configured.',
        hint: 'Please add BINANCE_API_KEY and BINANCE_SECRET to environment variables'
      });
    }
    
    const total_value = price * quantity;
    let orderResult = null;
    
    // Execute real trade on Binance if in live mode
    if (mode === 'live' && binance) {
      try {
        // Convert symbol format: BTC/USD -> BTCUSDT
        const binanceSymbol = symbol.replace('/', '').toUpperCase();
        
        console.log(`🔴 LIVE TRADE: ${trade_type} ${quantity} ${binanceSymbol} @ $${price}`);
        
        orderResult = await binance.placeOrder(
          binanceSymbol,
          trade_type.toUpperCase(),
          quantity
        );
        
        console.log('✅ Binance order executed:', orderResult);
      } catch (binanceError) {
        console.error('❌ Binance order failed:', binanceError);
        return res.status(500).json({
          success: false,
          error: 'Failed to execute trade on Binance',
          details: binanceError.message
        });
      }
    } else if (mode === 'paper') {
      console.log(`📄 PAPER TRADE: ${trade_type} ${quantity} ${symbol} @ $${price}`);
    }
    
    // Save trade to database
    const result = await query(
      `INSERT INTO trades 
       (symbol, trade_type, price, quantity, total_value, confidence, strategy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [symbol, trade_type, price, quantity, total_value, confidence, strategy]
    );
    
    res.status(201).json({ 
      success: true, 
      trade: result.rows[0],
      binanceOrder: orderResult,
      mode: mode
    });
    
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});
    
    const total_value = price * quantity;
    let orderResult = null;
    
    // Execute real trade on Binance if in live mode
    if (mode === 'live' && binance) {
      try {
        // Convert symbol format: BTC/USD -> BTCUSDT
        const binanceSymbol = symbol.replace('/', '') + 'T';
        
        orderResult = await binance.placeOrder(
          binanceSymbol,
          trade_type.toUpperCase(),
          quantity
        );
        
        console.log('✅ Binance order executed:', orderResult);
      } catch (binanceError) {
        console.error('❌ Binance order failed:', binanceError);
        return res.status(500).json({
          success: false,
          error: 'Failed to execute trade on Binance',
          details: binanceError.message
        });
      }
    }
    
    // Save trade to database
    const result = await query(
      `INSERT INTO trades 
       (symbol, trade_type, price, quantity, total_value, confidence, strategy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [symbol, trade_type, price, quantity, total_value, confidence, strategy]
    );
    
    res.status(201).json({ 
      success: true, 
      trade: result.rows[0],
      binanceOrder: orderResult
    });
    
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET trade statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE trade_type = 'BUY') as buy_trades,
        COUNT(*) FILTER (WHERE trade_type = 'SELL') as sell_trades,
        SUM(profit_loss) FILTER (WHERE profit_loss > 0) as total_profit,
        SUM(profit_loss) FILTER (WHERE profit_loss < 0) as total_loss,
        AVG(confidence) as avg_confidence,
        MAX(created_at) as last_trade_time
      FROM trades
    `);
    
    const stats = result.rows[0];
    
    // Calculate win rate
    const completedTrades = await query(`
      SELECT COUNT(*) as count 
      FROM trades 
      WHERE profit_loss IS NOT NULL
    `);
    
    const winningTrades = await query(`
      SELECT COUNT(*) as count 
      FROM trades 
      WHERE profit_loss > 0
    `);
    
    const winRate = completedTrades.rows[0].count > 0 
      ? (winningTrades.rows[0].count / completedTrades.rows[0].count) * 100 
      : 0;
    
    res.json({ 
      success: true,
      stats: {
        ...stats,
        win_rate: winRate.toFixed(2),
        profit_factor: stats.total_loss !== '0' 
          ? (parseFloat(stats.total_profit) / Math.abs(parseFloat(stats.total_loss))).toFixed(2)
          : stats.total_profit > 0 ? 'Infinity' : '0'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET current Binance price (real-time)
router.get('/price/:symbol', async (req, res) => {
  try {
    if (!binance) {
      return res.status(503).json({
        success: false,
        error: 'Binance API not configured. Using simulated prices.'
      });
    }
    
    const { symbol } = req.params;
    // Convert symbol format: BTCUSDT or BTC/USD -> BTCUSDT
    const binanceSymbol = symbol.replace('/', '').toUpperCase();
    
    const price = await binance.getPrice(binanceSymbol);
    
    res.json({
      success: true,
      symbol: symbol,
      binanceSymbol: binanceSymbol,
      price: parseFloat(price.price),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting price:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Make sure the symbol is valid (e.g., BTCUSDT)'
    });
  }
});


module.exports = router;

