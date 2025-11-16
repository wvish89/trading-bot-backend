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
          balance: 10000,
          total_value: 10000,
          profit_loss: 0,
          positions: []
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
    
    // Calculate total value
    const positionsArray = Object.values(positions);
    let positionsValue = 0;
    if (positionsArray.length > 0) {
      // You'll need to pass current price to calculate position value
      // For now, we'll store positions separately
    }
    
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
    `, [balance, total_value, profit_loss, JSON.stringify(positions), mode]);
    
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
