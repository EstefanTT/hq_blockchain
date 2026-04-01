// services/messaging/telegram.js
// Sends messages to Telegram chats via Bot API. Used for alerts, trade reports, risk warnings.

import axios from 'axios';

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Send a text message to a Telegram chat.
 * @param {string} chatId - Telegram chat/group ID
 * @param {string} text - Message content
 * @param {object} opts - Optional: { threadId, parseMode }
 */
export async function sendTelegramMessage(chatId, text, opts = {}) {
	try {
		await axios.post(`${TELEGRAM_API}/sendMessage`, {
			chat_id: chatId,
			text,
			parse_mode: opts.parseMode || 'HTML',
			...(opts.threadId && { message_thread_id: opts.threadId }),
		});
		console.log('TGRAM', `Message sent to ${chatId}`);
	} catch (err) {
		console.error('TGRAM', `Failed to send message: ${err.message}`);
	}
}
