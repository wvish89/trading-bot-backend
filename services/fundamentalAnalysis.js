// Fundamental Analysis Service
const https = require('https');

class FundamentalAnalysisService {
  constructor() {
    this.dataCache = new Map();
    this.cacheDuration = 3600000; // 1 hour
  }

  // ============= ON-CHAIN METRICS =============
  
  async getOnChainMetrics(symbol) {
    try {
      // In production, integrate with Glassnode, CryptoQuant, or similar
      // For now, simulating realistic on-chain data
      
      const metrics = {
        symbol,
        timestamp: new Date().toISOString(),
        
        // Network metrics
        activeAddresses: this.simulateMetric(100000, 500000),
        transactionCount: this.simulateMetric(200000, 1000000),
        networkValue: this.simulateMetric(1000000000, 2000000000),
        
        // Holder metrics
        whaleTransactions: this.simulateMetric(10, 100),
        exchangeInflow: this.simulateMetric(1000, 10000),
        exchangeOutflow: this.simulateMetric(1000, 10000),
        
        // Mining/Staking metrics
        hashRate: this.simulateMetric(300000000, 500000000),
        stakingRatio: this.simulateMetric(0.4, 0.7),
        
        // Economic metrics
        nvtRatio: this.simulateMetric(50, 150), // Network Value to Transactions
        mvrRatio: this.simulateMetric(1, 3), // Market Value to Realized Value
        puellMultiple: this.simulateMetric(0.5, 2), // Miner profitability
        
        // Supply metrics
        supplyInProfit: this.simulateMetric(0.6, 0.95),
        supplyOnExchanges: this.simulateMetric(0.1, 0.2),
        dormantSupply: this.simulateMetric(0.4, 0.7)
      };
      
      // Analyze metrics
      const analysis = this.analyzeOnChainMetrics(metrics);
      
      return {
        ...metrics,
        analysis,
        tradingSignal: this.onChainToSignal(analysis)
      };
      
    } catch (error) {
      console.error('Error getting on-chain metrics:', error);
      throw error;
    }
  }

  analyzeOnChainMetrics(metrics) {
    const signals = {
      bullish: 0,
      bearish: 0,
      neutral: 0
    };
    
    // Network growth = Bullish
    if (metrics.activeAddresses > 400000) signals.bullish++;
    else if (metrics.activeAddresses < 200000) signals.bearish++;
    else signals.neutral++;
    
    // Exchange flow = Bearish if inflow > outflow
    if (metrics.exchangeInflow > metrics.exchangeOutflow * 1.2) signals.bearish++;
    else if (metrics.exchangeOutflow > metrics.exchangeInflow * 1.2) signals.bullish++;
    else signals.neutral++;
    
    // NVT Ratio - Low is bullish
    if (metrics.nvtRatio < 80) signals.bullish++;
    else if (metrics.nvtRatio > 120) signals.bearish++;
    else signals.neutral++;
    
    // MVRV Ratio - Very high = overvalued
    if (metrics.mvrRatio > 2.5) signals.bearish++;
    else if (metrics.mvrRatio < 1.2) signals.bullish++;
    else signals.neutral++;
    
    // Supply in profit - Very high can be bearish (profit taking)
    if (metrics.supplyInProfit > 0.9) signals.bearish++;
    else if (metrics.supplyInProfit < 0.7) signals.bullish++;
    else signals.neutral++;
    
    const total = signals.bullish + signals.bearish + signals.neutral;
    
    return {
      bullishSignals: signals.bullish,
      bearishSignals: signals.bearish,
      neutralSignals: signals.neutral,
      sentiment: signals.bullish > signals.bearish ? 'bullish' : 
                 signals.bearish > signals.bullish ? 'bearish' : 'neutral',
      confidence: Math.abs(signals.bullish - signals.bearish) / total * 100
    };
  }

  onChainToSignal(analysis) {
    if (analysis.sentiment === 'bullish' && analysis.confidence > 60) {
      return { action: 'BUY', confidence: analysis.confidence };
    } else if (analysis.sentiment === 'bearish' && analysis.confidence > 60) {
      return { action: 'SELL', confidence: analysis.confidence };
    }
    return { action: 'HOLD', confidence: 50 };
  }

  // ============= MARKET DOMINANCE & CORRELATION =============
  
