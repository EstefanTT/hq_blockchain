# Master Dashboard + Enhanced Bot Control UI (Depth ***)

**Only implement this step.**  
This is the final UI improvement after the bot construction is complete.

### Overall Goal
Create a **professional, futuristic Master Dashboard** as the main entry point for the entire `hq_blockchain` app.

The current `/api/dashboard/steem-dex-bot` page will become the **detailed view** for the STEEM bot only.  
The new master dashboard will give a clean overview of the whole app and allow easy control of bots, strategies, and runtime parameters **without touching code or restarting the server**.

Style inspiration: dark modern theme like the "Contoso - Ticket Volume Dashboard" screenshot (clean cards, side navigation, subtle gradients, clear sections, modern typography).

### New Master Dashboard (main page)

- URL: `/api/dashboard/` (or `/api/dashboard/home`)
- Serve a new HTML file `api/dashboard/index.html`
- Protected by the existing `auth.js` middleware (same token system as before)

**Layout (from left to right / top to bottom):**

1. **Sidebar Navigation** (fixed, dark)
   - Home (this master dashboard)
   - Trading Bots (list of all bots with ON/OFF status)
   - Analysis Tools
   - Research Sandbox (future)
   - Settings (future)

2. **Top Bar**
   - App title "hq_blockchain"
   - Global Dry-Run toggle
   - Emergency Stop button (red)
   - Logged-in user (simple display)

3. **Main Content Sections**

   **Section 1: App Overview** (top row, cards)
   - App size on disk
   - Logs size (with "Clean Logs" button)
   - Last snapshot time
   - Quick links to run analysis/backtest/summary scripts

   **Section 2: Trading Bots** (main area, cards)
   - One card per bot (currently only STEEM DEX Bot)
   - Each card shows:
     - Bot name + chain/pair
     - ON/OFF switch (global control)
     - Current active strategy (or "Paused")
     - Last mode switch time
     - Quick "Open Detailed View" button (links to /api/dashboard/steem-dex-bot)

   **Section 3: Recent Bot Logs** (bottom)
   - Last 10 logs from the bot (same as current bot page)
   - "View Full Logs" button that opens a new full-logs explorer page

4. **Full Logs Explorer Page** (`/api/dashboard/logs`)
   - Scrollable list of all bot logs (auto-load more on scroll or "Load 50 more" button)
   - Filter by event type / strategy / severity
   - Search box

### Per-Bot Page Enhancements (`/api/dashboard/steem-dex-bot`)

Keep all existing sections (Engine Status, Order Book, etc.).

**New additions:**
- **Major ON/OFF switch** at the top (same variable as master dashboard)
- **Per-Strategy Switches** (5 toggles):
  - Market-Making
  - Aggressive Sniping
  - Grid/Range
  - Mean-Reversion
  - Defensive/Pause
- **Editable Runtime Parameters** (form with Save button):
  - Max total exposure (SBD)
  - Max order size per strategy
  - Slippage threshold
  - RC warning threshold
  - Brain tick interval
  - Any other safe parameter you think makes sense

All changes must be saved to `config/dynamic/` or runtime cache so they survive restarts.

### Technical Requirements
- Use existing Tailwind + vanilla JS + Chart.js (no new frameworks)
- All API endpoints for switches and parameters must be protected by auth
- When the app starts → **all bots and strategies are OFF by default**
- Changes made in UI must be reflected immediately in both master and per-bot pages (use cache or simple polling)
- Keep the code clean and maintainable — future bots must fit naturally

### Testing
- Verify master dashboard loads and shows correct status
- Test all switches and parameter changes (they must take effect without restart)
- Confirm individual bot page and master page stay in sync
- Verify full logs explorer works smoothly

**Important note**  
Make the UI beautiful, spacious, and futuristic (inspired by the Contoso dashboard from the photo attached here).  
If you have any important doubts or see a better way to make the control system even cleaner, please ask first before coding anything. Do not start implementation until we confirm.

This completes the bot with a professional, easy-to-use control interface.