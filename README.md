# ClearLedger — Personal Expense Tracker

A clean, minimalist financial dashboard built strictly with **HTML5**, **CSS3**, and **Vanilla JavaScript**, using **Chart.js** (CDN) for charts, **Lucide Icons** (CDN) for iconography, and **LocalStorage** for client-side persistence.

## Project Structure

```
expense-tracker/
├── index.html          # Semantic HTML5 shell, views, modals, and CDN links
├── css/
│   └── style.css       # Responsive CSS3 design system and dashboard layout
├── js/
│   ├── app.js          # Application controller, routing, modals, and event wiring
│   ├── storage.js      # Centralized LocalStorage persistence & sample seeding
│   ├── transactions.js # Pure financial calculations, validation, and Transaction History view
│   ├── dashboard.js    # Dashboard KPIs, overview charts, and recent transactions
│   ├── analytics.js    # Expense analytics, savings metrics, and category charts
│   └── budget.js       # Monthly budget configuration, utilization bar, and 80%/100% alerts
└── assets/
    └── favicon.svg     # Vector brand mark and browser favicon
```

## Module Responsibilities

- **`js/storage.js`**: Centralizes all `localStorage` CRUD operations (`getTransactions`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `getBudget`, `saveBudget`). Designed so replacing LocalStorage with REST API `fetch()` calls to a future Node.js/Express/SQL backend only requires modifying this module.
- **`js/transactions.js`**: Houses pure calculation functions (`calculateSummaryTotals`, `calculateCategoryBreakdown`, `calculateMonthlySeries`, `calculateDailySeries`, `calculateBudgetMetrics`, `filterAndSortTransactions`, `validateTransactionInput`) completely decoupled from storage, plus Transaction History table rendering and CSV export.
- **`js/dashboard.js`**: Renders dynamic KPI cards (Total Balance, Total Income, Total Expenses, Monthly Spending), conditional budget warning banners, Monthly/Daily Spending Overview chart, Expense Category Breakdown doughnut chart, and Recent Transactions table.
- **`js/analytics.js`**: Computes Total Savings, Highest Spending Category, Average Monthly Expense, and Primary Income Source alongside Monthly Income vs. Expenses, Category-Wise Expense Breakdown, and Spending Distribution charts.
- **`js/budget.js`**: Manages monthly budget limits, remaining budget, utilization progress bar, 80% warning notifications, exceeded alerts, and monthly expense contributors.
- **`js/app.js`**: Bootstraps initial data, handles navigation between views, manages the Add/Edit Transaction and Confirmation modals, and syncs UI state across modules.

## Running Locally

Because the application uses native ES Modules (`<script type="module">`), serve the project over HTTP rather than opening `index.html` via `file://`:

1. **Using Python 3**:
   ```bash
   python3 -m http.server 8080
   ```
   Then open `http://localhost:8080` in your browser.

2. **Using VS Code Live Server**:
   Right-click `index.html` and select **Open with Live Server**.
