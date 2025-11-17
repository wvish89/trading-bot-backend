// Strategy Execution Service - Automated Trading Strategy Implementation
const { query } = require('../config/database');

class StrategyExecutionService {
  constructor(binanceAPI, riskManagement, mlAnalysis, notifications) {
    this.binanceAPI = binanceAPI;
    this.riskManagement = riskManagement;
    this.mlAnalysis = mlAnalysis;
    this.notifications = notifications;
    
    this.activeStrategies = new Map();
    this.executionHistory = [];
    this.backtestResults = new Map();
  }

  // ============= STRATEGY DEFINITIONS =============
  
  async executeStrategy(strategyName, marketData, portfolioData) {
    console.log(`🎯 Executing strategy: ${strategyName}`);
    
    const strategies = {
      'momentum': () => this.momentumStrategy(marketData, portfolioData),
      'mean_reversion': () => this.meanReversionStrategy(marketData, portfolioData),
      'breakout': () => this.breakoutStrategy(marketData, portfolioData),
      'scalping': () => this.scalpingStrategy(marketData, portfolioData),
      'swing': () => this.swingStrategy(marketData, portfolioData),
      'ml_prediction': () => this.mlPredictionStrategy(marketData, portfolioData)
    };
    
    if (!strategies[strategyName]) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }
    
