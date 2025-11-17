const crypto = require('crypto');
const https = require('https');

class BinanceAPI {
  constructor(apiKey, apiSecret, testnet = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    
    // Use multiple base URLs for redundancy
    this.baseURLs = [
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api2.binance.com',
      'https://api3.binance.com'
    ];
    this.currentBaseURLIndex = 0;
    
    // Price cache to reduce API calls
    this.priceCache = new Map();
    this.cacheDuration = 3000; // 3 seconds cache
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
    
    console.log(`🔗 Binance API initialized (LIVE MODE)`);
  }

  // Get current base URL with rotation
  getBaseURL() {
    return this.baseURLs[this.currentBaseURLIndex];
  }

  // Rotate to next base URL
  rotateBaseURL() {
    this.currentBaseURLIndex = (this.currentBaseURLIndex + 1) % this.baseURLs.length;
    console.log(`🔄 Rotating to backup URL: ${this.getBaseURL()}`);
  }

  // Rate limiting delay
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Enhanced HTTPS request with proper headers
  makeRequest(url, options = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Parse URL
      const urlObj = new URL(url);
      
      // Merge options with required headers
      const requestOptions = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: timeout
      };

      const timeoutId = setTimeout(() => {
        req.destroy();
        reject(new Error('Request timeout'));
      }, timeout);

      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          clearTimeout(timeoutId);
          
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } else if (res.statusCode === 429) {
              // Rate limit hit
              reject(new Error('RATE_LIMITED'));
            } else if (res.statusCode === 418) {
              // IP banned
              reject(new Error('IP_BANNED'));
            } else {
              console.error(`❌ HTTP ${res.statusCode}: ${data.substring(0, 200)}`);
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          } catch (error) {
            reject(new Error(`Parse error: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error('❌ Request error:', error.message);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  // Check if cached price is still valid
  getCachedPrice(symbol) {
    const cached = this.priceCache.get(symbol);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.cacheDuration) {
      this.priceCache.delete(symbol);
      return null;
    }
    
    console.log(`💾 Cache hit for ${symbol} (age: ${age}ms)`);
    return cached.data;
  }

  // Cache price data
  cachePrice(symbol, data) {
    this.priceCache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }

  // Generate HMAC SHA256 signature
  signRequest(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  // Get current price with full retry logic and fallbacks
  async getPrice(symbol, maxRetries = 4) {
    // Check cache first
    const cached = this.getCachedPrice(symbol);
    if (cached) {
      return cached;
    }

    // Wait for rate limit
    await this.waitForRateLimit();

    let lastError = null;

    // Try all base URLs
    for (let baseURLAttempt = 0; baseURLAttempt < this.baseURLs.length; baseURLAttempt++) {
      const baseURL = this.getBaseURL();
      
      // Try multiple times per URL
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`📊 Attempt ${attempt}/${maxRetries} for ${symbol} on ${baseURL}`);
          
          const url = `${baseURL}/api/v3/ticker/price?symbol=${symbol}`;
          const data = await this.makeRequest(url, {}, 8000);
          
          // Validate response
          if (!data || !data.price) {
            throw new Error('Invalid response format');
          }
          
          console.log(`✅ Real price fetched: ${symbol} = $${data.price}`);
          
          // Cache the result
          this.cachePrice(symbol, { ...data, simulated: false });
          
          return { ...data, simulated: false };
          
        } catch (error) {
          lastError = error;
          console.error(`❌ Attempt ${attempt} failed:`, error.message);
          
          // Handle specific errors
          if (error.message === 'RATE_LIMITED') {
            console.warn('⚠️ Rate limited, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else if (error.message === 'IP_BANNED') {
            console.error('🚫 IP banned, rotating URL...');
            this.rotateBaseURL();
            break; // Move to next base URL immediately
          } else {
            // Exponential backoff for other errors
            if (attempt < maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
              console.log(`⏳ Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      }
      
      // If we exhausted retries on this URL, try next URL
      this.rotateBaseURL();
    }

    // All attempts failed, return simulated price
    console.error(`❌ All ${this.baseURLs.length * maxRetries} attempts failed. Returning simulated price.`);
    return this.getSimulatedPrice(symbol);
  }

  // Generate realistic simulated price
  getSimulatedPrice(symbol) {
    const basePrices = {
      'BTCUSDT': 96000,
      'ETHUSDT': 3600,
      'BNBUSDT': 680,
      'SOLUSDT': 200,
      'XRPUSDT': 2.6,
      'ADAUSDT': 1.15,
      'DOGEUSDT': 0.40,
      'MATICUSDT': 0.55,
      'DOTUSDT': 8.5,
      'AVAXUSDT': 45,
      'LINKUSDT': 23,
      'LTCUSDT': 110,
      'UNIUSDT': 14,
      'ATOMUSDT': 9.5,
      'ETCUSDT': 28
    };

    const basePrice = basePrices[symbol] || 100;
    // Small realistic variation (+/- 0.3%)
    const variation = (Math.random() - 0.5) * 0.006;
    const price = basePrice * (1 + variation);

    console.warn(`⚠️ SIMULATED PRICE for ${symbol}: $${price.toFixed(2)}`);

    const result = {
      symbol: symbol,
      price: price.toFixed(8),
      simulated: true,
      source: 'fallback'
    };

    // Cache simulated price too (but with shorter TTL)
    this.priceCache.set(symbol, {
      data: result,
      timestamp: Date.now() - 2000 // Expire sooner
    });

    return result;
  }

  // Ping Binance to check connectivity
  async ping() {
    try {
      const url = `${this.getBaseURL()}/api/v3/ping`;
      await this.makeRequest(url, {}, 5000);
      console.log('✅ Binance API is reachable');
      return true;
    } catch (error) {
      console.error('❌ Binance API unreachable:', error.message);
      return false;
    }
  }

  // Get server time
  async getServerTime() {
    try {
      const url = `${this.getBaseURL()}/api/v3/time`;
      const data = await this.makeRequest(url, {}, 5000);
      return data;
    } catch (error) {
      console.error('Error getting server time:', error);
      throw error;
    }
  }

  // Get account information (REQUIRES AUTH)
  async getAccount() {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API credentials not configured');
      }

      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      const url = `${this.getBaseURL()}/api/v3/account?${queryString}&signature=${signature}`;
      const options = {
        headers: { 
          'X-MBX-APIKEY': this.apiKey
        }
      };
      
      return await this.makeRequest(url, options);
    } catch (error) {
      console.error('Error getting account:', error);
      throw error;
    }
  }

  // Get account balance for specific asset (REQUIRES AUTH)
  async getBalance(asset = 'USDT') {
    try {
      const account = await this.getAccount();
      const balance = account.balances.find(b => b.asset === asset);
      
      return {
        asset: asset,
        free: parseFloat(balance?.free || 0),
        locked: parseFloat(balance?.locked || 0),
        total: parseFloat(balance?.free || 0) + parseFloat(balance?.locked || 0)
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }

  // Get 24hr ticker price change statistics (PUBLIC)
  async get24hrStats(symbol) {
    try {
      await this.waitForRateLimit();
      
      const url = `${this.getBaseURL()}/api/v3/ticker/24hr?symbol=${symbol}`;
      return await this.makeRequest(url);
    } catch (error) {
      console.error('Error getting 24hr stats:', error);
      // Return minimal stats on failure
      return {
        symbol: symbol,
        lastPrice: '0',
        priceChange: '0',
        priceChangePercent: '0',
        simulated: true
      };
    }
  }

  // Clear price cache
  clearCache() {
    this.priceCache.clear();
    console.log('✅ Price cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.priceCache.size,
      entries: Array.from(this.priceCache.keys())
    };
  }
}

module.exports = BinanceAPI;