  async getMarketDominance() {
    // Bitcoin dominance affects altcoin performance
    return {
      btcDominance: this.simulateMetric(40, 60),
      ethDominance: this.simulateMetric(15, 25),
      stablecoinDominance: this.simulateMetric(5, 10),
      altcoinSeason: this.isAltcoinSeason(),
      interpretation: this.interpretDominance()
    };
  }

  isAltcoinSeason() {
    const btcDominance = this.simulateMetric(40, 60);
    // Altcoin season when BTC dominance is declining
    return {
      isActive: btcDominance < 45,
      strength: btcDominance < 42 ? 'strong' : btcDominance < 45 ? 'moderate' : 'weak',
      recommendation: btcDominance < 45 ? 'Consider altcoins' : 'Focus on BTC'
    };
  }

  interpretDominance() {
    const btcDom = this.simulateMetric(40, 60);
    
    if (btcDom > 55) {
      return {
        market: 'btc_led',
        message: 'Bitcoin leading, altcoins underperforming',
        strategy: 'Focus on BTC, avoid altcoins'
      };
    } else if (btcDom < 45) {
      return {
        market: 'altcoin_season',
        message: 'Altcoins outperforming Bitcoin',
        strategy: 'Diversify into quality altcoins'
      };
    } else {
      return {
        market: 'balanced',
        message: 'Balanced market conditions',
        strategy: 'Diversified portfolio recommended'
      };
    }
  }

  // ============= MACRO ECONOMIC INDICATORS =============
  
  async getMacroIndicators() {
    // External factors that affect crypto
    return {
      timestamp: new Date().toISOString(),
      
      // Traditional markets
      sp500Performance: this.simulateMetric(-2, 5),
      nasdaq100Performance: this.simulateMetric(-3, 6),
      vixIndex: this.simulateMetric(12, 35), // Fear index
      
      // Commodities
      goldPrice: this.simulateMetric(1800, 2100),
      oilPrice: this.simulateMetric(70, 90),
      
      // Forex
      dxyIndex: this.simulateMetric(95, 110), // Dollar strength
      
      // Rates
      fedFundsRate: this.simulateMetric(4.5, 5.5),
      us10yYield: this.simulateMetric(3.5, 4.5),
      
      // Crypto-specific
      totalMarketCap: this.simulateMetric(1.5e12, 2.5e12),
      totalVolume24h: this.simulateMetric(50e9, 150e9),
      btcFearGreedIndex: this.simulateMetric(20, 80),
      
      analysis: this.analyzeMacro()
    };
  }

  analyzeMacro() {
    const vix = this.simulateMetric(12, 35);
    const dxy = this.simulateMetric(95, 110);
    const fearGreed = this.simulateMetric(20, 80);
    
    let risk = 'medium';
    let cryptoOutlook = 'neutral';
    
    // High VIX = High fear = Good for crypto as alternative
    if (vix > 25) risk = 'high';
    else if (vix < 15) risk = 'low';
    
    // Strong dollar = Bad for crypto
    if (dxy > 105) cryptoOutlook = 'bearish';
    else if (dxy < 98) cryptoOutlook = 'bullish';
    
    // Fear & Greed Index
    if (fearGreed < 25) cryptoOutlook = 'oversold';
    else if (fearGreed > 75) cryptoOutlook = 'overbought';
    
    return {
      marketRisk: risk,
      cryptoOutlook,
      recommendation: this.getMacroRecommendation(risk, cryptoOutlook),
      confidence: 70
    };
  }

  getMacroRecommendation(risk, outlook) {
    if (risk === 'high' && outlook === 'oversold') {
      return 'Opportunity: High fear, consider buying dips';
    } else if (risk === 'low' && outlook === 'overbought') {
      return 'Caution: Greed levels high, consider taking profits';
    } else if (outlook === 'bearish') {
      return 'Defensive: Strong dollar pressure, reduce exposure';
    } else if (outlook === 'bullish') {
      return 'Aggressive: Favorable macro, increase exposure';
    }
    return 'Balanced: Mixed signals, maintain current strategy';
  }

  // ============= WHALE WATCHING =============
  