    try {
      const signal = await strategies[strategyName]();
      
      // Risk assessment before execution
      if (signal.action !== 'HOLD') {
        const riskAssessment = this.riskManagement.assessTradeRisk({
          entryPrice: signal.entryPrice,
          quantity: signal.quantity,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          accountBalance: portfolioData.balance,
          currentPositions: portfolioData.positions,
          positionType: signal.action
        });
        
        if (!riskAssessment.approved) {
          console.warn('⚠️ Trade rejected by risk management:', riskAssessment.risks);
          signal.action = 'HOLD';
          signal.reason = 'Risk management rejection: ' + riskAssessment.risks.map(r => r.message).join(', ');
        } else {
          signal.riskAssessment = riskAssessment;
        }
      }
      
      return signal;
    } catch (error) {
      console.error(`Error executing strategy ${strategyName}:`, error);
      return {
        action: 'HOLD',
        reason: 'Strategy execution error: ' + error.message,
        error: true
      };
    }
  }

  // ============= MOMENTUM STRATEGY =============
  
  async momentumStrategy(marketData, portfolioData) {
    const { normalized, realtime } = marketData;
    const { prices, volumes } = normalized;
    
    // Calculate momentum indicators
    const rsi = this.mlAnalysis.calculateRSI(prices);
    const macd = this.mlAnalysis.calculateMACD(prices);
    const sma20 = this.mlAnalysis.calculateSMA(prices, 20);
    const sma50 = this.mlAnalysis.calculateSMA(prices, 50);
    
    const currentPrice = prices[prices.length - 1];
    let action = 'HOLD';
    let confidence = 50;
    
    // Strong momentum signals
    if (rsi < 40 && macd.histogram > 0 && sma20 > sma50) {
      action = 'BUY';
      confidence = 75;
    } else if (rsi > 60 && macd.histogram < 0 && sma20 < sma50) {
      action = 'SELL';
      confidence = 75;
    }
    
    // Calculate position size and risk parameters
    const positionSize = this.calculatePositionSize(
      portfolioData.balance,
      currentPrice,
      action
    );
    
    const stopLoss = this.riskManagement.calculateStopLoss(currentPrice, action);
    const takeProfit = this.riskManagement.calculateTakeProfit(currentPrice, action);
    
    return {
      strategy: 'momentum',
      action,
      entryPrice: currentPrice,
      quantity: positionSize,
      stopLoss,
      takeProfit,
      confidence,
      indicators: { rsi, macd, sma20, sma50 },
      reasoning: this.generateReasoning(action, { rsi, macd, sma20, sma50 })
    };
  }

  // ============= MEAN REVERSION STRATEGY =============
  
  async meanReversionStrategy(marketData, portfolioData) {
    const { normalized } = marketData;
    const { prices } = normalized;
    
    const bb = this.mlAnalysis.calculateBollingerBands(prices);
    const rsi = this.mlAnalysis.calculateRSI(prices);
    const currentPrice = prices[prices.length - 1];
    
    let action = 'HOLD';
    let confidence = 50;
    
    // Mean reversion signals
    if (currentPrice < bb.lower && rsi < 30) {
      action = 'BUY';
      confidence = 80;
    } else if (currentPrice > bb.upper && rsi > 70) {
      action = 'SELL';
      confidence = 80;
    }
    
    const positionSize = this.calculatePositionSize(
      portfolioData.balance,
      currentPrice,
      action
    );
    
    const stopLoss = this.riskManagement.calculateStopLoss(currentPrice, action);
    const takeProfit = bb.middle; // Target mean reversion to middle band
    
    return {
      strategy: 'mean_reversion',
      action,
      entryPrice: currentPrice,
      quantity: positionSize,
      stopLoss,
      takeProfit,
      confidence,
      indicators: { bb, rsi },
      reasoning: `Price at ${currentPrice < bb.lower ? 'lower' : currentPrice > bb.upper ? 'upper' : 'middle'} Bollinger Band, RSI: ${rsi.toFixed(2)}`
    };
  }

  // ============= BREAKOUT STRATEGY =============
  
  async breakoutStrategy(marketData, portfolioData) {
    const { normalized } = marketData;
    const { prices, volumes, highs, lows } = normalized;
    
    const currentPrice = prices[prices.length - 1];
    const atr = this.mlAnalysis.calculateATR(highs, lows, prices);
    
    // Find support/resistance levels
    const patterns = this.mlAnalysis.detectPatterns(prices, volumes);
    const supportResistance = patterns.filter(p => p.type === 'support' || p.type === 'resistance');
    
    let action = 'HOLD';
    let confidence = 50;
    
    // Check for breakouts
    const resistanceLevels = supportResistance.filter(p => p.type === 'resistance');
    const supportLevels = supportResistance.filter(p => p.type === 'support');
    
    // Breakout above resistance
    if (resistanceLevels.length > 0) {
      const nearestResistance = resistanceLevels[0].price;
      if (currentPrice > nearestResistance * 1.01) { // 1% above resistance
        action = 'BUY';
        confidence = 70;
      }
    }
    
    // Breakdown below support
    if (supportLevels.length > 0) {
      const nearestSupport = supportLevels[0].price;
      if (currentPrice < nearestSupport * 0.99) { // 1% below support
        action = 'SELL';
        confidence = 70;
      }
    }
    
    const positionSize = this.calculatePositionSize(
      portfolioData.balance,
      currentPrice,
      action
    );
    
    const stopLoss = this.riskManagement.calculateStopLoss(currentPrice, action, atr);
    const takeProfit = this.riskManagement.calculateTakeProfit(currentPrice, action);
    
    return {
      strategy: 'breakout',
      action,
      entryPrice: currentPrice,
      quantity: positionSize,
      stopLoss,
      takeProfit,
      confidence,
      indicators: { atr, supportResistance },
      reasoning: action === 'HOLD' ? 'No breakout detected' : `Breakout detected at ${currentPrice}`
    };
  }

  // ============= SCALPING STRATEGY =============
  
  async scalpingStrategy(marketData, portfolioData) {
    const { normalized, orderBook } = marketData;
    const { prices } = normalized;
    
    const currentPrice = prices[prices.length - 1];
    const ema5 = this.mlAnalysis.calculateEMA(prices, 5);
    const ema13 = this.mlAnalysis.calculateEMA(prices, 13);
    
    let action = 'HOLD';
    let confidence = 60;
    
    // Quick scalping signals
    if (ema5 > ema13 && currentPrice > ema5) {
      action = 'BUY';
      confidence = 65;
    } else if (ema5 < ema13 && currentPrice < ema5) {
      action = 'SELL';
      confidence = 65;
    }
    
    // Use order book pressure
    if (orderBook && orderBook.bidPressure > 60) {
      if (action === 'BUY') confidence += 10;
    } else if (orderBook && orderBook.askPressure > 60) {
      if (action === 'SELL') confidence += 10;
    }
    
    const positionSize = this.calculatePositionSize(
      portfolioData.balance,
      currentPrice,
      action,
      0.5 // Smaller position for scalping
    );
    
    // Tight stop loss for scalping
    const stopLoss = action === 'BUY' 
      ? currentPrice * 0.995 
      : currentPrice * 1.005;
    
    const takeProfit = action === 'BUY'
      ? currentPrice * 1.01
      : currentPrice * 0.99;
    
    return {
      strategy: 'scalping',
      action,
      entryPrice: currentPrice,
      quantity: positionSize,
      stopLoss,
      takeProfit,
      confidence,
      indicators: { ema5, ema13, orderBook },
      reasoning: 'Quick scalping opportunity based on EMAs and order book'
    };
  }

  // ============= SWING TRADING STRATEGY =============
  
  async swingStrategy(marketData, portfolioData) {
    const { normalized } = marketData;
    const { prices, volumes } = normalized;
    
    const currentPrice = prices[prices.length - 1];
    const sma20 = this.mlAnalysis.calculateSMA(prices, 20);
    const sma50 = this.mlAnalysis.calculateSMA(prices, 50);
    const rsi = this.mlAnalysis.calculateRSI(prices, 14);
    
    const trend = this.mlAnalysis.detectTrend(prices, 50);
    
    let action = 'HOLD';
    let confidence = 50;
    
    // Swing trading signals (hold positions for days/weeks)
    if (trend && trend.direction === 'uptrend' && trend.strength === 'strong') {
      if (rsi < 50 && currentPrice > sma20) {
        action = 'BUY';
        confidence = 75;
      }
    } else if (trend && trend.direction === 'downtrend' && trend.strength === 'strong') {
      if (rsi > 50 && currentPrice < sma20) {
        action = 'SELL';
        confidence = 75;
      }
    }
    
    const positionSize = this.calculatePositionSize(
      portfolioData.balance,
      currentPrice,
      action,
      1.5 // Larger position for swing trading
    );
    
    // Wider stop loss for swing trading
    const stopLoss = this.riskManagement.calculateStopLoss(currentPrice, action);
    const takeProfit = this.riskManagement.calculateTakeProfit(currentPrice, action, 3); // 3:1 R:R
    
    return {
      strategy: 'swing',
      action,
      entryPrice: currentPrice,
      quantity: positionSize,
      stopLoss,
      takeProfit,
      confidence,
      indicators: { sma20, sma50, rsi, trend },
      reasoning: `${trend ? trend.direction : 'No trend'} detected, RSI: ${rsi?.toFixed(2)}`
    };
  }

  // ============= ML PREDICTION STRATEGY =============
  
  async mlPredictionStrategy(marketData, portfolioData) {
    const { normalized, sentiment } = marketData;
    
    // Get ML prediction
    const prediction = await this.mlAnalysis.predictPrice(normalized);
    
    let action = 'HOLD';
    let confidence = prediction.confidence;
    
    if (prediction.direction === 'up' && prediction.confidence > 70) {
      action = 'BUY';
    } else if (prediction.direction === 'down' && prediction.confidence > 70) {
      action = 'SELL';
    }
    
    // Enhance with sentiment
    if (sentiment && sentiment.overall) {
      if (action === 'BUY' && sentiment.overall.sentiment === 'bullish') {
        confidence = Math.min(parseFloat(confidence) + 10, 95);
      } else if (action === 'SELL' && sentiment.overall.sentiment === 'bearish') {
        confidence = Math.min(parseFloat(confidence) + 10, 95);
      }
    }
    
    const currentPrice = prediction.currentPrice;
    const positionSize = this.calculatePositionSize(
      portfolioData.balance,
      currentPrice,
      action
    );
    
    const stopLoss = this.riskManagement.calculateStopLoss(currentPrice, action);
    const takeProfit = prediction.predictedPrice;
    
    return {
      strategy: 'ml_prediction',
      action,
      entryPrice: currentPrice,
      quantity: positionSize,
      stopLoss,
      takeProfit,
      confidence,
      prediction,
      reasoning: `ML predicts ${prediction.direction} movement to $${prediction.predictedPrice.toFixed(2)}`
    };
  }

  // ============= POSITION SIZE CALCULATION =============
  
  calculatePositionSize(balance, price, action, multiplier = 1) {
    if (action === 'HOLD') return 0;
    
    const baseSize = balance * this.riskManagement.config.maxPositionSize * multiplier;
    const quantity = baseSize / price;
    
    return parseFloat(quantity.toFixed(8));
  }

  // ============= TRADE EXECUTION =============
  
  async executeSignal(signal, portfolioData, mode = 'paper') {
    if (signal.action === 'HOLD') {
      return {
        executed: false,
        reason: signal.reasoning || 'No trade signal'
      };
    }
    
    console.log(`🔄 Executing ${mode.toUpperCase()} trade:`, signal.action, signal.quantity, '@', signal.entryPrice);
    
    try {
      let orderResult = null;
      
      // Live trading
      if (mode === 'live' && this.binanceAPI) {
        const symbol = portfolioData.symbol.replace('/', '').toUpperCase();
        orderResult = await this.binanceAPI.placeOrder(
          symbol,
          signal.action,
          signal.quantity
        );
      }
      
      // Save to database
      const trade = await query(
        `INSERT INTO trades 
         (symbol, trade_type, price, quantity, total_value, confidence, strategy, mode, exit_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [
          portfolioData.symbol,
          signal.action,
          signal.entryPrice,
          signal.quantity,
          signal.entryPrice * signal.quantity,
          signal.confidence,
          signal.strategy,
          mode,
          signal.reasoning
        ]
      );
      
      // Create or update position
      if (signal.action === 'BUY') {
        await query(
          `INSERT INTO positions 
           (symbol, entry_price, current_price, quantity, stop_loss, take_profit, trailing_stop)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (symbol) DO UPDATE SET
           quantity = positions.quantity + $4,
           entry_price = ($1 * positions.quantity + $2 * $4) / (positions.quantity + $4),
           stop_loss = $5,
           take_profit = $6,
           updated_at = NOW()`,
          [
            portfolioData.symbol,
            signal.entryPrice,
            signal.entryPrice,
            signal.quantity,
            signal.stopLoss,
            signal.takeProfit,
            signal.entryPrice * 0.98
          ]
        );
      }
      
      // Send notification
      if (this.notifications) {
        await this.notifications.sendTradeAlert({
          ...trade.rows[0],
          mode
        });
      }
      
      this.executionHistory.push({
        timestamp: new Date().toISOString(),
        signal,
        trade: trade.rows[0],
        orderResult
      });
      
      return {
        executed: true,
        trade: trade.rows[0],
        orderResult,
        signal
      };
    } catch (error) {
      console.error('❌ Trade execution error:', error);
      return {
        executed: false,
        error: error.message
      };
    }
  }

  // ============= BACKTEST STRATEGY =============
  
  async backtestStrategy(strategyName, historicalData, initialBalance = 10000) {
    console.log(`📊 Backtesting strategy: ${strategyName}`);
    
    const results = {
      strategy: strategyName,
      initialBalance,
      finalBalance: initialBalance,
      trades: [],
      wins: 0,
      losses: 0,
      totalProfit: 0,
      totalLoss: 0,
      maxDrawdown: 0,
      sharpeRatio: 0
    };
    
    let balance = initialBalance;
    let peakBalance = initialBalance;
    const returns = [];
    
    // Simulate trading on historical data
    for (let i = 50; i < historicalData.prices.length; i++) {
      const windowData = {
        prices: historicalData.prices.slice(0, i),
        volumes: historicalData.volumes.slice(0, i),
        highs: historicalData.highs.slice(0, i),
        lows: historicalData.lows.slice(0, i)
      };
      
      const marketData = {
        normalized: windowData,
        realtime: { currentPrice: windowData.prices[windowData.prices.length - 1] }
      };
      
      const portfolioData = {
        balance,
        positions: []
      };
      
      try {
        const signal = await this.executeStrategy(strategyName, marketData, portfolioData);
        
        if (signal.action !== 'HOLD') {
          const entryPrice = signal.entryPrice;
          const exitPrice = historicalData.prices[Math.min(i + 10, historicalData.prices.length - 1)];
          
          const profit = signal.action === 'BUY'
            ? (exitPrice - entryPrice) * signal.quantity
            : (entryPrice - exitPrice) * signal.quantity;
          
          balance += profit;
          returns.push(profit / initialBalance);
          
          results.trades.push({
            entry: entryPrice,
            exit: exitPrice,
            profit,
            action: signal.action
          });
          
          if (profit > 0) {
            results.wins++;
            results.totalProfit += profit;
          } else {
            results.losses++;
            results.totalLoss += Math.abs(profit);
          }
          
          // Update drawdown
          if (balance > peakBalance) peakBalance = balance;
          const drawdown = (peakBalance - balance) / peakBalance;
          results.maxDrawdown = Math.max(results.maxDrawdown, drawdown);
        }
      } catch (error) {
        console.error('Backtest error:', error);
      }
    }
    
    results.finalBalance = balance;
    results.totalReturn = ((balance - initialBalance) / initialBalance * 100).toFixed(2);
    results.winRate = results.wins + results.losses > 0 
      ? (results.wins / (results.wins + results.losses) * 100).toFixed(2)
      : 0;
    results.profitFactor = results.totalLoss > 0
      ? (results.totalProfit / results.totalLoss).toFixed(2)
      : results.totalProfit > 0 ? 'Infinity' : 0;
    results.sharpeRatio = this.riskManagement.calculateSharpeRatio(returns).toFixed(2);
    results.maxDrawdown = (results.maxDrawdown * 100).toFixed(2);
    
    this.backtestResults.set(strategyName, results);
    
    console.log(`✅ Backtest complete:`, results);
    
    return results;
  }

  // ============= GENERATE REASONING =============
  
  generateReasoning(action, indicators) {
    if (action === 'HOLD') {
      return 'No clear signal - market conditions neutral';
    }
    
    const reasons = [];
    
    if (indicators.rsi) {
      if (indicators.rsi < 30) reasons.push('RSI oversold');
      else if (indicators.rsi > 70) reasons.push('RSI overbought');
    }
    
    if (indicators.macd) {
      if (indicators.macd.histogram > 0) reasons.push('MACD bullish');
      else if (indicators.macd.histogram < 0) reasons.push('MACD bearish');
    }
    
    if (indicators.sma20 && indicators.sma50) {
      if (indicators.sma20 > indicators.sma50) reasons.push('Golden cross');
      else if (indicators.sma20 < indicators.sma50) reasons.push('Death cross');
    }
    
    return reasons.join(', ') || 'Technical indicators aligned';
  }
}

module.exports = StrategyExecutionService;
