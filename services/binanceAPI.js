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
