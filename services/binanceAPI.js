const crypto = require('crypto');
const https = require('https');

class BinanceAPI {
  constructor(apiKey, apiSecret, testnet = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseURL = testnet 
      ? 'https://testnet.binance.vision' 
      : 'https://api.binance.com';
    
    console.log(`🔗 Binance API initialized (${testnet ? 'TESTNET' : 'LIVE'})`);
  }

  // Helper function to make HTTPS requests
  makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              console.error(`❌ HTTP ${res.statusCode}: ${data}`);
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request error:', error);
        reject(error);
      });

      req.end();
    });
  }

  // Generate HMAC SHA256 signature
  signRequest(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  // Get current price for a symbol (PUBLIC - no auth required)
  async getPrice(symbol) {
    try {
      console.log(`📊 Fetching price for ${symbol}...`);
      
      const url = `${this.baseURL}/api/v3/ticker/price?symbol=${symbol}`;
      const data = await this.makeRequest(url);
      
      console.log(`✅ Got price for ${symbol}: $${data.price}`);
      return data;
    } catch (error) {
      console.error('❌ Error getting price from Binance:', error.message);
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
      
      const url = `${this.baseURL}/api/v3/account?${queryString}&signature=${signature}`;
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

  // Get all open orders (REQUIRES AUTH)
  async getOpenOrders(symbol) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API credentials not configured');
      }

      const timestamp = Date.now();
      let queryString = `timestamp=${timestamp}`;
      
      if (symbol) {
        queryString = `symbol=${symbol}&${queryString}`;
      }
      
      const signature = this.signRequest(queryString);
      const url = `${this.baseURL}/api/v3/openOrders?${queryString}&signature=${signature}`;
      const options = {
        headers: { 
          'X-MBX-APIKEY': this.apiKey
        }
      };
      
      return await this.makeRequest(url, options);
    } catch (error) {
      console.error('Error getting open orders:', error);
      throw error;
    }
  }

  // Get account snapshot (positions + balances) (REQUIRES AUTH)
  async getAccountSnapshot() {
    try {
      const account = await this.getAccount();
      
      // Get non-zero balances
      const balances = account.balances
        .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map(b => ({
          asset: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
          total: parseFloat(b.free) + parseFloat(b.locked)
        }));
      
      return {
        balances,
        canTrade: account.canTrade,
        canWithdraw: account.canWithdraw,
        canDeposit: account.canDeposit,
        updateTime: new Date(account.updateTime).toISOString()
      };
    } catch (error) {
      console.error('Error getting account snapshot:', error);
      throw error;
    }
  }

  // Place market order (REQUIRES AUTH)
  async placeOrder(symbol, side, quantity) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API credentials not configured');
      }

      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      return new Promise((resolve, reject) => {
        const url = new URL(`${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`);
        
        const options = {
          method: 'POST',
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: { 
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('✅ Order placed successfully:', result);
                resolve(result);
              } else {
                reject(new Error(result.msg || 'Failed to place order'));
              }
            } catch (error) {
              reject(error);
            }
          });
        });

        req.on('error', reject);
        req.end();
      });
    } catch (error) {
      console.error('❌ Error placing order:', error);
      throw error;
    }
  }

  // Place limit order (REQUIRES AUTH)
  async placeLimitOrder(symbol, side, quantity, price) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API credentials not configured');
      }

      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      return new Promise((resolve, reject) => {
        const url = new URL(`${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`);
        
        const options = {
          method: 'POST',
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: { 
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(result);
              } else {
                reject(new Error(result.msg || 'Failed to place limit order'));
              }
            } catch (error) {
              reject(error);
            }
          });
        });

        req.on('error', reject);
        req.end();
      });
    } catch (error) {
      console.error('Error placing limit order:', error);
      throw error;
    }
  }

  // Get order status (REQUIRES AUTH)
  async getOrder(symbol, orderId) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API credentials not configured');
      }

      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      const url = `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`;
      const options = {
        headers: { 
          'X-MBX-APIKEY': this.apiKey
        }
      };
      
      return await this.makeRequest(url, options);
    } catch (error) {
      console.error('Error getting order:', error);
      throw error;
    }
  }

  // Cancel order (REQUIRES AUTH)
  async cancelOrder(symbol, orderId) {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API credentials not configured');
      }

      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      return new Promise((resolve, reject) => {
        const url = new URL(`${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`);
        
        const options = {
          method: 'DELETE',
          hostname: url.hostname,
          path: url.pathname + url.search,
          headers: { 
            'X-MBX-APIKEY': this.apiKey
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(result);
              } else {
                reject(new Error(result.msg || 'Failed to cancel order'));
              }
            } catch (error) {
              reject(error);
            }
          });
        });

        req.on('error', reject);
        req.end();
      });
    } catch (error) {
      console.error('Error canceling order:', error);
      throw error;
    }
  }

  // Get 24hr ticker price change statistics (PUBLIC - no auth required)
  async get24hrStats(symbol) {
    try {
      const url = `${this.baseURL}/api/v3/ticker/24hr?symbol=${symbol}`;
      return await this.makeRequest(url);
    } catch (error) {
      console.error('Error getting 24hr stats:', error);
      throw error;
    }
  }
}

module.exports = BinanceAPI;
