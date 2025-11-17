// Data Collection Service - Real-time and Historical Market Data
const https = require('https');

class DataCollectionService {
  constructor(binanceAPI) {
    this.binanceAPI = binanceAPI;
    this.dataCache = new Map();
    this.websocketConnections = new Map();
    this.updateInterval = 60000; // 1 minute default
  }

  // ============= REAL-TIME DATA COLLECTION =============
  
  async collectRealtimeData(symbols, interval = '1m') {
    const dataCollection = {};
    
    for (const symbol of symbols) {
      try {
        const binanceSymbol = symbol.replace('/', '').toUpperCase();
        
        // Get current price
        const priceData = await this.binanceAPI.getPrice(binanceSymbol);
        
        // Get 24hr statistics
        const stats = await this.binanceAPI.get24hrStats(binanceSymbol);
        
        // Get recent klines (candlestick data)
        const klines = await this.getKlines(binanceSymbol, interval, 100);
        
        dataCollection[symbol] = {
          symbol,
          timestamp: new Date().toISOString(),
          currentPrice: parseFloat(priceData.price),
          stats: {
            high24h: parseFloat(stats.highPrice),
            low24h: parseFloat(stats.lowPrice),
            volume24h: parseFloat(stats.volume),
            priceChange24h: parseFloat(stats.priceChange),
            priceChangePercent24h: parseFloat(stats.priceChangePercent),
            trades24h: parseInt(stats.count)
          },
          klines: klines,
          dataQuality: this.assessDataQuality(klines)
        };
        
        // Cache the data
        this.cacheData(symbol, dataCollection[symbol]);
        
      } catch (error) {
        console.error(`Error collecting data for ${symbol}:`, error.message);
        dataCollection[symbol] = {
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return dataCollection;
  }

  // ============= HISTORICAL DATA =============
  
  async getKlines(symbol, interval = '1h', limit = 500) {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      
      return new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let data = '';
          
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const klines = JSON.parse(data);
              
              // Transform kline data
              const formattedKlines = klines.map(k => ({
                openTime: new Date(k[0]).toISOString(),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
                closeTime: new Date(k[6]).toISOString(),
                trades: parseInt(k[8])
              }));
              
              resolve(formattedKlines);
            } catch (error) {
              reject(error);
            }
          });
        }).on('error', reject);
      });
    } catch (error) {
      console.error('Error fetching klines:', error);
      throw error;
    }
  }

  // ============= DATA NORMALIZATION =============
  
  normalizeData(rawData) {
    const { klines } = rawData;
    
    if (!klines || klines.length === 0) {
      return null;
    }
    
    const prices = klines.map(k => k.close);
    const volumes = klines.map(k => k.volume);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const opens = klines.map(k => k.open);
    const closes = klines.map(k => k.close);
    const timestamps = klines.map(k => k.closeTime);
    
    return {
      prices,
      volumes,
      highs,
      lows,
      opens,
      closes,
      timestamps,
      length: prices.length,
      startTime: timestamps[0],
      endTime: timestamps[timestamps.length - 1]
    };
  }

  // ============= DATA QUALITY ASSESSMENT =============
  
  assessDataQuality(klines) {
    if (!klines || klines.length === 0) {
      return {
        score: 0,
        status: 'insufficient',
        issues: ['No data available']
      };
    }
    
    const issues = [];
    let qualityScore = 100;
    
    // Check for missing data
    if (klines.length < 20) {
      issues.push('Insufficient data points');
      qualityScore -= 30;
    }
    
    // Check for data gaps
    const timestamps = klines.map(k => new Date(k.closeTime).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      const expectedGap = 60000; // 1 minute in milliseconds
      
      if (gap > expectedGap * 2) {
        issues.push('Data gaps detected');
        qualityScore -= 10;
        break;
      }
    }
    
    // Check for anomalous values
    const prices = klines.map(k => k.close);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const anomalies = prices.filter(p => Math.abs(p - avgPrice) / avgPrice > 0.5);
    
    if (anomalies.length > 0) {
      issues.push(`${anomalies.length} potential anomalies detected`);
      qualityScore -= 5;
    }
    
    // Check for zero volumes
    const zeroVolumes = klines.filter(k => k.volume === 0).length;
    if (zeroVolumes > klines.length * 0.1) {
      issues.push('High number of zero-volume candles');
      qualityScore -= 15;
    }
    
    let status = 'excellent';
    if (qualityScore < 70) status = 'poor';
    else if (qualityScore < 85) status = 'fair';
    else if (qualityScore < 95) status = 'good';
    
    return {
      score: Math.max(qualityScore, 0),
      status,
      issues: issues.length > 0 ? issues : ['No issues detected'],
      dataPoints: klines.length
    };
  }

  // ============= MULTI-SOURCE DATA AGGREGATION =============
  
  async aggregateMultiSourceData(symbols) {
    const aggregatedData = {};
    
    for (const symbol of symbols) {
      try {
        // Primary source: Binance
        const binanceData = await this.collectRealtimeData([symbol]);
        
        // In production, you would fetch from multiple exchanges
        // For now, we'll simulate multi-source by adding confidence scores
        
        aggregatedData[symbol] = {
          ...binanceData[symbol],
          sources: ['binance'],
          consensus: {
            price: binanceData[symbol].currentPrice,
            confidence: 95,
            variance: 0.001 // Low variance = high agreement
          }
        };
      } catch (error) {
        console.error(`Error aggregating data for ${symbol}:`, error);
        aggregatedData[symbol] = { error: error.message };
      }
    }
    
    return aggregatedData;
  }

  // ============= NEWS & SENTIMENT DATA =============
  
  async collectSentimentData(keywords) {
    // In production, integrate with news APIs and social media APIs
    // For now, return simulated sentiment data
    
    const sentimentData = {
      timestamp: new Date().toISOString(),
      keywords,
      sources: {
        twitter: this.simulateSentiment(),
        reddit: this.simulateSentiment(),
        news: this.simulateSentiment()
      },
      overall: null
    };
    
    // Calculate overall sentiment
    const scores = Object.values(sentimentData.sources).map(s => s.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    sentimentData.overall = {
      score: avgScore.toFixed(2),
      sentiment: avgScore > 20 ? 'bullish' : avgScore < -20 ? 'bearish' : 'neutral',
      confidence: 70
    };
    
    return sentimentData;
  }

  simulateSentiment() {
    // Simulate sentiment score between -100 (very bearish) and 100 (very bullish)
    const score = (Math.random() - 0.5) * 100;
    
    return {
      score: score.toFixed(2),
      sentiment: score > 20 ? 'bullish' : score < -20 ? 'bearish' : 'neutral',
      volume: Math.floor(Math.random() * 10000),
      trending: Math.random() > 0.7
    };
  }

  // ============= DATA CACHING =============
  
  cacheData(key, data, ttl = 60000) {
    this.dataCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  getCachedData(key) {
    const cached = this.dataCache.get(key);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    
    if (age > cached.ttl) {
      this.dataCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clearCache() {
    this.dataCache.clear();
    console.log('✅ Data cache cleared');
  }

  // ============= MARKET DEPTH DATA =============
  
  async getOrderBookDepth(symbol, limit = 100) {
    try {
      const binanceSymbol = symbol.replace('/', '').toUpperCase();
      const url = `https://api.binance.com/api/v3/depth?symbol=${binanceSymbol}&limit=${limit}`;
      
      return new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const orderBook = JSON.parse(data);
              
              // Calculate bid/ask pressure
              const bidVolume = orderBook.bids.reduce((sum, bid) => sum + parseFloat(bid[1]), 0);
              const askVolume = orderBook.asks.reduce((sum, ask) => sum + parseFloat(ask[1]), 0);
              const pressure = bidVolume / (bidVolume + askVolume);
              
              resolve({
                symbol,
                timestamp: new Date().toISOString(),
                bids: orderBook.bids.slice(0, 10).map(b => ({
                  price: parseFloat(b[0]),
                  quantity: parseFloat(b[1])
                })),
                asks: orderBook.asks.slice(0, 10).map(a => ({
                  price: parseFloat(a[0]),
                  quantity: parseFloat(a[1])
                })),
                spread: parseFloat(orderBook.asks[0][0]) - parseFloat(orderBook.bids[0][0]),
                spreadPercent: ((parseFloat(orderBook.asks[0][0]) - parseFloat(orderBook.bids[0][0])) / parseFloat(orderBook.bids[0][0]) * 100).toFixed(4),
                bidPressure: (pressure * 100).toFixed(2),
                askPressure: ((1 - pressure) * 100).toFixed(2),
                signal: pressure > 0.6 ? 'bullish' : pressure < 0.4 ? 'bearish' : 'neutral'
              });
            } catch (error) {
              reject(error);
            }
          });
        }).on('error', reject);
      });
    } catch (error) {
      console.error('Error fetching order book:', error);
      throw error;
    }
  }

  // ============= COMPREHENSIVE DATA COLLECTION =============
  
  async collectComprehensiveMarketData(symbols) {
    console.log(`📊 Collecting comprehensive market data for ${symbols.length} symbols...`);
    
    const results = {};
    
    for (const symbol of symbols) {
      try {
        console.log(`  → Processing ${symbol}...`);
        
        // Collect all available data
        const [realtimeData, orderBook, sentiment] = await Promise.all([
          this.collectRealtimeData([symbol]),
          this.getOrderBookDepth(symbol).catch(err => {
            console.warn(`Order book failed for ${symbol}:`, err.message);
            return null;
          }),
          this.collectSentimentData([symbol]).catch(err => {
            console.warn(`Sentiment failed for ${symbol}:`, err.message);
            return null;
          })
        ]);
        
        const normalized = this.normalizeData(realtimeData[symbol]);
        
        results[symbol] = {
          timestamp: new Date().toISOString(),
          symbol,
          realtime: realtimeData[symbol],
          normalized,
          orderBook,
          sentiment,
          quality: realtimeData[symbol].dataQuality,
          metadata: {
            sources: ['binance'],
            dataPoints: normalized?.length || 0,
            collectionTime: new Date().toISOString()
          }
        };
        
        console.log(`  ✅ ${symbol} completed`);
      } catch (error) {
        console.error(`  ❌ ${symbol} failed:`, error.message);
        results[symbol] = {
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    console.log(`✅ Comprehensive data collection completed for ${Object.keys(results).length} symbols`);
    
    return results;
  }

  // ============= CONTINUOUS DATA STREAM =============
  
  startContinuousCollection(symbols, callback, interval = 60000) {
    console.log(`🔄 Starting continuous data collection (${interval}ms interval)...`);
    
    const collectAndNotify = async () => {
      try {
        const data = await this.collectComprehensiveMarketData(symbols);
        if (callback) callback(data);
      } catch (error) {
        console.error('Error in continuous collection:', error);
      }
    };
    
    // Initial collection
    collectAndNotify();
    
    // Set up interval
    const intervalId = setInterval(collectAndNotify, interval);
    
    return {
      stop: () => {
        clearInterval(intervalId);
        console.log('⏹️ Continuous data collection stopped');
      }
    };
  }
}

module.exports = DataCollectionService;
