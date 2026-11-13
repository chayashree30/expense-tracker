/**
 * Transactions Domain, Pure Calculations & History View Module
 * ---------------------------------------------------------------------------
 * All financial calculation helpers in this module are pure functions
 * independent of LocalStorage so they remain unchanged when migrating to
 * a backend API.
 */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Business',
  'Bonus',
  'Gifts',
  'Other',
];

export const ALL_CATEGORIES = Array.from(
  new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
);

export const CATEGORY_COLORS = [
  '#0F766E',
  '#0284C7',
  '#D97706',
  '#7C3AED',
  '#E11D48',
  '#059669',
  '#4F46E5',
  '#EA580C',
  '#64748B',
];

/**
 * Escapes HTML special characters for safe DOM template interpolation.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Returns categories associated with a transaction type.
 * @param {'income'|'expense'} type
 * @returns {string[]}
 */
export function getCategoriesByType(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/**
 * Returns today's date in YYYY-MM-DD local format.
 * @returns {string}
 */
export function getTodayIsoDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the YYYY-MM key for the current calendar month.
 * @returns {string}
 */
export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Formats a numeric value as USD currency.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

/**
 * Formats a YYYY-MM-DD date string into a clean human-readable date.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr || '—';
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats a YYYY-MM month key into "November 2026".
 * @param {string} monthKey
 * @param {'long'|'short'} format
 * @returns {string}
 */
export function formatMonthLabel(monthKey, format = 'long') {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return monthKey || '';
  }
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: format === 'short' ? 'short' : 'long',
    year: format === 'short' ? '2-digit' : 'numeric',
  }).format(date);
}

/**
 * Generates an ordered list of available YYYY-MM month keys from transactions + recent 6 months.
 * @param {Array<object>} transactions
 * @returns {string[]}
 */
export function getAvailableMonthKeys(transactions) {
  const set = new Set();
  const now = new Date();
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  transactions.forEach((tx) => {
    if (tx.date && tx.date.length >= 7) {
      set.add(tx.date.slice(0, 7));
    }
  });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

/* ==========================================================================
   Pure Financial Calculation Functions
   ========================================================================== */

/**
 * Computes all-time and selected-month financial totals dynamically.
 * Total Balance = Total Income - Total Expenses.
 * @param {Array<object>} transactions
 * @param {string} monthKey
 */
export function calculateSummaryTotals(transactions, monthKey) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let monthlyTransactionCount = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const txMonth = tx.date ? tx.date.slice(0, 7) : '';

    if (tx.type === 'income') {
      totalIncome += amount;
      if (txMonth === monthKey) {
        monthlyIncome += amount;
        monthlyTransactionCount += 1;
      }
    } else {
      totalExpenses += amount;
      if (txMonth === monthKey) {
        monthlyExpenses += amount;
        monthlyTransactionCount += 1;
      }
    }
  }

  const totalBalance = totalIncome - totalExpenses;
  const monthlyNet = monthlyIncome - monthlyExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return {
    totalIncome,
    totalExpenses,
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet,
    savingsRate,
    transactionCount: transactions.length,
    monthlyTransactionCount,
  };
}

/**
 * Aggregates transactions by category for a given type and optional monthKey.
 * @param {Array<object>} transactions
 * @param {'expense'|'income'} type
 * @param {string|null} monthKey
 * @returns {Array<{ category: string, total: number, count: number, percentage: number, average: number, color: string }>}
 */
