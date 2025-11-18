const express = require('express');
const router = express.Router();
const AdvancedMLService = require('../services/advancedML');
const FundamentalAnalysisService = require('../services/fundamentalAnalysis');
const DataCollectionService = require('../services/dataCollection');
const BinanceAPI = require('../services/binanceAPI');

// Initialize services
const binance = new BinanceAPI(
  process.env.BINANCE_API_KEY || '',
  process.env.BINANCE_SECRET || ''
);

const advancedML = new AdvancedMLService();
const fundamental = new FundamentalAnalysisService();
const dataCollection = new DataCollectionService(binance);

// ============= ADVANCED ML PREDICTION =============

router.post('/predict-advanced', async (req, res) => {
  try {
    const { symbol = 'BTC/USDT', horizon = '1h' } = req.body;
    
    console.log(`🤖 Advanced ML prediction for ${symbol}`);
    
    // Collect market data
    const marketData = await dataCollection.collectComprehensiveMarketData([symbol]);
    
    if (marketData[symbol].error) {
      return res.status(400).json({
        success: false,
        error: marketData[symbol].error
      });
    }
    
    const normalized = marketData[symbol].normalized;
    
    // Calculate advanced features
    const features = advancedML.calculateAdvancedFeatures(normalized);
    
    // Get ensemble prediction
    const ensemblePrediction = await advancedML.predictWithEnsemble(features);
    
    // Get LSTM prediction
    const lstmPrediction = await advancedML.predictWithLSTM(features, horizon);
    
    // Detect market regime
    const regime = advancedML.detectMarketRegime(normalized);
    
    res.json({
      success: true,
      symbol,
      timestamp: new Date().toISOString(),
      currentPrice: normalized.prices[normalized.prices.length - 1],
      predictions: {
        ensemble: ensemblePrediction,
        lstm: lstmPrediction
      },
      marketRegime: regime,
      features: {
        rsi: features.rsi,
        macd: features.macd,
        volatility: features.volatility,
        trend: advancedML.calculateTrend(normalized.prices)
      }
    });
  } catch (error) {
    console.error('Advanced ML prediction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= FUNDAMENTAL ANALYSIS =============

router.get('/fundamental/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    console.log(`📊 Fundamental analysis for ${symbol}`);
    
    // Get comprehensive fundamental score
    const fundamentalScore = await fundamental.getFundamentalScore(symbol);
    
    res.json({
      success: true,
      ...fundamentalScore
    });
  } catch (error) {
    console.error('Fundamental analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= ON-CHAIN METRICS =============

router.get('/onchain/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    console.log(`⛓️ On-chain metrics for ${symbol}`);
    
    const onChainMetrics = await fundamental.getOnChainMetrics(symbol);
    
    res.json({
      success: true,
      ...onChainMetrics
    });
  } catch (error) {
    console.error('On-chain metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= WHALE ACTIVITY =============

router.get('/whales/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    console.log(`🐋 Whale activity for ${symbol}`);
    
    const whaleActivity = await fundamental.getWhaleActivity(symbol);
    
    res.json({
      success: true,
      ...whaleActivity
    });
  } catch (error) {
    console.error('Whale activity error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= MACRO INDICATORS =============

router.get('/macro', async (req, res) => {
  try {
    console.log(`🌍 Macro indicators`);
    
    const macroIndicators = await fundamental.getMacroIndicators();
    
    res.json({
      success: true,
      ...macroIndicators
    });
  } catch (error) {
    console.error('Macro indicators error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= NEWS SENTIMENT =============

router.get('/news/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    console.log(`📰 News sentiment for ${symbol}`);
    
    const newsSentiment = await fundamental.getNewsSentiment(symbol);
    
    res.json({
      success: true,
      ...newsSentiment
    });
  } catch (error) {
    console.error('News sentiment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= MARKET DOMINANCE =============

router.get('/dominance', async (req, res) => {
  try {
    console.log(`📈 Market dominance`);
    
    const dominance = await fundamental.getMarketDominance();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...dominance
    });
  } catch (error) {
    console.error('Market dominance error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============= COMBINED SIGNAL =============

router.post('/signal-combined', async (req, res) => {
  try {
    const { symbol = 'BTC/USDT' } = req.body;
    
    console.log(`🎯 Combined signal for ${symbol}`);
    
    // Get market data
    const marketData = await dataCollection.collectComprehensiveMarketData([symbol]);
    
    if (marketData[symbol].error) {
      return res.status(400).json({
        success: false,
        error: marketData[symbol].error
      });
    }
    
    const normalized = marketData[symbol].normalized;
    
    // Get technical signal
    const features = advancedML.calculateAdvancedFeatures(normalized);
    const technicalPrediction = await advancedML.predictWithEnsemble(features);
    const regime = advancedML.detectMarketRegime(normalized);
    
    // Get fundamental signal
    const fundamentalScore = await fundamental.getFundamentalScore(symbol);
    
    // Combine signals
    const technicalScore = parseFloat(technicalPrediction.confidence);
    const fundamentalWeight = parseFloat(fundamentalScore.fundamentalScore);
    
    // Weighted combination (60% technical, 40% fundamental)
    const combinedScore = (technicalScore * 0.6) + (fundamentalWeight * 0.4);
    
    let action = 'HOLD';
    if (combinedScore > 70 && regime.regime.includes('bullish')) {
      action = 'BUY';
    } else if (combinedScore < 40 && regime.regime.includes('bearish')) {
      action = 'SELL';
    }
    
    res.json({
      success: true,
      symbol,
      timestamp: new Date().toISOString(),
      signal: {
        action,
        confidence: combinedScore.toFixed(2),
        technicalScore: technicalScore.toFixed(2),
        fundamentalScore: fundamentalWeight.toFixed(2)
      },
      technical: {
        prediction: technicalPrediction,
        regime: regime
      },
      fundamental: {
        score: fundamentalScore.fundamentalScore,
        rating: fundamentalScore.rating,
        recommendation: fundamentalScore.tradingRecommendation
      },
      reasoning: generateReasoning(action, technicalScore, fundamentalWeight, regime)
    });
  } catch (error) {
    console.error('Combined signal error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function
function generateReasoning(action, technical, fundamental, regime) {
  const reasons = [];
  
  if (action === 'BUY') {
    reasons.push(`Strong buy signal (combined score: ${((technical * 0.6 + fundamental * 0.4)).toFixed(1)})`);
    if (technical > 70) reasons.push('Technical indicators bullish');
    if (fundamental > 70) reasons.push('Strong fundamentals');
    if (regime.regime.includes('bullish')) reasons.push(`Market regime: ${regime.regime}`);
  } else if (action === 'SELL') {
    reasons.push(`Strong sell signal (combined score: ${((technical * 0.6 + fundamental * 0.4)).toFixed(1)})`);
    if (technical < 40) reasons.push('Technical indicators bearish');
    if (fundamental < 40) reasons.push('Weak fundamentals');
    if (regime.regime.includes('bearish')) reasons.push(`Market regime: ${regime.regime}`);
  } else {
    reasons.push('Mixed signals, waiting for clearer opportunity');
    reasons.push(`Technical: ${technical.toFixed(1)}, Fundamental: ${fundamental.toFixed(1)}`);
  }
  
  return reasons.join('. ');
}

module.exports = router;
