class NotificationService {
  constructor(config) {
    this.config = config || {};
  }

  // Send Telegram notification
  async sendTelegram(message) {
    if (!this.config.telegramBotToken || !this.config.telegramChatId) {
      console.log('⚠️ Telegram not configured');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.telegramChatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      const result = await response.json();
      
      if (result.ok) {
        console.log('✅ Telegram notification sent');
        return true;
      } else {
        console.error('❌ Telegram error:', result.description);
        return false;
      }
    } catch (error) {
      console.error('❌ Telegram error:', error.message);
      return false;
    }
  }

  // Send trade alert to Telegram
  async sendTradeAlert(trade) {
    const modeEmoji = trade.mode === 'live' ? '🔴' : '📄';
    const typeEmoji = trade.trade_type === 'BUY' ? '🟢' : '🔴';
    
    const message = `
${modeEmoji} <b>${trade.mode.toUpperCase()} TRADING ALERT</b>

${typeEmoji} <b>${trade.trade_type}</b>
━━━━━━━━━━━━━━━━━━
📊 Symbol: ${trade.symbol}
💰 Price: $${parseFloat(trade.price).toFixed(2)}
📦 Quantity: ${parseFloat(trade.quantity).toFixed(6)}
💵 Total: $${parseFloat(trade.total_value).toFixed(2)}
${trade.profit_loss ? `📈 P&L: $${parseFloat(trade.profit_loss).toFixed(2)}` : ''}
🎯 Confidence: ${trade.confidence || 'N/A'}%
🧠 Strategy: ${trade.strategy || 'N/A'}
⏰ Time: ${new Date(trade.created_at || Date.now()).toLocaleString()}
    `.trim();

    return await this.sendTelegram(message);
  }
}

module.exports = NotificationService;