export function calculateCategoryBreakdown(transactions, type = 'expense', monthKey = null) {
  const filtered = transactions.filter((tx) => {
    if (tx.type !== type) return false;
    if (monthKey && (!tx.date || tx.date.slice(0, 7) !== monthKey)) return false;
    return true;
  });

  const totalsMap = new Map();
  let grandTotal = 0;

  for (const tx of filtered) {
    const amount = Number(tx.amount) || 0;
    grandTotal += amount;
    const entry = totalsMap.get(tx.category) || { total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    totalsMap.set(tx.category, entry);
  }

  return Array.from(totalsMap.entries())
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      count: stats.count,
      percentage: grandTotal > 0 ? (stats.total / grandTotal) * 100 : 0,
      average: stats.count > 0 ? stats.total / stats.count : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .map((item, idx) => ({
      ...item,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }));
}

/**
 * Builds monthly income vs. expense series for the last N months ending at endMonthKey.
 * @param {Array<object>} transactions
 * @param {number} monthsCount
 * @param {string} endMonthKey
 */
export function calculateMonthlySeries(transactions, monthsCount = 6, endMonthKey = getCurrentMonthKey()) {
  const [endYear, endMonth] = endMonthKey.split('-').map(Number);
  const monthKeys = [];

  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const d = new Date(endYear, endMonth - 1 - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const map = new Map(monthKeys.map((k) => [k, { income: 0, expense: 0 }]));

  for (const tx of transactions) {
    const key = tx.date ? tx.date.slice(0, 7) : '';
    if (!map.has(key)) continue;
    const bucket = map.get(key);
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      bucket.income += amount;
    } else {
      bucket.expense += amount;
    }
  }

  const labels = monthKeys.map((k) => formatMonthLabel(k, 'short'));
  const incomeData = monthKeys.map((k) => Math.round(map.get(k).income * 100) / 100);
  const expenseData = monthKeys.map((k) => Math.round(map.get(k).expense * 100) / 100);
  const netData = monthKeys.map(
    (k) => Math.round((map.get(k).income - map.get(k).expense) * 100) / 100
  );

  return { labels, monthKeys, incomeData, expenseData, netData };
}

/**
 * Builds day-by-day spending and income totals for a specific month.
 * @param {Array<object>} transactions
 * @param {string} monthKey
 */
export function calculateDailySeries(transactions, monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = [];
  const expenseData = new Array(daysInMonth).fill(0);
  const incomeData = new Array(daysInMonth).fill(0);

  for (let day = 1; day <= daysInMonth; day += 1) {
    labels.push(String(day));
  }

  for (const tx of transactions) {
    if (!tx.date || tx.date.slice(0, 7) !== monthKey) continue;
    const dayIndex = Number(tx.date.slice(8, 10)) - 1;
    if (dayIndex < 0 || dayIndex >= daysInMonth) continue;
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      incomeData[dayIndex] += amount;
    } else {
      expenseData[dayIndex] += amount;
    }
  }

  return {
    labels,
    expenseData: expenseData.map((v) => Math.round(v * 100) / 100),
    incomeData: incomeData.map((v) => Math.round(v * 100) / 100),
  };
}

/**
 * Computes monthly budget metrics and threshold states (80% warning, 100% exceeded).
 * @param {Array<object>} transactions
 * @param {{ monthlyLimit: number }} budget
 * @param {string} monthKey
 */
export function calculateBudgetMetrics(transactions, budget, monthKey) {
  const limit = Number(budget?.monthlyLimit) || 0;
  let spent = 0;

  for (const tx of transactions) {
    if (tx.type === 'expense' && tx.date && tx.date.slice(0, 7) === monthKey) {
      spent += Number(tx.amount) || 0;
    }
  }

  const remaining = limit - spent;
  const utilizationPct = limit > 0 ? (spent / limit) * 100 : 0;
  const overAmount = spent > limit ? spent - limit : 0;

  let status = 'unset';
  if (limit > 0) {
    if (utilizationPct >= 100) {
      status = 'exceeded';
    } else if (utilizationPct >= 80) {
      status = 'warning';
    } else {
      status = 'nominal';
    }
  }

  return {
    limit,
    spent,
    remaining,
    utilizationPct,
    clampedPct: Math.min(100, Math.max(0, utilizationPct)),
    overAmount,
    status,
  };
}

/**
 * Filters and sorts transactions based on search query, type, category, and sort order.
 * @param {Array<object>} transactions
 * @param {object} filters
 * @returns {Array<object>}
 */
