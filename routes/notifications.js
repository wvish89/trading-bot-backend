const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notifications');

const notifications = new NotificationService({
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID
});

// GET notification status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    telegram: {
      configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      botToken: process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Not set',
      chatId: process.env.TELEGRAM_CHAT_ID ? '✅ Set' : '❌ Not set'
    }
  });
});

// POST test notification
router.post('/test', async (req, res) => {
  try {
    await notifications.sendTelegram('🤖 Test notification from Trading Bot!\n\nIf you see this, Telegram is working correctly.');
    
    res.json({
      success: true,
      message: 'Test notification sent to Telegram'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
