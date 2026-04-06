# Master Dashboard + Enhanced Per-Bot Pages with Full Control UI (Depth ***)

**Only implement this step.**  
This is the final UI improvement that makes the entire hq_blockchain app easy and pleasant to use without touching code.

### Overall Goal
Create a **professional, futuristic, consistent control interface** inspired by the Contoso Ticket Volume Dashboard screenshot.

- The **master dashboard** (`/api/dashboard/`) becomes the main entry point for the whole app.
- The **per-bot page** (`/api/dashboard/steem-dex-bot`) is redesigned to feel like a natural part of the same UI, with the same sidebar and dark theme.
- All important controls and runtime parameters are exposed in the UI so you can tweak everything without restarting or editing code.

### Style Requirements (must match Contoso screenshot)
- Dark background with subtle gradients
- Bright, clear data cards (data and text pop on the dark background)
- Clean, spacious layout with good use of white space
- Modern typography and subtle shadows
- Blue accents for active elements, red for emergency actions
- Consistent card style, icon usage, and color scheme

### 1. Master Dashboard (`/api/dashboard/` or `/api/dashboard/home`)
- Create a new route file `api/routes/dashboard/home.get.js` that returns the full HTML page inline.
- Fixed sidebar on the left (same as Contoso):
  - Home (this page)
  - STEEM DEX Bot
  - Logs Explorer
  - Research (grayed out)
  - Settings (grayed out)
- Top bar:
  - App title "hq_blockchain"
  - API Token field (same as current)
  - Dry-Run toggle (global)
  - Emergency Pause button (red)
  - User icon (simple)

**Main content sections:**

- **App Overview** (top row of cards)
  - App size on disk
  - Logs size (with "Clean Logs" button)
  - Last snapshot time
  - Quick links to run analysis/backtest/summary scripts

- **Trading Bots** (main area, cards)
  - One card per bot (currently STEEM DEX Bot)
  - Each card shows:
    - Bot name + chain/pair
    - Big ON/OFF switch for the whole bot
    - Per-bot Dry-Run toggle
    - Current active strategy or "Multiple"
    - "Open Detailed View" button (links to the bot's own page)

- **Recent Bot Logs** (bottom section)
  - Last 10 logs
  - "View Full Logs" button that opens the Logs Explorer page

### 2. Enhanced Per-Bot Page (`/api/dashboard/steem-dex-bot`)
- Keep the same sidebar and dark theme as the master dashboard.
- Top section: Global bot information (balances, RC, brain status, total open orders, micro-layer summary, etc.).
- Main area: **One big, clear card per strategy** (Market-Making, Aggressive Sniping, Grid/Range, Mean-Reversion, Defensive/Pause).
  - Each card contains:
    - ON/OFF switch for that specific strategy
    - All editable runtime parameters for that strategy (order size max, spread/distance, pyramid levels, trigger thresholds, max duration, etc.)
    - Relevant live data (active orders count, last fill, locked amount, etc.)
    - Small description of what the strategy does
- The major ON/OFF switch for the entire bot is at the top of the page (same variable as the master dashboard).

### 3. Logs Explorer Page (`/api/dashboard/logs`)
- Full paginated logs viewer with filters (eventType, severity, search box)
- "Load 50 more" button

### 4. Runtime Behavior
- When the app starts → **all bots are OFF by default**.
- When you turn **ON** a bot (from master or bot page) → **all its strategies start ON** automatically (most common use case).
- On the individual bot page you can then disable individual strategies if desired.
- All parameter changes and switches are saved to dynamic config and take effect immediately (no restart needed).
- Emergency Stop button stops everything cleanly and sets the bot to OFF.

### Technical Requirements
- Use existing Tailwind + vanilla JS.
- All API endpoints for switches and parameters must be protected by auth.
- Keep the code clean and maintainable — future bots must fit naturally.
- The bot page must feel like a natural extension of the master dashboard (same style, sidebar, colors).

**Important note**  
Make the UI beautiful, spacious, and futuristic, exactly like the Contoso dashboard screenshot.  
Data and text must pop clearly on the dark background.

If you have any important doubts or see a better way to make the control system even cleaner and more user-friendly, please ask first before coding anything. Do not start implementation until we confirm.

This completes the professional, easy-to-use control interface we want for the bot.

Go ahead and implement the master dashboard + all the enhancements described above.