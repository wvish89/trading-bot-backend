const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const BinanceAPI = require('../services/binanceAPI');

// Initialize Binance for price fetching
const binance = new BinanceAPI(
  process.env.BINANCE_API_KEY || '',
  process.env.BINANCE_SECRET || ''
);

// GET current portfolio state with calculated P&L
router.get('/', async (req, res) => {
  try {
    // Get portfolio from database
    const result = await query(`
      SELECT * FROM portfolio WHERE id = 1
    `);
    
    let portfolio;
    
    if (result.rows.length === 0) {
      // Create default portfolio
      await query(`
        INSERT INTO portfolio (id, balance, total_value, profit_loss, positions_json, mode)
        VALUES (1, 10000, 10000, 0, '{}', 'paper')
      `);
      
      portfolio = {
        id: 1,
        balance: 10000,
        total_value: 10000,
        profit_loss: 0,
        positions_json: {},
        mode: 'paper'
      };
    } else {
      portfolio = result.rows[0];
    }
    
    // Get all positions
    const positionsResult = await query(`
      SELECT * FROM positions ORDER BY opened_at DESC
    `);
    
    // Get total P&L from closed trades
    const tradesResult = await query(`
      SELECT 
        COALESCE(SUM(profit_loss), 0) as total_pnl,
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE profit_loss > 0) as winning_trades,
        COUNT(*) FILTER (WHERE profit_loss < 0) as losing_trades
      FROM trades
      WHERE profit_loss IS NOT NULL
    `);
    
    const tradeStats = tradesResult.rows[0];
    
    // Calculate unrealized P&L from open positions
    let unrealizedPnL = 0;
    let positionsValue = 0;
    
    for (const position of positionsResult.rows) {
      try {
        // Get current price
        const symbol = position.symbol.replace('/', '').toUpperCase();
        const priceData = await binance.getPrice(symbol);
        const currentPrice = parseFloat(priceData.price);
        
        // Calculate position value and P&L
        const entryValue = parseFloat(position.entry_price) * parseFloat(position.quantity);
        const currentValue = currentPrice * parseFloat(position.quantity);
        const positionPnL = currentValue - entryValue;
        
        unrealizedPnL += positionPnL;
        positionsValue += currentValue;
        
        // Update position in database
        await query(`
          UPDATE positions 
          SET current_price = $1, 
              unrealized_pnl = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [currentPrice, positionPnL, position.id]);
        
      } catch (error) {
        console.error(`Error updating position ${position.symbol}:`, error);
      }
    }
    
    // Calculate total portfolio value
    const realizedPnL = parseFloat(tradeStats.total_pnl) || 0;
    const totalPnL = realizedPnL + unrealizedPnL;
    const balance = parseFloat(portfolio.balance);
    const totalValue = balance + positionsValue;
    
    // Update portfolio in database
    await query(`
      UPDATE portfolio 
      SET total_value = $1,
          profit_loss = $2,
          updated_at = NOW()
      WHERE id = 1
    `, [totalValue, totalPnL]);
    
    // Calculate win rate
    const totalCompletedTrades = parseInt(tradeStats.total_trades) || 0;
    const winningTrades = parseInt(tradeStats.winning_trades) || 0;
    const winRate = totalCompletedTrades > 0 
      ? (winningTrades / totalCompletedTrades * 100).toFixed(2)
      : 0;
    
    res.json({
      success: true,
      portfolio: {
        id: 1,
        balance: balance,
        total_value: totalValue,
        profit_loss: totalPnL,
        positions_json: portfolio.positions_json,
        mode: portfolio.mode,
        updated_at: new Date().toISOString()
      },
      stats: {
        realized_pnl: realizedPnL,
        unrealized_pnl: unrealizedPnL,
        total_pnl: totalPnL,
        positions_value: positionsValue,
        open_positions: positionsResult.rows.length,
        total_trades: totalCompletedTrades,
        winning_trades: winningTrades,
        losing_trades: parseInt(tradeStats.losing_trades) || 0,
        win_rate: winRate,
        roi: ((totalPnL / 10000) * 100).toFixed(2) + '%'
      },
      positions: positionsResult.rows
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST/PUT update portfolio state
router.post('/', async (req, res) => {
  try {
    const { balance, positions, mode, total_value, profit_loss } = req.body;
    
    if (balance === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Balance is required'
      });
    }
    
    const result = await query(`
      INSERT INTO portfolio (id, balance, total_value, profit_loss, positions_json, mode, updated_at)
      VALUES (1, $1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) 
      DO UPDATE SET 
        balance = $1,
        total_value = $2,
        profit_loss = $3,
        positions_json = $4,
        mode = $5,
        updated_at = NOW()
      RETURNING *
    `, [
      balance, 
      total_value || balance, 
      profit_loss || 0, 
      JSON.stringify(positions || {}), 
      mode || 'paper'
    ]);
    
    res.json({
      success: true,
      portfolio: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating portfolio:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST reset portfolio to default
router.post('/reset', async (req, res) => {
  try {
    // Delete all positions
    await query('DELETE FROM positions');
    
    // Reset portfolio
    await query(`
      INSERT INTO portfolio (id, balance, total_value, profit_loss, positions_json, mode)
      VALUES (1, 10000, 10000, 0, '{}', 'paper')
      ON CONFLICT (id)
      DO UPDATE SET
        balance = 10000,
        total_value = 10000,
        profit_loss = 0,
        positions_json = '{}',
        updated_at = NOW()
    `);
    
    res.json({
      success: true,
      message: 'Portfolio reset to $10,000'
    });
  } catch (error) {
    console.error('Error resetting portfolio:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET portfolio performance over time
router.get('/performance', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        SUM(profit_loss) as daily_pnl,
        COUNT(*) as trades_count
      FROM trades
      WHERE profit_loss IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);
    
    res.json({
      success: true,
      performance: result.rows
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