  async getWhaleActivity(symbol) {
    // Large wallet movements can predict price action
    return {
      symbol,
      timestamp: new Date().toISOString(),
      
      last24h: {
        largeTransactions: this.simulateMetric(50, 200),
        whaleAccumulation: this.simulateMetric(-10000, 10000),
        exchangeDeposits: this.simulateMetric(1000, 5000),
        exchangeWithdrawals: this.simulateMetric(1000, 5000)
      },
      
      topWhales: this.simulateTopWhales(),
      
      analysis: {
        trend: this.analyzeWhaleActivity(),
        signal: this.whaleActivitySignal()
      }
    };
  }

  simulateTopWhales() {
    const whales = [];
    for (let i = 0; i < 10; i++) {
      whales.push({
        rank: i + 1,
        balance: this.simulateMetric(10000, 100000),
        change24h: this.simulateMetric(-1000, 1000),
        activity: Math.random() > 0.5 ? 'buying' : 'selling'
      });
    }
    return whales;
  }

  analyzeWhaleActivity() {
    const accumulation = this.simulateMetric(-10000, 10000);
    
    if (accumulation > 5000) {
      return {
        direction: 'accumulation',
        strength: 'strong',
        message: 'Whales are accumulating - Bullish signal'
      };
    } else if (accumulation < -5000) {
      return {
        direction: 'distribution',
        strength: 'strong',
        message: 'Whales are distributing - Bearish signal'
      };
    } else {
      return {
        direction: 'neutral',
        strength: 'weak',
        message: 'No significant whale activity'
      };
    }
  }

  whaleActivitySignal() {
    const accumulation = this.simulateMetric(-10000, 10000);
    
    if (accumulation > 7000) return { action: 'STRONG_BUY', confidence: 85 };
    if (accumulation > 3000) return { action: 'BUY', confidence: 70 };
    if (accumulation < -7000) return { action: 'STRONG_SELL', confidence: 85 };
    if (accumulation < -3000) return { action: 'SELL', confidence: 70 };
    return { action: 'HOLD', confidence: 50 };
  }

  // ============= NEWS SENTIMENT ANALYSIS =============
  
  async getNewsSentiment(symbol) {
    // Real-time news sentiment
    // In production: Integrate NewsAPI, CryptoPanic, etc.
    
    const articles = this.simulateNews();
    const sentiment = this.analyzeNewsSentiment(articles);
    
    return {
      symbol,
      timestamp: new Date().toISOString(),
      articles,
      sentiment,
      tradingImpact: this.assessNewsImpact(sentiment)
    };
  }

  simulateNews() {
    const topics = [
      'Regulation',
      'Adoption',
      'Technology',
      'Partnership',
      'Security',
      'Market Analysis'
    ];
    
    return Array.from({ length: 10 }, (_, i) => ({
      title: `${topics[i % topics.length]} news for crypto`,
      sentiment: Math.random() > 0.5 ? 'positive' : Math.random() > 0.3 ? 'neutral' : 'negative',
      relevance: Math.floor(Math.random() * 100),
      source: ['Bloomberg', 'Reuters', 'CoinDesk', 'TheBlock'][Math.floor(Math.random() * 4)],
      publishedAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
    }));
  }

  analyzeNewsSentiment(articles) {
    const positive = articles.filter(a => a.sentiment === 'positive').length;
    const negative = articles.filter(a => a.sentiment === 'negative').length;
    const neutral = articles.filter(a => a.sentiment === 'neutral').length;
    
    const score = (positive * 1 + negative * -1) / articles.length * 100;
    
    return {
      positive,
      negative,
      neutral,
      score: score.toFixed(2),
      sentiment: score > 20 ? 'bullish' : score < -20 ? 'bearish' : 'neutral',
      confidence: Math.abs(score)
    };
  }

  assessNewsImpact(sentiment) {
    const score = parseFloat(sentiment.score);
    
    if (score > 50) {
      return {
        impact: 'very_positive',
        recommendation: 'Strong positive news flow - Consider increasing position',
        timeframe: 'short_term'
      };
    } else if (score > 20) {
      return {
        impact: 'positive',
        recommendation: 'Positive sentiment - Good time to accumulate',
        timeframe: 'medium_term'
      };
    } else if (score < -50) {
      return {
        impact: 'very_negative',
        recommendation: 'Strong negative news - Consider reducing exposure',
        timeframe: 'short_term'
      };
    } else if (score < -20) {
      return {
        impact: 'negative',
        recommendation: 'Negative sentiment - Wait for stabilization',
        timeframe: 'medium_term'
      };
    } else {
      return {
        impact: 'neutral',
        recommendation: 'Mixed signals - Maintain current strategy',
        timeframe: 'no_change'
      };
    }
  }

