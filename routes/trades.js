const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const BinanceAPI = require('../services/binanceAPI');
const NotificationService = require('../services/notifications');

// Initialize Binance API - IMPORTANT: Always initialize for price fetching
// Public endpoints (like getPrice) work WITHOUT API keys
const binance = new BinanceAPI(
  process.env.BINANCE_API_KEY || '',
  process.env.BINANCE_SECRET || ''
);

// Initialize Notification Service
const notifications = new NotificationService({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID
});

// Validate if live trading is allowed (requires API keys)
function canTradeLive() {
  return !!(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET);
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

// POST create new trade (with Telegram notification)
router.post('/', async (req, res) => {
  try {
    const { 
      symbol, 
      trade_type,
      price, 
      quantity, 
      confidence,
      strategy,
      mode,
      enable_telegram
    } = req.body;
    
    if (!symbol || !trade_type || !price || !quantity) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields' 
      });
    }

    if (mode === 'live' && !canTradeLive()) {
      return res.status(400).json({
        success: false,
        error: 'Live trading not available. Binance API not configured.'
      });
    }
    
    const total_value = price * quantity;
    let orderResult = null;
    
    // Execute on Binance if live mode
    if (mode === 'live' && canTradeLive()) {
      try {
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
          error: 'Failed to execute on Binance',
          details: binanceError.message
        });
      }
    } else {
      console.log(`📄 PAPER TRADE: ${trade_type} ${quantity} ${symbol} @ $${price}`);
    }
    
    // Save to database
    const result = await query(
      `INSERT INTO trades 
       (symbol, trade_type, price, quantity, total_value, confidence, strategy, mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [symbol, trade_type, price, quantity, total_value, confidence, strategy, mode]
    );
    
    const savedTrade = result.rows[0];
    
    // Send Telegram notification if enabled
    let telegramSent = false;
    if (enable_telegram) {
      try {
        await notifications.sendTradeAlert({
          ...savedTrade,
          mode: mode
        });
        telegramSent = true;
        console.log('📱 Telegram notification sent');
      } catch (telegramError) {
        console.error('❌ Telegram notification failed:', telegramError);
      }
    }
    
    res.status(201).json({ 
      success: true, 
      trade: savedTrade,
      binanceOrder: orderResult,
      telegramSent: telegramSent,
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

// GET current Binance price (PUBLIC API - no auth required)
// This endpoint ALWAYS works, even without API keys
// GET current Binance price - ALWAYS returns 200 with real or simulated data
router.get('/price/:symbol', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { symbol } = req.params;
    const binanceSymbol = symbol.replace('/', '').toUpperCase();
    
    console.log(`\n📊 [${new Date().toISOString()}] Price request for ${binanceSymbol}`);
    
    // Validate symbol format
    if (!binanceSymbol || binanceSymbol.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol format',
        symbol: symbol
      });
    }
    
    // Fetch price with all retry logic built in
    const priceData = await binance.getPrice(binanceSymbol);
    
    const responseTime = Date.now() - startTime;
    
    // Always return 200 OK, even if simulated
    const response = {
      success: true,
      symbol: symbol,
      binanceSymbol: binanceSymbol,
      price: parseFloat(priceData.price),
      timestamp: new Date().toISOString(),
      source: priceData.simulated ? 'simulated' : 'binance_live',
      simulated: priceData.simulated || false,
      responseTime: `${responseTime}ms`
    };
    
    // Add warning if simulated
    if (priceData.simulated) {
      response.warning = '⚠️ Using simulated price - Binance API temporarily unavailable';
      console.warn(`⚠️ Returned simulated price for ${binanceSymbol}`);
    } else {
      console.log(`✅ Real price: ${binanceSymbol} = $${priceData.price} (${responseTime}ms)`);
    }
    
    res.json(response);
    
  } catch (error) {
    // Catch-all error handler - should rarely reach here
    console.error(`❌ Critical error in price endpoint:`, error);
    
    // Return a safe fallback response (never 500)
    res.status(200).json({
      success: false,
      error: 'Service temporarily unavailable',
      symbol: req.params.symbol,
      price: 0,
      timestamp: new Date().toISOString(),
      simulated: true,
      warning: 'Please try again in a moment'
    });
  }
});

// Helper function to calculate P&L for a trade
async function calculateTradeProfitLoss(trade) {
  try {
    // For BUY trades, check if there's a matching SELL
    if (trade.trade_type === 'BUY') {
      // Find corresponding SELL trade
      const sellResult = await query(`
        SELECT * FROM trades 
        WHERE symbol = $1 
        AND trade_type = 'SELL' 
        AND created_at > $2
        AND profit_loss IS NULL
        ORDER BY created_at ASC
        LIMIT 1
      `, [trade.symbol, trade.created_at]);
      
      if (sellResult.rows.length > 0) {
        const sellTrade = sellResult.rows[0];
        
        // Calculate P&L
        const buyValue = parseFloat(trade.price) * parseFloat(trade.quantity);
        const sellValue = parseFloat(sellTrade.price) * parseFloat(sellTrade.quantity);
        const profitLoss = sellValue - buyValue;
        
        // Update both trades with P&L
        await query(`
          UPDATE trades 
          SET profit_loss = $1 
          WHERE id = $2 OR id = $3
        `, [profitLoss, trade.id, sellTrade.id]);
        
        // Update portfolio balance
        await query(`
          UPDATE portfolio 
          SET balance = balance + $1,
              profit_loss = profit_loss + $1
          WHERE id = 1
        `, [profitLoss]);
        
        return profitLoss;
      }
    }
    
    // For SELL trades, check if there's a matching BUY
    if (trade.trade_type === 'SELL') {
      const buyResult = await query(`
        SELECT * FROM trades 
        WHERE symbol = $1 
        AND trade_type = 'BUY' 
        AND created_at < $2
        AND profit_loss IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `, [trade.symbol, trade.created_at]);
      
      if (buyResult.rows.length > 0) {
        const buyTrade = buyResult.rows[0];
        
        // Calculate P&L
        const buyValue = parseFloat(buyTrade.price) * parseFloat(buyTrade.quantity);
        const sellValue = parseFloat(trade.price) * parseFloat(trade.quantity);
        const profitLoss = sellValue - buyValue;
        
        // Update both trades with P&L
        await query(`
          UPDATE trades 
          SET profit_loss = $1 
          WHERE id = $2 OR id = $3
        `, [profitLoss, buyTrade.id, trade.id]);
        
        // Update portfolio balance
        await query(`
          UPDATE portfolio 
          SET balance = balance + $1,
              profit_loss = profit_loss + $1
          WHERE id = 1
        `, [profitLoss]);
        
        return profitLoss;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error calculating P&L:', error);
    return null;
  }
}

// Update the POST /trades endpoint to include this:
router.post('/', async (req, res) => {
  try {
    const { 
      symbol, 
      trade_type,
      price, 
      quantity, 
      confidence,
      strategy,
      mode,
      enable_telegram
    } = req.body;
    
    if (!symbol || !trade_type || !price || !quantity) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields' 
      });
    }

    if (mode === 'live' && !canTradeLive()) {
      return res.status(400).json({
        success: false,
        error: 'Live trading not available. Binance API not configured.'
      });
    }
    
    const total_value = price * quantity;
    let orderResult = null;
    
    // Execute on Binance if live mode
    if (mode === 'live' && canTradeLive()) {
      try {
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
          error: 'Failed to execute on Binance',
          details: binanceError.message
        });
      }
    } else {
      console.log(`📄 PAPER TRADE: ${trade_type} ${quantity} ${symbol} @ $${price}`);
    }
    
    // Deduct/Add from portfolio balance
    if (trade_type === 'BUY') {
      // Deduct money for buying
      await query(`
        UPDATE portfolio 
        SET balance = balance - $1 
        WHERE id = 1
      `, [total_value]);
    } else if (trade_type === 'SELL') {
      // Add money for selling
      await query(`
        UPDATE portfolio 
        SET balance = balance + $1 
        WHERE id = 1
      `, [total_value]);
    }
    
    // Save to database
    const result = await query(
      `INSERT INTO trades 
       (symbol, trade_type, price, quantity, total_value, confidence, strategy, mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [symbol, trade_type, price, quantity, total_value, confidence, strategy, mode]
    );
    
    const savedTrade = result.rows[0];
    
    // Calculate P&L if this closes a position
    const profitLoss = await calculateTradeProfitLoss(savedTrade);
    
    if (profitLoss !== null) {
      console.log(`💰 Trade P&L: ${profitLoss > 0 ? '+' : ''}$${profitLoss.toFixed(2)}`);
    }
    
    // Send Telegram notification if enabled
    let telegramSent = false;
    if (enable_telegram) {
      try {
        await notifications.sendTradeAlert({
          ...savedTrade,
          profit_loss: profitLoss,
          mode: mode
        });
        telegramSent = true;
        console.log('📱 Telegram notification sent');
      } catch (telegramError) {
        console.error('❌ Telegram notification failed:', telegramError);
      }
    }
    
    res.status(201).json({ 
      success: true, 
      trade: {
        ...savedTrade,
        profit_loss: profitLoss
      },
      binanceOrder: orderResult,
      telegramSent: telegramSent,
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

module.exports = router;


