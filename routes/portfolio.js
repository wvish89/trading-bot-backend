const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET current portfolio state
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM portfolio WHERE id = 1
    `);
    
    if (result.rows.length === 0) {
      // Return default portfolio
      return res.json({
        success: true,
        portfolio: {
          id: 1,
          balance: 10000,
          total_value: 10000,
          profit_loss: 0,
          positions_json: {},
          mode: 'paper'
        }
      });
    }
    
    res.json({
      success: true,
      portfolio: result.rows[0]
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
    const { balance, positions, mode } = req.body;
    
    if (balance === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Balance is required'
      });
    }
    
    // Calculate total value
    const positionsArray = Object.values(positions || {});
    let positionsValue = 0;
    
    // Note: In real scenario, you'd calculate position value with current prices
    // For now, we're storing it as JSON and calculating on frontend
    
    const total_value = balance + positionsValue;
    const profit_loss = total_value - 10000;
    
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
    `, [balance, total_value, profit_loss, JSON.stringify(positions || {}), mode || 'paper']);
    
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
    await query('DELETE FROM portfolio WHERE id = 1');
    
    // Re-insert default
    await query(`
      INSERT INTO portfolio (id, balance, total_value, profit_loss, positions_json, mode)
      VALUES (1, 10000, 10000, 0, '{}', 'paper')
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

module.exports = router;
