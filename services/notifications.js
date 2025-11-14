// Notification service for email, SMS, and Telegram
// Note: Install packages in your backend: npm install axios

class NotificationService {
  constructor(config) {
    this.config = config || {};
  }

  // Send email notification (requires nodemailer setup)
  async sendEmail(subject, message) {
    console.log(`📧 Email: ${subject} - ${message}`);
    // Implement with nodemailer, SendGrid, or AWS SES
    // const nodemailer = require('nodemailer');
    // ... email sending code
  }

  // Send SMS notification (requires Twilio)
  async sendSMS(message) {
    console.log(`📱 SMS: ${message}`);
    // Implement with Twilio
    // const twilio = require('twilio');
    // ... SMS sending code
  }

  // Send Telegram notification
  async sendTelegram(message) {
    if (!this.config.telegramBotToken || !this.config.telegramChatId) {
      console.log('⚠️ Telegram not configured');
      return;
    }

    try {
      const axios = require('axios');
      const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;
      
      await axios.post(url, {
        chat_id: this.config.telegramChatId,
        text: message,
        parse_mode: 'HTML'
      });
      
      console.log('✅ Telegram notification sent');
    } catch (error) {
      console.error('❌ Telegram error:', error.message);
    }
  }

  // Send trade alert to all enabled channels
  async sendTradeAlert(trade) {
    const message = `
🤖 Trading Bot Alert

Type: ${trade.trade_type}
Symbol: ${trade.symbol}
Price: $${trade.price}
Quantity: ${trade.quantity}
${trade.profit_loss ? `P&L: $${trade.profit_loss}` : ''}
Confidence: ${trade.confidence}%
Time: ${new Date().toLocaleString()}
    `.trim();

    // Send to all configured channels
    await Promise.all([
      this.sendTelegram(message),
      // this.sendEmail('Trade Alert', message),
      // this.sendSMS(message)
    ]);
  }
}

module.exports = NotificationService;
