# services/messaging/

Outbound notification channels. Sends alerts, trade summaries, risk warnings to external systems.

| File | Channel |
|---|---|
| `telegram.js` | Telegram Bot API — sends messages to chats/groups/threads |

Add more channels as needed (Discord webhook, email, Slack, etc.). Each file exports simple `send*` functions.