  // ============= COMPREHENSIVE FUNDAMENTAL SCORE =============
  
  async getFundamentalScore(symbol) {
    try {
      // Gather all fundamental data
      const [onChain, dominance, macro, whales, news] = await Promise.all([
        this.getOnChainMetrics(symbol),
        this.getMarketDominance(),
        this.getMacroIndicators(),
        this.getWhaleActivity(symbol),
        this.getNewsSentiment(symbol)
      ]);
      
      // Calculate weighted score
      const scores = {
        onChain: this.scoreToNumber(onChain.analysis.sentiment),
        macro: this.scoreToNumber(macro.analysis.cryptoOutlook),
        whales: this.scoreToNumber(whales.analysis.trend.direction),
        news: parseFloat(news.sentiment.score) / 100
      };
      
      const weights = {
        onChain: 0.35,
        macro: 0.25,
        whales: 0.25,
        news: 0.15
      };
      
      let totalScore = 0;
      for (const [key, score] of Object.entries(scores)) {
        totalScore += score * weights[key];
      }
      
      // Convert to 0-100 scale
      const fundamentalScore = ((totalScore + 1) / 2) * 100;
      
      return {
        symbol,
        timestamp: new Date().toISOString(),
        fundamentalScore: fundamentalScore.toFixed(2),
        rating: this.getRating(fundamentalScore),
        components: {
          onChain: {
            score: ((scores.onChain + 1) / 2 * 100).toFixed(2),
            weight: weights.onChain * 100 + '%',
            ...onChain.analysis
          },
          macro: {
            score: ((scores.macro + 1) / 2 * 100).toFixed(2),
            weight: weights.macro * 100 + '%',
            ...macro.analysis
          },
          whales: {
            score: ((scores.whales + 1) / 2 * 100).toFixed(2),
            weight: weights.whales * 100 + '%',
            ...whales.analysis.trend
          },
          news: {
            score: ((scores.news + 1) / 2 * 100).toFixed(2),
            weight: weights.news * 100 + '%',
            ...news.sentiment
          }
        },
        tradingRecommendation: this.getFundamentalRecommendation(fundamentalScore)
      };
      
    } catch (error) {
      console.error('Error calculating fundamental score:', error);
      throw error;
    }
  }

  scoreToNumber(sentiment) {
    if (sentiment === 'bullish' || sentiment === 'positive' || sentiment === 'accumulation') return 1;
    if (sentiment === 'bearish' || sentiment === 'negative' || sentiment === 'distribution') return -1;
    return 0;
  }

  getRating(score) {
    if (score >= 80) return 'STRONG_BUY';
    if (score >= 65) return 'BUY';
    if (score >= 45) return 'HOLD';
    if (score >= 30) return 'SELL';
    return 'STRONG_SELL';
  }

  getFundamentalRecommendation(score) {
    const recommendations = {
      'STRONG_BUY': 'Excellent fundamentals across all metrics. Strong buy opportunity.',
      'BUY': 'Positive fundamentals. Good entry point for long-term positions.',
      'HOLD': 'Mixed signals. Maintain current positions, wait for clarity.',
      'SELL': 'Deteriorating fundamentals. Consider reducing exposure.',
      'STRONG_SELL': 'Very weak fundamentals. Exit or short position recommended.'
    };
    
    const rating = this.getRating(score);
    
    return {
      rating,
      message: recommendations[rating],
      timeframe: score > 65 || score < 35 ? 'act_soon' : 'monitor',
      confidence: Math.abs(score - 50) * 2 // 0-100 based on distance from neutral
    };
  }

  // ============= HELPER FUNCTIONS =============
  
  simulateMetric(min, max) {
    return Math.random() * (max - min) + min;
  }

  getCached(key) {
    const cached = this.dataCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheDuration) {
      this.dataCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data) {
    this.dataCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

module.exports = FundamentalAnalysisService;
