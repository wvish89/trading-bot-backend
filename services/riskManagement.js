// Risk Management Service - Position Sizing, Stop Loss, Risk Assessment
class RiskManagementService {
  constructor(config = {}) {
    this.config = {
      maxPositionSize: config.maxPositionSize || 0.1, // Max 10% of portfolio per trade
      maxDrawdown: config.maxDrawdown || 0.2, // Max 20% drawdown
      maxDailyLoss: config.maxDailyLoss || 0.05, // Max 5% daily loss
      riskPerTrade: config.riskPerTrade || 0.02, // Risk 2% per trade
      maxOpenPositions: config.maxOpenPositions || 5,
      maxLeverage: config.maxLeverage || 1, // No leverage by default
      stopLossPercent: config.stopLossPercent || 0.03, // 3% stop loss
      takeProfitPercent: config.takeProfitPercent || 0.06, // 6% take profit
      trailingStopPercent: config.trailingStopPercent || 0.02, // 2% trailing stop
      ...config
    };
    
    this.dailyLosses = [];
    this.currentDrawdown = 0;
    this.peakPortfolioValue = 0;
  }

  // ============= POSITION SIZING =============
  
  calculatePositionSize(accountBalance, entryPrice, stopLossPrice, riskAmount = null) {
    // Kelly Criterion-inspired position sizing
    const riskPerTrade = riskAmount || (accountBalance * this.config.riskPerTrade);
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
    
    if (riskPerUnit === 0) {
      console.warn('⚠️ Invalid stop loss - risk per unit is zero');
      return 0;
    }
    
    let positionSize = riskPerTrade / riskPerUnit;
    
    // Apply maximum position size constraint
    const maxPosition = accountBalance * this.config.maxPositionSize / entryPrice;
    positionSize = Math.min(positionSize, maxPosition);
    
    // Apply leverage if configured
    if (this.config.maxLeverage > 1) {
      positionSize = Math.min(positionSize, maxPosition * this.config.maxLeverage);
    }
    
    return parseFloat(positionSize.toFixed(8));
  }

  // ============= STOP LOSS & TAKE PROFIT =============
  
  calculateStopLoss(entryPrice, positionType = 'LONG', atr = null) {
    let stopLoss;
    
    if (positionType === 'LONG' || positionType === 'BUY') {
      // Use ATR if available for dynamic stop loss
      if (atr) {
        stopLoss = entryPrice - (atr * 2);
      } else {
        stopLoss = entryPrice * (1 - this.config.stopLossPercent);
      }
    } else {
      if (atr) {
        stopLoss = entryPrice + (atr * 2);
      } else {
        stopLoss = entryPrice * (1 + this.config.stopLossPercent);
      }
    }
    
    return parseFloat(stopLoss.toFixed(8));
  }

  calculateTakeProfit(entryPrice, positionType = 'LONG', riskRewardRatio = 2) {
    const stopLoss = this.calculateStopLoss(entryPrice, positionType);
    const risk = Math.abs(entryPrice - stopLoss);
    
    let takeProfit;
    if (positionType === 'LONG' || positionType === 'BUY') {
      takeProfit = entryPrice + (risk * riskRewardRatio);
    } else {
      takeProfit = entryPrice - (risk * riskRewardRatio);
    }
    
    return parseFloat(takeProfit.toFixed(8));
  }

  updateTrailingStop(currentPrice, entryPrice, currentStopLoss, positionType = 'LONG') {
    if (positionType === 'LONG' || positionType === 'BUY') {
      const trailingStop = currentPrice * (1 - this.config.trailingStopPercent);
      
      // Only move stop loss up, never down
      if (trailingStop > currentStopLoss) {
        return {
          newStopLoss: parseFloat(trailingStop.toFixed(8)),
          updated: true,
          profit: ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)
        };
      }
    } else {
      const trailingStop = currentPrice * (1 + this.config.trailingStopPercent);
      
      // Only move stop loss down, never up (for short positions)
      if (trailingStop < currentStopLoss) {
        return {
          newStopLoss: parseFloat(trailingStop.toFixed(8)),
          updated: true,
          profit: ((entryPrice - currentPrice) / entryPrice * 100).toFixed(2)
        };
      }
    }
    
