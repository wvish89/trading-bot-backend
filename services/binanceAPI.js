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

  // Get current price for a symbol
  async getPrice(symbol) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/v3/ticker/price?symbol=${symbol}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting price:', error);
      throw error;
    }
  }

  // Get account information
  async getAccount() {
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      const response = await fetch(
        `${this.baseURL}/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': this.apiKey }
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

  // NEW: Get account balance for specific asset
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

  // NEW: Get all open orders
  async getOpenOrders(symbol) {
    try {
      const timestamp = Date.now();
      let queryString = `timestamp=${timestamp}`;
      
      if (symbol) {
        queryString = `symbol=${symbol}&${queryString}`;
      }
      
      const signature = this.signRequest(queryString);
      
      const response = await fetch(
        `${this.baseURL}/api/v3/openOrders?${queryString}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': this.apiKey }
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

  // NEW: Get account snapshot (positions + balances)
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

  // Place market order
  async placeOrder(symbol, side, quantity) {
    try {
      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      const response = await fetch(
        `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`,
        {
          method: 'POST',
          headers: { 'X-MBX-APIKEY': this.apiKey }
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

  // Place limit order
  async placeLimitOrder(symbol, side, quantity, price) {
    try {
      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      const response = await fetch(
        `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`,
        {
          method: 'POST',
          headers: { 'X-MBX-APIKEY': this.apiKey }
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

  // Get order status
  async getOrder(symbol, orderId) {
    try {
      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      const response = await fetch(
        `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': this.apiKey }
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

  // Cancel order
  async cancelOrder(symbol, orderId) {
    try {
      const timestamp = Date.now();
      const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
      const signature = this.signRequest(queryString);
      
      const response = await fetch(
        `${this.baseURL}/api/v3/order?${queryString}&signature=${signature}`,
        {
          method: 'DELETE',
          headers: { 'X-MBX-APIKEY': this.apiKey }
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

  // Get 24hr ticker price change statistics
  async get24hrStats(symbol) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/v3/ticker/24hr?symbol=${symbol}`
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
