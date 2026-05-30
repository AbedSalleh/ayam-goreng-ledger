# 🍗 Ayam Goreng Ledger

**A zero-cost, mobile-first web app for tracking your fried chicken stall's daily revenue and expenses.**

Your data lives in your own Google Drive — no servers, no subscriptions, no fees. Just open the app on your phone, log today's sales, and watch your profits grow.

---

## ✨ Features

- 📊 **Live Dashboard** — See revenue, expenses, and net profit at a glance with animated charts
- 💰 **Sales Tracking** — Record daily cash and QR payment totals in seconds
- 📦 **Expense Logging** — Categorize costs (chicken, oil, flour, rent, etc.)
- 🎯 **Profit Target** — Set a monthly goal and track your progress bar
- 📱 **Mobile-First** — Designed for phone screens, works on any device
- 🔒 **Your Data, Your Drive** — Everything is stored in a Google Sheets file in *your* Google Drive
- 🎨 **Warm Premium Theme** — Beautiful amber/gold "Warung Emas" design, easy on the eyes
- 🆓 **100% Free** — No server costs, no database fees, no subscriptions

---

## 📋 Prerequisites

Before you begin, make sure you have:

- ✅ A **Google account** (personal Gmail is fine)
- ✅ A **modern web browser** (Chrome, Edge, Safari, or Firefox)
- ✅ ~10 minutes to complete the one-time setup

---

## 🚀 Setup Guide

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** in the top bar → **"New Project"**
3. Name it anything you like (e.g., `Ayam Goreng Ledger`)
4. Click **"Create"**

> 💡 **No billing is required.** The free tier covers everything this app needs.

---

### Step 2: Enable the Required APIs

You need to enable two Google APIs:

1. In the Cloud Console, go to **APIs & Services → Library**
2. Search for **"Google Sheets API"** → click it → click **"Enable"**
3. Go back to the Library, search for **"Google Drive API"** → click it → click **"Enable"**

> These APIs allow the app to create and read/write a spreadsheet in your Drive.

---

### Step 3: Configure the OAuth Consent Screen

This tells Google what your app does when it asks for permission.

1. Go to **APIs & Services → OAuth consent screen**
2. Select **"External"** as the user type → click **"Create"**
3. Fill in the required fields:
   - **App name**: `Ayam Goreng Ledger`
   - **User support email**: your email
   - **Developer contact information**: your email
4. Click **"Save and Continue"**
5. On the **Scopes** page, click **"Add or Remove Scopes"** and add:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/spreadsheets`
6. Click **"Save and Continue"**
7. On the **Test users** page, click **"Add Users"** and enter your email address
8. Click **"Save and Continue"** → **"Back to Dashboard"**

> ⚠️ **Important**: While the app is in "Testing" mode, only the email addresses you add as test users can sign in. This is fine for personal use.

---

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Set the application type to **"Web application"**
4. Name it: `Ayam Goreng Ledger`
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5500` (for VS Code Live Server)
   - `http://localhost:3000` (for npx serve)
   - `http://127.0.0.1:5500` (alternative localhost)
   - If deploying online, add your deployment URL (e.g., `https://yourdomain.com`)
6. Click **"Create"**
7. 📋 **Copy the Client ID** — you'll need it in the next step

> The Client ID looks like: `123456789-abcdef.apps.googleusercontent.com`

---

### Step 5: Configure the App

1. Open `js/app.js` in a text editor
2. Find the `CONFIG` object near the top of the file:
   ```javascript
   const CONFIG = {
     CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
     API_KEY: 'YOUR_API_KEY',
   };
   ```
3. Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with the Client ID you copied
4. *(Optional)* Replace `YOUR_API_KEY` with an API key if you created one
5. Save the file

---

### Step 6: Run the App

Choose one of these options to serve the app locally:

#### Option A: VS Code Live Server *(Recommended)*
1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code
2. Open the project folder in VS Code
3. Right-click `index.html` → **"Open with Live Server"**
4. The app opens at `http://localhost:5500`