    return {
      newStopLoss: currentStopLoss,
      updated: false
    };
  }

  // ============= RISK ASSESSMENT =============
  
  assessTradeRisk(tradeParams) {
    const { 
      entryPrice, 
      quantity, 
      stopLoss, 
      takeProfit, 
      accountBalance, 
      currentPositions = [],
      positionType = 'LONG',
      symbol
    } = tradeParams;
    
    const risks = [];
    const warnings = [];
    let riskScore = 0;
    
    // 1. Position Size Risk
    const positionValue = entryPrice * quantity;
    const positionSizePercent = (positionValue / accountBalance) * 100;
    
    if (positionSizePercent > this.config.maxPositionSize * 100) {
      risks.push({
        type: 'position_size',
        severity: 'high',
        message: `Position size (${positionSizePercent.toFixed(2)}%) exceeds maximum (${this.config.maxPositionSize * 100}%)`,
        recommendation: 'Reduce position size'
      });
      riskScore += 30;
    } else if (positionSizePercent > this.config.maxPositionSize * 80) {
      warnings.push('Position size is approaching maximum limit');
      riskScore += 15;
    }
    
    // 2. Stop Loss Risk
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;
    const potentialLoss = quantity * Math.abs(entryPrice - stopLoss);
    const potentialLossPercent = (potentialLoss / accountBalance) * 100;
    
    if (potentialLossPercent > this.config.riskPerTrade * 100) {
      risks.push({
        type: 'stop_loss_risk',
        severity: 'high',
        message: `Potential loss (${potentialLossPercent.toFixed(2)}%) exceeds risk per trade (${this.config.riskPerTrade * 100}%)`,
        recommendation: 'Tighten stop loss or reduce position size'
      });
      riskScore += 25;
    }
    
    // 3. Risk/Reward Ratio
    const potentialProfit = Math.abs(takeProfit - entryPrice) * quantity;
    const riskRewardRatio = potentialProfit / potentialLoss;
    
    if (riskRewardRatio < 1.5) {
      warnings.push(`Low risk/reward ratio: ${riskRewardRatio.toFixed(2)}:1`);
      riskScore += 10;
    }
    
    // 4. Maximum Open Positions
    if (currentPositions.length >= this.config.maxOpenPositions) {
      risks.push({
        type: 'max_positions',
        severity: 'medium',
        message: `Maximum open positions (${this.config.maxOpenPositions}) reached`,
        recommendation: 'Close existing positions before opening new ones'
      });
      riskScore += 20;
    }
    
    // 5. Correlation Risk (simplified)
    const correlatedPositions = this.findCorrelatedPositions(currentPositions, symbol);
    if (correlatedPositions.length > 2) {
      warnings.push(`${correlatedPositions.length} correlated positions detected`);
      riskScore += 15;
    }
    
    // Calculate overall risk level
    let riskLevel = 'low';
    if (riskScore > 50) riskLevel = 'high';
    else if (riskScore > 25) riskLevel = 'medium';
    
    return {
      approved: risks.length === 0,
      riskLevel,
      riskScore,
      risks,
      warnings,
      metrics: {
        positionSizePercent: positionSizePercent.toFixed(2),
        potentialLossPercent: potentialLossPercent.toFixed(2),
        riskRewardRatio: riskRewardRatio.toFixed(2),
        stopLossDistance: (stopLossDistance * 100).toFixed(2)
      }
    };
  }

  findCorrelatedPositions(positions, symbol) {
    // Simple correlation check based on symbol similarity
    const baseAsset = symbol.split('/')[0] || symbol.replace('USDT', '').replace('USD', '');
    
    return positions.filter(pos => {
      const posBaseAsset = pos.symbol.split('/')[0] || pos.symbol.replace('USDT', '').replace('USD', '');
      return posBaseAsset === baseAsset;
    });
  }

  // ============= DRAWDOWN MONITORING =============
  
  updateDrawdown(currentPortfolioValue) {
    if (currentPortfolioValue > this.peakPortfolioValue) {
      this.peakPortfolioValue = currentPortfolioValue;
      this.currentDrawdown = 0;
    } else {
      this.currentDrawdown = (this.peakPortfolioValue - currentPortfolioValue) / this.peakPortfolioValue;
    }
    
    if (this.currentDrawdown > this.config.maxDrawdown) {
      return {
        alert: true,
        severity: 'critical',
        drawdown: (this.currentDrawdown * 100).toFixed(2),
        maxDrawdown: (this.config.maxDrawdown * 100).toFixed(2),
        recommendation: 'STOP TRADING - Maximum drawdown exceeded',
        action: 'close_all_positions'
      };
    } else if (this.currentDrawdown > this.config.maxDrawdown * 0.8) {
      return {
        alert: true,
        severity: 'warning',
        drawdown: (this.currentDrawdown * 100).toFixed(2),
        recommendation: 'Approaching maximum drawdown - consider reducing exposure'
      };
    }
    
    return {
      alert: false,
      drawdown: (this.currentDrawdown * 100).toFixed(2)
    };
  }

  // ============= DAILY LOSS LIMIT =============
  
  checkDailyLossLimit(dailyPnL, accountBalance) {
    const dailyLossPercent = Math.abs(dailyPnL) / accountBalance;
    
    if (dailyLossPercent > this.config.maxDailyLoss) {
      return {
        exceeded: true,
        severity: 'critical',
        lossPercent: (dailyLossPercent * 100).toFixed(2),
        maxLossPercent: (this.config.maxDailyLoss * 100).toFixed(2),
        recommendation: 'STOP TRADING - Daily loss limit exceeded',
        action: 'halt_trading_today'
      };
    } else if (dailyLossPercent > this.config.maxDailyLoss * 0.8) {
      return {
        exceeded: false,
        warning: true,
        lossPercent: (dailyLossPercent * 100).toFixed(2),
        recommendation: 'Approaching daily loss limit - trade cautiously'
      };
    }
    
    return {
      exceeded: false,
      lossPercent: (dailyLossPercent * 100).toFixed(2)
    };
  }

  // ============= PORTFOLIO EXPOSURE =============
  
  calculatePortfolioExposure(positions, accountBalance) {
    let totalExposure = 0;
    let longExposure = 0;
    let shortExposure = 0;
    
    const exposureByAsset = {};
    
    positions.forEach(pos => {
      const exposure = pos.entry_price * pos.quantity;
      totalExposure += exposure;
      
      if (pos.position_type === 'LONG' || pos.trade_type === 'BUY') {
        longExposure += exposure;
      } else {
        shortExposure += exposure;
      }
      
      const baseAsset = pos.symbol.split('/')[0] || pos.symbol.replace('USDT', '');
      exposureByAsset[baseAsset] = (exposureByAsset[baseAsset] || 0) + exposure;
    });
    
    const exposurePercent = (totalExposure / accountBalance) * 100;
    
    return {
      total: totalExposure.toFixed(2),
      totalPercent: exposurePercent.toFixed(2),
      long: longExposure.toFixed(2),
      short: shortExposure.toFixed(2),
      netExposure: (longExposure - shortExposure).toFixed(2),
      exposureByAsset,
      warnings: exposurePercent > 80 ? ['High portfolio exposure (>80%)'] : []
    };
  }

  // ============= EMERGENCY ACTIONS =============
  
  shouldCloseAllPositions(accountBalance, currentPositions, dailyPnL) {
    const reasons = [];
    
    // Check drawdown
    const drawdownCheck = this.updateDrawdown(accountBalance);
    if (drawdownCheck.alert && drawdownCheck.severity === 'critical') {
      reasons.push('Maximum drawdown exceeded');
    }
    
    // Check daily loss
    const dailyLossCheck = this.checkDailyLossLimit(dailyPnL, accountBalance);
    if (dailyLossCheck.exceeded) {
      reasons.push('Daily loss limit exceeded');
    }
    
    // Check for multiple losing positions
    const losingPositions = currentPositions.filter(pos => {
      const currentPnL = (pos.current_price - pos.entry_price) * pos.quantity;
      return currentPnL < 0;
    });
    
    if (losingPositions.length === currentPositions.length && currentPositions.length >= 3) {
      reasons.push('All positions are losing');
    }
    
    return {
      shouldClose: reasons.length > 0,
      reasons,
      severity: reasons.length > 1 ? 'critical' : 'high'
    };
  }

  // ============= PORTFOLIO REBALANCING =============
  
  suggestRebalancing(positions, accountBalance, targetAllocation = {}) {
    const currentAllocation = {};
    let totalValue = 0;
    
    positions.forEach(pos => {
      const value = pos.current_price * pos.quantity;
      const baseAsset = pos.symbol.split('/')[0] || pos.symbol.replace('USDT', '');
      currentAllocation[baseAsset] = (currentAllocation[baseAsset] || 0) + value;
      totalValue += value;
    });
    
    // Convert to percentages
    Object.keys(currentAllocation).forEach(asset => {
      currentAllocation[asset] = (currentAllocation[asset] / totalValue) * 100;
    });
    
    const rebalancingActions = [];
    
    // If no target allocation specified, suggest equal weight
    if (Object.keys(targetAllocation).length === 0) {
      const numAssets = Object.keys(currentAllocation).length;
      Object.keys(currentAllocation).forEach(asset => {
        targetAllocation[asset] = 100 / numAssets;
      });
    }
    
    // Compare current vs target
    Object.keys(targetAllocation).forEach(asset => {
      const target = targetAllocation[asset];
      const current = currentAllocation[asset] || 0;
      const diff = target - current;
      
      if (Math.abs(diff) > 5) { // More than 5% deviation
        rebalancingActions.push({
          asset,
          action: diff > 0 ? 'BUY' : 'SELL',
          currentPercent: current.toFixed(2),
          targetPercent: target.toFixed(2),
          deviationPercent: Math.abs(diff).toFixed(2),
          adjustmentNeeded: ((Math.abs(diff) / 100) * totalValue).toFixed(2)
        });
      }
    });
    
    return {
      needed: rebalancingActions.length > 0,
      currentAllocation,
      targetAllocation,
      actions: rebalancingActions.sort((a, b) => b.deviationPercent - a.deviationPercent),
      timestamp: new Date().toISOString()
    };
  }

  // ============= COMPREHENSIVE RISK REPORT =============
  
  generateRiskReport(portfolioData) {
    const { 
      accountBalance, 
      positions, 
      dailyPnL, 
      weeklyPnL,
      peakBalance
    } = portfolioData;
    
    const exposure = this.calculatePortfolioExposure(positions, accountBalance);
    const drawdown = this.updateDrawdown(accountBalance);
    const dailyLoss = this.checkDailyLossLimit(dailyPnL, accountBalance);
    const emergencyCheck = this.shouldCloseAllPositions(accountBalance, positions, dailyPnL);
    const rebalancing = this.suggestRebalancing(positions, accountBalance);
    
    // Calculate risk metrics
    const sharpeRatio = this.calculateSharpeRatio(weeklyPnL || []);
    const volatility = this.calculateVolatility(weeklyPnL || []);
    
    return {
      timestamp: new Date().toISOString(),
      accountHealth: {
        balance: accountBalance,
        peakBalance: peakBalance || accountBalance,
        drawdown: drawdown.drawdown,
        dailyPnL: dailyPnL.toFixed(2),
        weeklyPnL: weeklyPnL.toFixed(2)
      },
      exposure,
      limits: {
        dailyLoss: dailyLoss,
        drawdown: drawdown,
        maxPositions: {
          current: positions.length,
          maximum: this.config.maxOpenPositions,
          remaining: this.config.maxOpenPositions - positions.length
        }
      },
      emergencyActions: emergencyCheck,
      rebalancing,
      riskMetrics: {
        sharpeRatio: sharpeRatio.toFixed(2),
        volatility: (volatility * 100).toFixed(2) + '%'
      },
      overallRiskLevel: this.calculateOverallRisk(drawdown, dailyLoss, exposure, emergencyCheck)
    };
  }

  calculateSharpeRatio(returns, riskFreeRate = 0.02) {
    if (returns.length < 2) return 0;
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    return (avgReturn - riskFreeRate) / stdDev;
  }

  calculateVolatility(returns) {
    if (returns.length < 2) return 0;
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  calculateOverallRisk(drawdown, dailyLoss, exposure, emergency) {
    let riskScore = 0;
    
    if (drawdown.alert) riskScore += drawdown.severity === 'critical' ? 40 : 20;
    if (dailyLoss.exceeded) riskScore += 30;
    if (dailyLoss.warning) riskScore += 15;
    if (parseFloat(exposure.totalPercent) > 80) riskScore += 20;
    if (emergency.shouldClose) riskScore += 30;
    
    if (riskScore > 60) return 'CRITICAL';
    if (riskScore > 30) return 'HIGH';
    if (riskScore > 15) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = RiskManagementService;
