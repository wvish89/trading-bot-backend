const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET all positions
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM positions ORDER BY opened_at DESC'
    );
    
    res.json({ 
      success: true,
      count: result.rows.length,
      positions: result.rows 
    });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET position by symbol
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await query(
      'SELECT * FROM positions WHERE symbol = $1',
      [symbol]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Position not found' 
      });
    }
    
    res.json({ 
      success: true,
      position: result.rows[0] 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// POST create new position
router.post('/', async (req, res) => {
  try {
    const { 
      symbol, 
      entry_price, 
      quantity, 
      stop_loss,
      take_profit,
      trailing_stop
    } = req.body;
    
    if (!symbol || !entry_price || !quantity) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: symbol, entry_price, quantity' 
      });
    }
    
    const result = await query(
      `INSERT INTO positions 
       (symbol, entry_price, current_price, quantity, stop_loss, take_profit, trailing_stop)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [symbol, entry_price, entry_price, quantity, stop_loss, take_profit, trailing_stop]
    );
    
    res.status(201).json({ 
      success: true, 
      position: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// PUT update position
router.put('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { 
      current_price, 
      stop_loss,
      take_profit,
      trailing_stop,
      unrealized_pnl
    } = req.body;
    
    const result = await query(
      `UPDATE positions 
       SET current_price = COALESCE($1, current_price),
           stop_loss = COALESCE($2, stop_loss),
           take_profit = COALESCE($3, take_profit),
           trailing_stop = COALESCE($4, trailing_stop),
           unrealized_pnl = COALESCE($5, unrealized_pnl),
           updated_at = CURRENT_TIMESTAMP
       WHERE symbol = $6
       RETURNING *`,
      [current_price, stop_loss, take_profit, trailing_stop, unrealized_pnl, symbol]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Position not found' 
      });
    }
    
    res.json({ 
      success: true,
      position: result.rows[0] 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// DELETE close position
router.delete('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const result = await query(
      'DELETE FROM positions WHERE symbol = $1 RETURNING *',
      [symbol]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Position not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Position closed',
      position: result.rows[0] 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;