#### Option B: npx serve
```bash
npx serve .
```
Open the URL shown in the terminal (usually `http://localhost:3000`).

#### Option C: Any Local HTTP Server
```bash
# Python
python -m http.server 5500

# PHP
php -S localhost:5500
```

> 🚫 **Important**: The app **must** be served over HTTP or HTTPS. Opening `index.html` directly as a `file://` URL will **not work** because Google OAuth requires a web server origin.

---

## 📖 Usage

### First Launch

1. Open the app in your browser
2. Click **"Sign in with Google"**
3. Authorize the app to access your Google Drive
4. The app automatically creates a spreadsheet called **`Ayam_Goreng_Ledger`** in your Google Drive

### Daily Workflow

1. **Record Sales** — Tap the **Sales** tab, enter today's cash and QR totals, then hit **Save**
2. **Log Expenses** — Tap the **Expenses** tab, pick a category, enter the amount, and save
3. **Check Progress** — The **Dashboard** shows your month-to-date revenue, expenses, profit, and target progress

### Navigation

| Tab | What it does |
|-----|-------------|
| 📊 Dashboard | Month overview with revenue, expenses, profit, and target progress |
| 💰 Sales | Record daily sales (cash + QR) |
| 📦 Expenses | Log expenses by category |

### Settings

- Tap the **⚙️ gear icon** to open Settings
- Set your **monthly profit target** (default: RM 2,000)
- The dashboard progress bar updates accordingly

---

## 🔒 Data Security

Your data is safe. Here's why:

| Concern | Answer |
|---------|--------|
| Where is my data stored? | In a Google Sheets file in **your** Google Drive |
| Can anyone else see it? | **No.** Only you have access to your Drive files |
| Does the app send data to a server? | **No.** The app runs entirely in your browser |
| What permissions does it use? | `drive.file` — the app can only access files **it creates**, not your other Drive files |
| Is my Google password stored? | **No.** Authentication is handled by Google's official sign-in flow |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (custom properties + animations), Vanilla JavaScript |
| Styling | Tailwind CSS (utility classes) + custom dark theme |
| Auth | Google Identity Services (OAuth 2.0) |
| Backend | Google Sheets API v4 (serverless — no backend needed) |
| Storage | Google Drive (user's own account) |
| Hosting | Any static file server (Live Server, GitHub Pages, Netlify, etc.) |

---

## 📁 Project Structure

```
ayam-goreng-ledger/
├── index.html          # Main HTML — all views and modals
├── css/
│   └── style.css       # Custom styles, animations, dark theme
├── js/
│   ├── auth.js         # Google Identity Services wrapper (AyamAuth)
│   ├── sheets.js       # Google Sheets API wrapper (AyamSheets)
│   ├── dashboard.js    # Dashboard data & rendering (AyamDashboard)
│   └── app.js          # Main controller — forms, views, toasts (AyamApp)
└── README.md           # You are here
```

---

## 🐛 Troubleshooting

### "Sign in" button does nothing
- Make sure you've set `CLIENT_ID` in `js/app.js`
- Make sure the app is served via HTTP (not `file://`)
- Check the browser console for errors

### "Access blocked: This app's request is invalid"
- Your JavaScript origin URL doesn't match what's in Google Cloud Console
- Add the exact URL (including port) to **Authorized JavaScript Origins** in your OAuth client settings

### "This app is not verified"
- This is normal for apps in "Testing" mode
- Click **"Advanced"** → **"Go to Ayam Goreng Ledger (unsafe)"** to proceed
- This warning won't appear for email addresses added as test users

### Data not showing on dashboard
- Make sure you're viewing the correct month (use the ◀ ▶ arrows)
- Check that the spreadsheet `Ayam_Goreng_Ledger` exists in your Google Drive

---

## 📄 License

MIT License — free for personal and commercial use.

```
Copyright (c) 2026 Ayam Goreng Ledger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  Made with 🍗 for street food entrepreneurs everywhere
</p>
