const crypto = require('crypto');

class BinanceAPI {
  constructor(apiKey, apiSecret, testnet = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseURL = testnet 
      ? 'https://testnet.binance.vision' 
      : 'https://api.binance.com';
    
    console.log(`🔗 Binance API initialized (${testnet ? 'TESTNET' : 'LIVE'})`);
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
      
      const response = await fetch(
        `${this.baseURL}/api/v3/ticker/price?symbol=${symbol}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Binance API error (${response.status}):`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
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
      
      const response = await fetch(
        `${this.baseURL}/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: { 
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.msg || 'Failed to get account info');
      }
      
      return await response.json();
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
      
      const response = await fetch(
        `${this.baseURL}/api/v3/openOrders?${queryString}&signature=${signature}`,
        {
          headers: { 
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.msg || 'Failed to get open orders');
      }
      
      return await response.json();
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
      
      const response = await fetch(
        `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`,
        {
          method: 'POST',
          headers: { 
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.msg || 'Failed to place order');
      }
      
      const result = await response.json();
      console.log('✅ Order placed successfully:', result);
      return result;
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
      
      const response = await fetch(
        `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`,
        {
          method: 'POST',
          headers: { 
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.msg || 'Failed to place limit order');
      }
      
      return await response.json();
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
      
      const response = await fetch(
        `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`,
        {
          headers: { 
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.msg || 'Failed to get order');
      }
      
      return await response.json();
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
      
      const response = await fetch(
        `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`,
        {
          method: 'DELETE',
          headers: { 
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.msg || 'Failed to cancel order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error canceling order:', error);
      throw error;
    }
  }

  // Get 24hr ticker price change statistics (PUBLIC - no auth required)
  async get24hrStats(symbol) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/v3/ticker/24hr?symbol=${symbol}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting 24hr stats:', error);
      throw error;
    }
  }
}

module.exports = BinanceAPI;
