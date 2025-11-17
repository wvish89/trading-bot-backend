const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const BinanceAPI = require('../services/binanceAPI');
const MLAnalysisService = require('../services/mlAnalysis');
const RiskManagementService = require('../services/riskManagement');
const DataCollectionService = require('../services/dataCollection');
const StrategyExecutionService = require('../services/strategyExecution');
const NotificationService = require('../services/notifications');

// Initialize services
const binance = new BinanceAPI(
  process.env.BINANCE_API_KEY || '',
  process.env.BINANCE_SECRET || ''
);

const mlAnalysis = new MLAnalysisService();
const riskManagement = new RiskManagementService({
  maxPositionSize: 0.1,
  maxDrawdown: 0.2,
  riskPerTrade: 0.02,
  maxOpenPositions: 5
});

const dataCollection = new DataCollectionService(binance);

const notifications = new NotificationService({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID
});

const strategyExecution = new StrategyExecutionService(
  binance,
  riskManagement,
  mlAnalysis,
  notifications
);

// ============= COMPREHENSIVE MARKET ANALYSIS =============

router.post('/analyze', async (req, res) => {
  try {
    const { symbols = ['BTC/USDT', 'ETH/USDT'] } = req.body;
    
    console.log(`📊 Starting comprehensive analysis for: ${symbols.join(', ')}`);
    
    // Collect market data
    const marketData = await dataCollection.collectComprehensiveMarketData(symbols);
    
    // Analyze each symbol
    const analyses = {};
    
    for (const symbol of symbols) {
      if (marketData[symbol].error) {
        analyses[symbol] = { error: marketData[symbol].error };
        continue;
      }
      
      const data = marketData[symbol];
      const normalized = data.normalized;
      
      if (!normalized) {
        analyses[symbol] = { error: 'Insufficient data for analysis' };
        continue;
      }
      
      // Perform comprehensive ML analysis
      const analysis = await mlAnalysis.performComprehensiveAnalysis({
        symbol,
        prices: normalized.prices,
        volumes: normalized.volumes,
        highs: normalized.highs,
        lows: normalized.lows,
        closes: normalized.closes,
        sentiment: data.sentiment,
        exchanges: { binance: data.realtime.currentPrice }
      });
      
      analyses[symbol] = analysis;
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      analyses,
      metadata: {
        symbolsAnalyzed: symbols.length,
        analysisVersion: '2.0'
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= STRATEGY EXECUTION =============

router.post('/execute-strategy', async (req, res) => {
  try {
    const { 
      strategy = 'momentum',
      symbol = 'BTC/USDT',
      mode = 'paper'
    } = req.body;
    
    console.log(`🎯 Executing ${strategy} strategy for ${symbol} in ${mode} mode`);
    
    // Get market data
    const marketData = await dataCollection.collectComprehensiveMarketData([symbol]);
    
    if (marketData[symbol].error) {
      return res.status(400).json({
        success: false,
        error: marketData[symbol].error
      });
    }
    
    // Get portfolio data
    const portfolioResult = await query('SELECT * FROM portfolio WHERE id = 1');
    const portfolio = portfolioResult.rows[0] || {
      balance: 10000,
      positions_json: {}
    };
    
    const positionsResult = await query('SELECT * FROM positions');
    
    const portfolioData = {
      symbol,
      balance: parseFloat(portfolio.balance),
      positions: positionsResult.rows
    };
    
    // Execute strategy
    const signal = await strategyExecution.executeStrategy(
      strategy,
      marketData[symbol],
      portfolioData
    );
    
    // Execute the trade if signal is valid
    let execution = null;
    if (signal.action !== 'HOLD' && !signal.error) {
      execution = await strategyExecution.executeSignal(signal, portfolioData, mode);
    }
    
    res.json({
      success: true,
      strategy,
      symbol,
      mode,
      signal,
      execution,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Strategy execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= RISK ASSESSMENT =============

router.post('/risk-assessment', async (req, res) => {
  try {
    const { 
      entryPrice,
      quantity,
      stopLoss,
      takeProfit,
      symbol,
      positionType = 'LONG'
    } = req.body;
    
    // Get portfolio data
    const portfolioResult = await query('SELECT * FROM portfolio WHERE id = 1');
    const portfolio = portfolioResult.rows[0] || { balance: 10000 };
    
    const positionsResult = await query('SELECT * FROM positions');
    
    const assessment = riskManagement.assessTradeRisk({
      entryPrice: parseFloat(entryPrice),
      quantity: parseFloat(quantity),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      accountBalance: parseFloat(portfolio.balance),
      currentPositions: positionsResult.rows,
      positionType,
      symbol
    });
    
    res.json({
      success: true,
      assessment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= RISK REPORT =============

router.get('/risk-report', async (req, res) => {
  try {
    // Get portfolio data
    const portfolioResult = await query('SELECT * FROM portfolio WHERE id = 1');
    const portfolio = portfolioResult.rows[0] || {
      balance: 10000,
      total_value: 10000,
      profit_loss: 0
    };
    
    const positionsResult = await query('SELECT * FROM positions');
    
    // Calculate daily/weekly P&L
    const todayResult = await query(`
      SELECT COALESCE(SUM(profit_loss), 0) as daily_pnl
      FROM trades
      WHERE DATE(created_at) = CURRENT_DATE
    `);
    
    const weekResult = await query(`
      SELECT COALESCE(SUM(profit_loss), 0) as weekly_pnl
      FROM trades
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    `);
    
    const report = riskManagement.generateRiskReport({
      accountBalance: parseFloat(portfolio.balance),
      positions: positionsResult.rows,
      dailyPnL: parseFloat(todayResult.rows[0].daily_pnl) || 0,
      weeklyPnL: parseFloat(weekResult.rows[0].weekly_pnl) || 0,
      peakBalance: parseFloat(portfolio.total_value)
    });
    
    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Risk report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= BACKTEST STRATEGY =============

router.post('/backtest', async (req, res) => {
  try {
    const { 
      strategy = 'momentum',
      symbol = 'BTC/USDT',
      initialBalance = 10000,
      period = '1h',
      limit = 500
    } = req.body;
    
    console.log(`📊 Backtesting ${strategy} on ${symbol}...`);
    
    // Get historical data
    const binanceSymbol = symbol.replace('/', '').toUpperCase();
    const klines = await dataCollection.getKlines(binanceSymbol, period, limit);
    
    const historicalData = {
      prices: klines.map(k => k.close),
      volumes: klines.map(k => k.volume),
      highs: klines.map(k => k.high),
      lows: klines.map(k => k.low)
    };
    
    // Run backtest
    const results = await strategyExecution.backtestStrategy(
      strategy,
      historicalData,
      initialBalance
    );
    
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backtest error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= PORTFOLIO REBALANCING =============

router.post('/rebalance', async (req, res) => {
  try {
    const { targetAllocation = {} } = req.body;
    
    // Get current positions
    const positionsResult = await query('SELECT * FROM positions');
    const portfolioResult = await query('SELECT * FROM portfolio WHERE id = 1');
    const portfolio = portfolioResult.rows[0] || { balance: 10000 };
    
    const rebalancing = riskManagement.suggestRebalancing(
      positionsResult.rows,
      parseFloat(portfolio.balance),
      targetAllocation
    );
    
    res.json({
      success: true,
      rebalancing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Rebalancing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= PRICE PREDICTION =============

router.post('/predict', async (req, res) => {
  try {
    const { symbol = 'BTC/USDT', horizon = '1h' } = req.body;
    
    // Get market data
    const marketData = await dataCollection.collectComprehensiveMarketData([symbol]);
    
    if (marketData[symbol].error) {
      return res.status(400).json({
        success: false,
        error: marketData[symbol].error
      });
    }
    
    const normalized = marketData[symbol].normalized;
    
    const prediction = await mlAnalysis.predictPrice(normalized, horizon);
    
    res.json({
      success: true,
      symbol,
      prediction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= ANOMALY DETECTION =============

router.get('/anomalies/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Get market data
    const marketData = await dataCollection.collectComprehensiveMarketData([symbol]);
    
    if (marketData[symbol].error) {
      return res.status(400).json({
        success: false,
        error: marketData[symbol].error
      });
    }
    
    const normalized = marketData[symbol].normalized;
    const anomalies = mlAnalysis.detectAnomalies(
      normalized.prices,
      normalized.volumes
    );
    
    res.json({
      success: true,
      symbol,
      anomalies,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= ARBITRAGE OPPORTUNITIES =============

router.get('/arbitrage', async (req, res) => {
  try {
    const { symbols = ['BTC/USDT'] } = req.query;
    
    // In production, fetch from multiple exchanges
    // For now, simulate with Binance data
    const opportunities = [];
    
    for (const symbol of Array.isArray(symbols) ? symbols : [symbols]) {
      const binanceSymbol = symbol.replace('/', '').toUpperCase();
      const price = await binance.getPrice(binanceSymbol);
      
      // Simulate exchange prices with slight variations
      const pricesByExchange = {
        'binance': parseFloat(price.price),
        'coinbase': parseFloat(price.price) * (1 + (Math.random() - 0.5) * 0.01),
        'kraken': parseFloat(price.price) * (1 + (Math.random() - 0.5) * 0.01)
      };
      
      const arb = mlAnalysis.detectArbitrage(pricesByExchange);
      
      if (arb.length > 0) {
        opportunities.push({
          symbol,
          opportunities: arb
        });
      }
    }
    
    res.json({
      success: true,
      opportunities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Arbitrage detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= AUTO-TRADING (24/7) =============

let autoTradingActive = false;
let autoTradingInterval = null;

router.post('/auto-trade/start', async (req, res) => {
  try {
    const { 
      symbols = ['BTC/USDT'],
      strategy = 'ml_prediction',
      mode = 'paper',
      interval = 300000 // 5 minutes
    } = req.body;
    
    if (autoTradingActive) {
      return res.status(400).json({
        success: false,
        error: 'Auto-trading already active'
      });
    }
    
    console.log(`🤖 Starting auto-trading with ${strategy} strategy...`);
    
    const executeAutoTrade = async () => {
      console.log(`🔄 Auto-trade cycle - ${new Date().toISOString()}`);
      
      for (const symbol of symbols) {
        try {
          const marketData = await dataCollection.collectComprehensiveMarketData([symbol]);
          
          const portfolioResult = await query('SELECT * FROM portfolio WHERE id = 1');
          const portfolio = portfolioResult.rows[0] || { balance: 10000 };
          const positionsResult = await query('SELECT * FROM positions');
          
          const portfolioData = {
            symbol,
            balance: parseFloat(portfolio.balance),
            positions: positionsResult.rows
          };
          
          const signal = await strategyExecution.executeStrategy(
            strategy,
            marketData[symbol],
            portfolioData
          );
          
          if (signal.action !== 'HOLD' && !signal.error) {
            await strategyExecution.executeSignal(signal, portfolioData, mode);
            console.log(`✅ Auto-trade executed: ${signal.action} ${symbol}`);
          }
        } catch (error) {
          console.error(`Auto-trade error for ${symbol}:`, error);
        }
      }
    };
    
    // Initial execution
    executeAutoTrade();
    
    // Set up interval
    autoTradingInterval = setInterval(executeAutoTrade, interval);
    autoTradingActive = true;
    
    res.json({
      success: true,
      message: 'Auto-trading started',
      config: {
        symbols,
        strategy,
        mode,
        interval
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Auto-trade start error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/auto-trade/stop', (req, res) => {
  if (!autoTradingActive) {
    return res.status(400).json({
      success: false,
      error: 'Auto-trading not active'
    });
  }
  
  clearInterval(autoTradingInterval);
  autoTradingActive = false;
  autoTradingInterval = null;
  
  console.log('🛑 Auto-trading stopped');
  
  res.json({
    success: true,
    message: 'Auto-trading stopped',
    timestamp: new Date().toISOString()
  });
});

router.get('/auto-trade/status', (req, res) => {
  res.json({
    success: true,
    active: autoTradingActive,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
