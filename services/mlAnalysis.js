// ML Analysis Service - Advanced Market Analysis and Prediction
const crypto = require('crypto');

class MLAnalysisService {
  constructor() {
    this.models = {
      pricePredictor: null,
      sentimentAnalyzer: null,
      patternRecognizer: null,
      riskAssessor: null
    };
    
    this.indicators = {};
    this.predictions = {};
    this.sentimentScores = {};
  }

  // ============= TECHNICAL INDICATORS =============
  
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }

  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return null;
    
    const emaFast = this.calculateEMA(prices, fastPeriod);
    const emaSlow = this.calculateEMA(prices, slowPeriod);
    
    const macdLine = emaFast - emaSlow;
    
    // Simple signal line calculation
    const macdHistory = [];
    for (let i = 0; i < signalPeriod && i < prices.length; i++) {
      macdHistory.push(emaFast - emaSlow);
    }
    
    const signal = macdHistory.reduce((a, b) => a + b, 0) / macdHistory.length;
    const histogram = macdLine - signal;
    
    return {
      macd: macdLine,
      signal: signal,
      histogram: histogram
    };
  }

  calculateEMA(prices, period) {
    if (prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    
    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
  }

  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    const sma = this.calculateSMA(prices, period);
    if (!sma) return null;
    
    const slice = prices.slice(-period);
    const variance = slice.reduce((sum, price) => {
      return sum + Math.pow(price - sma, 2);
    }, 0) / period;
    
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  calculateATR(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return null;
    
    const trueRanges = [];
    
    for (let i = 1; i < highs.length; i++) {
      const highLow = highs[i] - lows[i];
      const highClose = Math.abs(highs[i] - closes[i - 1]);
      const lowClose = Math.abs(lows[i] - closes[i - 1]);
      
      trueRanges.push(Math.max(highLow, highClose, lowClose));
    }
    
    return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  // ============= PATTERN RECOGNITION =============
  
  detectPatterns(prices, volumes) {
    const patterns = [];
    
    // Detect trend
    const trend = this.detectTrend(prices);
    if (trend) patterns.push(trend);
    
    // Detect support/resistance
    const levels = this.detectSupportResistance(prices);
    patterns.push(...levels);
    
    // Detect candlestick patterns
    const candlePatterns = this.detectCandlestickPatterns(prices);
    patterns.push(...candlePatterns);
    
    // Detect volume patterns
    const volumePatterns = this.detectVolumePatterns(volumes);
    patterns.push(...volumePatterns);
    
    return patterns;
  }

  detectTrend(prices, period = 20) {
    if (prices.length < period) return null;
    
    const recentPrices = prices.slice(-period);
    const firstHalf = recentPrices.slice(0, period / 2);
    const secondHalf = recentPrices.slice(period / 2);
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = ((avgSecond - avgFirst) / avgFirst) * 100;
    
    let strength = 'weak';
    if (Math.abs(change) > 5) strength = 'strong';
    else if (Math.abs(change) > 2) strength = 'moderate';
    
    return {
      type: 'trend',
      direction: change > 0 ? 'uptrend' : 'downtrend',
      strength: strength,
      changePercent: change.toFixed(2),
      confidence: Math.min(Math.abs(change) * 10, 95)
    };
  }

  detectSupportResistance(prices, tolerance = 0.02) {
    const levels = [];
    const priceMap = new Map();
    
    // Group similar prices
    prices.forEach(price => {
      let found = false;
      for (let [level, count] of priceMap) {
        if (Math.abs(price - level) / level < tolerance) {
          priceMap.set(level, count + 1);
          found = true;
          break;
        }
      }
      if (!found) priceMap.set(price, 1);
    });
    
    // Find significant levels
    const avgCount = Array.from(priceMap.values()).reduce((a, b) => a + b, 0) / priceMap.size;
    
    for (let [level, count] of priceMap) {
      if (count > avgCount * 1.5) {
        const currentPrice = prices[prices.length - 1];
        levels.push({
          type: level > currentPrice ? 'resistance' : 'support',
          price: level,
          strength: count,
          distance: ((level - currentPrice) / currentPrice * 100).toFixed(2)
        });
      }
    }
    
    return levels.sort((a, b) => b.strength - a.strength).slice(0, 3);
  }

  detectCandlestickPatterns(prices) {
    const patterns = [];
    const len = prices.length;
    
    if (len < 3) return patterns;
    
    // Doji pattern
    const lastClose = prices[len - 1];
    const lastOpen = prices[len - 2];
    
    if (Math.abs(lastClose - lastOpen) / lastOpen < 0.001) {
      patterns.push({
        type: 'candlestick',
        pattern: 'doji',
        signal: 'indecision',
        confidence: 70
      });
    }
    
    // Hammer pattern (simplified)
    const prevClose = prices[len - 2];
    const change = ((lastClose - prevClose) / prevClose) * 100;
    
    if (change < -2 && lastClose > lastOpen) {
      patterns.push({
        type: 'candlestick',
        pattern: 'hammer',
        signal: 'bullish_reversal',
        confidence: 65
      });
    }
    
    return patterns;
  }

  detectVolumePatterns(volumes) {
    if (!volumes || volumes.length < 5) return [];
    
    const patterns = [];
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const lastVolume = volumes[volumes.length - 1];
    
    if (lastVolume > avgVolume * 1.5) {
      patterns.push({
        type: 'volume',
        pattern: 'volume_spike',
        signal: 'high_interest',
        multiplier: (lastVolume / avgVolume).toFixed(2),
        confidence: 75
      });
    }
    
    return patterns;
  }

  // ============= PRICE PREDICTION =============
  
  async predictPrice(historicalData, horizon = '1h') {
    const { prices, volumes, timestamps } = historicalData;
    
    // Calculate technical indicators
    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const bb = this.calculateBollingerBands(prices);
    
    // Detect patterns
    const patterns = this.detectPatterns(prices, volumes);
    
    // Simple linear regression prediction
    const prediction = this.simpleLinearPrediction(prices);
    
    // Calculate confidence based on indicators alignment
    const confidence = this.calculatePredictionConfidence({
      rsi, macd, sma20, sma50, bb, patterns, prices
    });
    
    return {
      currentPrice: prices[prices.length - 1],
      predictedPrice: prediction.price,
      direction: prediction.direction,
      confidence: confidence,
      horizon: horizon,
      indicators: {
        rsi: rsi?.toFixed(2),
        macd: macd ? {
          value: macd.macd.toFixed(2),
          signal: macd.signal.toFixed(2),
          histogram: macd.histogram.toFixed(2)
        } : null,
        sma20: sma20?.toFixed(2),
        sma50: sma50?.toFixed(2),
        bollingerBands: bb
      },
      patterns: patterns,
      timestamp: new Date().toISOString()
    };
  }

  simpleLinearPrediction(prices, lookAhead = 1) {
    const n = prices.length;
    if (n < 10) return { price: prices[n - 1], direction: 'neutral' };
    
    // Use last 20 points for trend
    const recentPrices = prices.slice(-20);
    const m = recentPrices.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < m; i++) {
      sumX += i;
      sumY += recentPrices[i];
      sumXY += i * recentPrices[i];
      sumX2 += i * i;
    }
    
    const slope = (m * sumXY - sumX * sumY) / (m * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / m;
    
    const predictedPrice = slope * (m + lookAhead) + intercept;
    const currentPrice = prices[n - 1];
    
    const change = ((predictedPrice - currentPrice) / currentPrice) * 100;
    
    return {
      price: predictedPrice,
      direction: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral',
      changePercent: change.toFixed(2)
    };
  }

  calculatePredictionConfidence(data) {
    const { rsi, macd, sma20, sma50, patterns, prices } = data;
    
    let confidence = 50; // Base confidence
    const currentPrice = prices[prices.length - 1];
    
    // RSI alignment
    if (rsi) {
      if (rsi < 30 || rsi > 70) confidence += 10; // Strong signal
      if (rsi > 30 && rsi < 70) confidence += 5; // Neutral range
    }
    
    // MACD alignment
    if (macd) {
      if (Math.abs(macd.histogram) > 0) confidence += 8;
    }
    
    // Moving average alignment
    if (sma20 && sma50) {
      if ((sma20 > sma50 && currentPrice > sma20) || 
          (sma20 < sma50 && currentPrice < sma20)) {
        confidence += 10;
      }
    }
    
    // Pattern confidence
    patterns.forEach(pattern => {
      if (pattern.confidence) {
        confidence += pattern.confidence * 0.1;
      }
    });
    
    return Math.min(confidence, 95).toFixed(2);
  }

  // ============= SENTIMENT ANALYSIS =============
  
  async analyzeSentiment(textData) {
    // Simple keyword-based sentiment analysis
    const bullishKeywords = ['bullish', 'moon', 'pump', 'rally', 'breakout', 'surge', 'growth', 'profit', 'gain'];
    const bearishKeywords = ['bearish', 'crash', 'dump', 'fall', 'drop', 'loss', 'decline', 'sell', 'fear'];
    
    let bullishCount = 0;
    let bearishCount = 0;
    
    const lowerText = textData.toLowerCase();
    
    bullishKeywords.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
      bullishCount += count;
    });
    
    bearishKeywords.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
      bearishCount += count;
    });
    
    const total = bullishCount + bearishCount;
    const score = total > 0 ? ((bullishCount - bearishCount) / total) * 100 : 0;
    
    return {
      score: score.toFixed(2),
      sentiment: score > 20 ? 'bullish' : score < -20 ? 'bearish' : 'neutral',
      bullishCount,
      bearishCount,
      confidence: Math.min((total / 10) * 100, 90).toFixed(2)
    };
  }

  // ============= ANOMALY DETECTION =============
  
  detectAnomalies(prices, volumes, threshold = 2.5) {
    const anomalies = [];
    
    // Price anomalies
    const priceMean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const priceStdDev = Math.sqrt(
      prices.reduce((sum, price) => sum + Math.pow(price - priceMean, 2), 0) / prices.length
    );
    
    const lastPrice = prices[prices.length - 1];
    const priceZScore = Math.abs((lastPrice - priceMean) / priceStdDev);
    
    if (priceZScore > threshold) {
      anomalies.push({
        type: 'price_anomaly',
        severity: priceZScore > 3 ? 'high' : 'medium',
        zScore: priceZScore.toFixed(2),
        description: `Unusual price movement detected (${priceZScore.toFixed(1)}σ from mean)`
      });
    }
    
    // Volume anomalies
    if (volumes && volumes.length > 0) {
      const volumeMean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const lastVolume = volumes[volumes.length - 1];
      
      if (lastVolume > volumeMean * 3) {
        anomalies.push({
          type: 'volume_anomaly',
          severity: 'high',
          multiplier: (lastVolume / volumeMean).toFixed(2),
          description: `Unusual trading volume detected (${(lastVolume / volumeMean).toFixed(1)}x normal)`
        });
      }
    }
    
    return anomalies;
  }

  // ============= ARBITRAGE DETECTION =============
  
  detectArbitrage(pricesByExchange) {
    const opportunities = [];
    const exchanges = Object.keys(pricesByExchange);
    
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = i + 1; j < exchanges.length; j++) {
        const exchange1 = exchanges[i];
        const exchange2 = exchanges[j];
        const price1 = pricesByExchange[exchange1];
        const price2 = pricesByExchange[exchange2];
        
        const diff = Math.abs(price1 - price2);
        const diffPercent = (diff / Math.min(price1, price2)) * 100;
        
        if (diffPercent > 0.5) { // More than 0.5% difference
          opportunities.push({
            type: 'arbitrage',
            buyExchange: price1 < price2 ? exchange1 : exchange2,
            sellExchange: price1 < price2 ? exchange2 : exchange1,
            buyPrice: Math.min(price1, price2),
            sellPrice: Math.max(price1, price2),
            profit: diff,
            profitPercent: diffPercent.toFixed(2),
            potential: diffPercent > 1 ? 'high' : 'medium'
          });
        }
      }
    }
    
    return opportunities;
  }

  // ============= COMPREHENSIVE ANALYSIS =============
  
  async performComprehensiveAnalysis(marketData) {
    const { symbol, prices, volumes, highs, lows, closes, sentiment, exchanges } = marketData;
    
    try {
      // Technical Analysis
      const rsi = this.calculateRSI(prices);
      const macd = this.calculateMACD(prices);
      const sma20 = this.calculateSMA(prices, 20);
      const sma50 = this.calculateSMA(prices, 50);
      const bb = this.calculateBollingerBands(prices);
      const atr = this.calculateATR(highs, lows, closes);
      
      // Pattern Recognition
      const patterns = this.detectPatterns(prices, volumes);
      
      // Price Prediction
      const prediction = await this.predictPrice({ prices, volumes, timestamps: [] });
      
      // Sentiment Analysis
      const sentimentAnalysis = sentiment ? await this.analyzeSentiment(sentiment) : null;
      
      // Anomaly Detection
      const anomalies = this.detectAnomalies(prices, volumes);
      
      // Arbitrage Opportunities
      const arbitrage = exchanges ? this.detectArbitrage(exchanges) : [];
      
      // Generate Trading Signal
      const signal = this.generateTradingSignal({
        rsi, macd, sma20, sma50, bb, patterns, prediction, sentimentAnalysis, anomalies
      });
      
      return {
        symbol,
        timestamp: new Date().toISOString(),
        currentPrice: prices[prices.length - 1],
        technicalIndicators: {
          rsi: rsi?.toFixed(2),
          macd: macd,
          sma20: sma20?.toFixed(2),
          sma50: sma50?.toFixed(2),
          bollingerBands: bb,
          atr: atr?.toFixed(2)
        },
        patterns,
        prediction,
        sentiment: sentimentAnalysis,
        anomalies,
        arbitrageOpportunities: arbitrage,
        signal,
        metadata: {
          dataPoints: prices.length,
          analysisVersion: '2.0',
          modelConfidence: prediction.confidence
        }
      };
    } catch (error) {
      console.error('Error in comprehensive analysis:', error);
      throw error;
    }
  }

  generateTradingSignal(analysis) {
    const { rsi, macd, sma20, sma50, prediction, sentimentAnalysis, anomalies } = analysis;
    
    let bullishSignals = 0;
    let bearishSignals = 0;
    let strength = 0;
    
    // RSI signals
    if (rsi) {
      if (rsi < 30) { bullishSignals++; strength += 2; }
      else if (rsi > 70) { bearishSignals++; strength += 2; }
    }
    
    // MACD signals
    if (macd && macd.histogram > 0) bullishSignals++;
    else if (macd && macd.histogram < 0) bearishSignals++;
    
    // Moving average signals
    if (sma20 && sma50) {
      if (sma20 > sma50) { bullishSignals++; strength++; }
      else if (sma20 < sma50) { bearishSignals++; strength++; }
    }
    
    // Prediction signals
    if (prediction.direction === 'up') { bullishSignals++; strength++; }
    else if (prediction.direction === 'down') { bearishSignals++; strength++; }
    
    // Sentiment signals
    if (sentimentAnalysis) {
      if (sentimentAnalysis.sentiment === 'bullish') bullishSignals++;
      else if (sentimentAnalysis.sentiment === 'bearish') bearishSignals++;
    }
    
    // Check for anomalies (caution signal)
    const hasAnomalies = anomalies && anomalies.length > 0;
    
    const totalSignals = bullishSignals + bearishSignals;
    const signalStrength = totalSignals > 0 ? (strength / totalSignals) * 100 : 0;
    
    let action = 'HOLD';
    if (bullishSignals > bearishSignals + 2) action = 'BUY';
    else if (bearishSignals > bullishSignals + 2) action = 'SELL';
    
    // Override if anomalies detected
    if (hasAnomalies && anomalies.some(a => a.severity === 'high')) {
      action = 'HOLD';
    }
    
    return {
      action,
      confidence: Math.min(signalStrength, 95).toFixed(2),
      bullishSignals,
      bearishSignals,
      strength: signalStrength.toFixed(2),
      reasoning: this.generateSignalReasoning(action, bullishSignals, bearishSignals, hasAnomalies)
    };
  }

  generateSignalReasoning(action, bullish, bearish, hasAnomalies) {
    const reasons = [];
    
    if (action === 'BUY') {
      reasons.push(`Strong bullish sentiment (${bullish} signals)`);
      if (bearish > 0) reasons.push(`Some caution advised (${bearish} bearish signals)`);
    } else if (action === 'SELL') {
      reasons.push(`Strong bearish sentiment (${bearish} signals)`);
      if (bullish > 0) reasons.push(`Some support present (${bullish} bullish signals)`);
    } else {
      reasons.push(`Mixed signals (${bullish} bullish, ${bearish} bearish)`);
    }
    
    if (hasAnomalies) {
      reasons.push('⚠️ Market anomalies detected - proceed with caution');
    }
    
    return reasons.join('. ');
  }
}

module.exports = MLAnalysisService;