export function filterAndSortTransactions(transactions, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  const type = filters.type || 'all';
  const category = filters.category || 'all';
  const sortBy = filters.sortBy || 'date-desc';

  const filtered = transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;

    if (search) {
      const haystack = `${tx.title} ${tx.description} ${tx.category} ${tx.amount}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    // Default: date-desc
    return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
  });

  return sorted;
}

/**
 * Validates Add/Edit Transaction form input.
 * @param {object} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateTransactionInput(input) {
  const errors = {};

  const title = String(input.title || '').trim();
  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  }

  const amount = Number(input.amount);
  if (input.amount === '' || input.amount === null || input.amount === undefined) {
    errors.amount = 'Please enter an amount.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than $0.00.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount exceeds maximum allowed limit.';
  }

  if (input.type !== 'income' && input.type !== 'expense') {
    errors.type = 'Please select Income or Expense.';
  }

  const category = String(input.category || '').trim();
  if (!category) {
    errors.category = 'Please select a category.';
  }

  const date = String(input.date || '').trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  }

  const description = String(input.description || '').trim();
  if (description.length > 240) {
    errors.description = 'Description must be 240 characters or less.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/* ==========================================================================
   Shared Table Rendering & Transaction History View
   ========================================================================== */

/**
 * Generates HTML markup for a transaction table.
 * @param {Array<object>} transactions
 * @param {{ showActions?: boolean, emptyTitle?: string, emptyDescription?: string, emptyActionHtml?: string }} options
 * @returns {string}
 */
export function buildTransactionsTableHtml(transactions, options = {}) {
  const {
    showActions = true,
    emptyTitle = 'No transactions found',
    emptyDescription = 'Add your first income or expense transaction to start tracking.',
    emptyActionHtml = '',
  } = options;

  if (!transactions.length) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="receipt"></i>
        </div>
        <h3 class="empty-state-title">${escapeHtml(emptyTitle)}</h3>
        <p class="empty-state-desc">${escapeHtml(emptyDescription)}</p>
        ${emptyActionHtml}
      </div>
    `;
  }

  const rowsHtml = transactions
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'is-income' : 'is-expense';
      const typeLabel = isIncome ? 'Income' : 'Expense';
      const typeIcon = isIncome ? 'arrow-down-left' : 'arrow-up-right';
      const descMarkup = tx.description
        ? `<span class="tx-desc" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</span>`
        : '';

      return `
        <tr data-tx-id="${escapeHtml(tx.id)}">
          <td class="tx-date tabular-nums">${escapeHtml(formatDate(tx.date))}</td>
          <td>
            <div class="tx-title-cell">
              <span class="tx-title">${escapeHtml(tx.title)}</span>
              ${descMarkup}
            </div>
          </td>
          <td class="tx-category-text">${escapeHtml(tx.category)}</td>
          <td>
            <span class="tx-type-text ${amountClass}">
              <i data-lucide="${typeIcon}"></i>
              <span>${typeLabel}</span>
            </span>
          </td>
          <td class="td-right">
            <span class="tx-amount tabular-nums ${amountClass}">
              ${sign}${escapeHtml(formatCurrency(tx.amount))}
            </span>
          </td>
          ${
            showActions
              ? `
            <td class="td-right">
              <div class="table-actions">
                <button
                  type="button"
                  class="icon-btn icon-btn-sm"
                  data-action="edit-tx"
                  data-tx-id="${escapeHtml(tx.id)}"
                  aria-label="Edit ${escapeHtml(tx.title)}"
                  title="Edit transaction"
                >
                  <i data-lucide="pencil"></i>
                </button>
                <button
                  type="button"
                  class="icon-btn icon-btn-sm icon-btn-danger"
                  data-action="delete-tx"
                  data-tx-id="${escapeHtml(tx.id)}"
                  aria-label="Delete ${escapeHtml(tx.title)}"
                  title="Delete transaction"
                >
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </td>
          `
              : ''
          }
        </tr>
      `;
    })
    .join('');

  return `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th class="th-right">Amount</th>
            ${showActions ? '<th class="th-right">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Populates the category filter dropdown in Transaction History.
 * @param {string} selectedCategory
 */
function syncCategoryFilterOptions(selectedCategory) {
  const select = document.getElementById('tx-category-filter');
  if (!select) return;

  const options = ['<option value="all">All Categories</option>'].concat(
    ALL_CATEGORIES.map(
      (cat) =>
        `<option value="${escapeHtml(cat)}" ${
          selectedCategory === cat ? 'selected' : ''
        }>${escapeHtml(cat)}</option>`
    )
  );
  select.innerHTML = options.join('');
}

/**
 * Renders the Transaction History view (Feature 3).
 * @param {Array<object>} transactions
 * @param {object} filters
 */
export function renderTransactionsView(transactions, filters) {
  syncCategoryFilterOptions(filters.category);

  const searchInput = document.getElementById('tx-search-input');
  if (searchInput && searchInput.value !== filters.search) {
    searchInput.value = filters.search;
  }

  const sortSelect = document.getElementById('tx-sort-select');
  if (sortSelect && sortSelect.value !== filters.sortBy) {
    sortSelect.value = filters.sortBy;
  }

  document.querySelectorAll('[data-tx-type]').forEach((btn) => {
    const isActive = btn.getAttribute('data-tx-type') === filters.type;
    btn.classList.toggle('is-active', isActive);
  });

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    filters.type !== 'all' ||
    filters.category !== 'all';

  const clearBtn = document.getElementById('tx-clear-filters-btn');
  if (clearBtn) {
    clearBtn.hidden = !hasActiveFilters;
  }

  const filtered = filterAndSortTransactions(transactions, filters);

  // Compute net sum of filtered list
  let filteredIncome = 0;
  let filteredExpense = 0;
  for (const tx of filtered) {
    if (tx.type === 'income') filteredIncome += tx.amount;
    else filteredExpense += tx.amount;
  }

  const summaryEl = document.getElementById('tx-results-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span class="tabular-nums">Showing <strong>${filtered.length}</strong> of ${transactions.length} transactions</span>
      <span class="tabular-nums">
        Filtered Cash Flow:
        <strong>${escapeHtml(formatCurrency(filteredIncome - filteredExpense))}</strong>
        (In ${escapeHtml(formatCurrency(filteredIncome))} · Out ${escapeHtml(
      formatCurrency(filteredExpense)
    )})
      </span>
    `;
  }

  const container = document.getElementById('transactions-table-container');
  if (!container) return;

  const emptyActionHtml = hasActiveFilters
    ? '<button type="button" id="empty-clear-filters-btn" class="btn btn-secondary">Clear Filters</button>'
    : '<button type="button" id="empty-add-tx-btn" class="btn btn-primary">Add First Transaction</button>';

  container.innerHTML = buildTransactionsTableHtml(filtered, {
    showActions: true,
    emptyTitle: hasActiveFilters ? 'No matching transactions' : 'No transactions recorded yet',
    emptyDescription: hasActiveFilters
      ? 'Try adjusting your search query, category, or type filter.'
      : 'Add your first income or expense entry to populate your ledger.',
    emptyActionHtml,
  });
}

/**
 * Exports given transactions as a downloadable CSV file.
 * @param {Array<object>} transactions
 */
export function exportTransactionsToCsv(transactions) {
  const headers = ['ID', 'Date', 'Title', 'Type', 'Category', 'Amount', 'Description'];
  const escapeCsv = (val) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(','),
    ...transactions.map((tx) =>
      [
        tx.id,
        tx.date,
        tx.title,
        tx.type,
        tx.category,
        tx.amount.toFixed(2),
        tx.description,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clearledger-transactions-${getTodayIsoDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
