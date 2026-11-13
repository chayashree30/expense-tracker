/**
 * Dashboard View Module (Feature 1)
 * ---------------------------------------------------------------------------
 * Renders dynamic KPI summary cards, budget status banner, Chart.js
 * monthly/daily spending overview, expense category breakdown, and recent
 * transactions list.
 */

import {
  buildTransactionsTableHtml,
  calculateBudgetMetrics,
  calculateCategoryBreakdown,
  calculateDailySeries,
  calculateMonthlySeries,
  calculateSummaryTotals,
  escapeHtml,
  filterAndSortTransactions,
  formatCurrency,
  formatMonthLabel,
} from './transactions.js';

let overviewChartInstance = null;
let categoryChartInstance = null;

/**
 * Renders the 4 summary KPI cards on the Dashboard.
 * @param {object} totals
 * @param {string} activeMonth
 */
function renderKpiCards(totals, activeMonth) {
  const grid = document.getElementById('dashboard-kpi-grid');
  if (!grid) return;

  const monthLabel = formatMonthLabel(activeMonth);
  const balanceClass = totals.totalBalance >= 0 ? 'is-income' : 'is-expense';

  grid.innerHTML = `
    <article class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Total Balance</span>
        <span class="kpi-icon-box is-accent"><i data-lucide="wallet"></i></span>
      </div>
      <div class="kpi-value tabular-nums ${balanceClass}">
        ${escapeHtml(formatCurrency(totals.totalBalance))}
      </div>
      <div class="kpi-meta tabular-nums">
        Net across ${totals.transactionCount} transaction${totals.transactionCount === 1 ? '' : 's'}
      </div>
    </article>

    <article class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Total Income</span>
        <span class="kpi-icon-box is-income"><i data-lucide="arrow-down-left"></i></span>
      </div>
      <div class="kpi-value tabular-nums is-income">
        ${escapeHtml(formatCurrency(totals.totalIncome))}
      </div>
      <div class="kpi-meta tabular-nums">
        ${escapeHtml(formatCurrency(totals.monthlyIncome))} in ${escapeHtml(monthLabel)}
      </div>
    </article>

    <article class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Total Expenses</span>
        <span class="kpi-icon-box is-expense"><i data-lucide="arrow-up-right"></i></span>
      </div>
      <div class="kpi-value tabular-nums">
        ${escapeHtml(formatCurrency(totals.totalExpenses))}
      </div>
      <div class="kpi-meta tabular-nums">
        Savings rate: ${totals.savingsRate.toFixed(1)}%
      </div>
    </article>

    <article class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Monthly Spending</span>
        <span class="kpi-icon-box"><i data-lucide="calendar-days"></i></span>
      </div>
      <div class="kpi-value tabular-nums">
        ${escapeHtml(formatCurrency(totals.monthlyExpenses))}
      </div>
      <div class="kpi-meta tabular-nums">
        ${escapeHtml(monthLabel)} · ${totals.monthlyTransactionCount} entr${
    totals.monthlyTransactionCount === 1 ? 'y' : 'ies'
  }
      </div>
    </article>
  `;
}

/**
 * Renders a concise alert banner on Dashboard if budget utilization >= 80%.
 * @param {object} budgetMetrics
 * @param {string} activeMonth
 */
function renderDashboardBudgetBanner(budgetMetrics, activeMonth) {
  const slot = document.getElementById('dashboard-budget-alert');
  if (!slot) return;

  if (budgetMetrics.status === 'exceeded') {
    slot.innerHTML = `
      <div class="alert-banner is-exceeded" role="alert">
        <div class="alert-banner-body">
          <i data-lucide="alert-octagon"></i>
          <div>
            <span class="alert-banner-title">Monthly Budget Exceeded</span>
            <span class="tabular-nums">
              Spending in ${escapeHtml(formatMonthLabel(activeMonth))} is
              ${escapeHtml(formatCurrency(budgetMetrics.overAmount))} over your
              ${escapeHtml(formatCurrency(budgetMetrics.limit))} limit
              (${budgetMetrics.utilizationPct.toFixed(1)}%).
            </span>
          </div>
        </div>
        <button type="button" class="btn-link" data-nav="budget">
          <span>Manage Budget</span>
          <i data-lucide="arrow-right"></i>
        </button>
      </div>
    `;
  } else if (budgetMetrics.status === 'warning') {
    slot.innerHTML = `
      <div class="alert-banner is-warning" role="status">
        <div class="alert-banner-body">
          <i data-lucide="alert-triangle"></i>
          <div>
            <span class="alert-banner-title">Approaching Budget Limit</span>
            <span class="tabular-nums">
              You have used ${budgetMetrics.utilizationPct.toFixed(1)}% of your
              ${escapeHtml(formatMonthLabel(activeMonth))} budget
              (${escapeHtml(formatCurrency(budgetMetrics.remaining))} remaining).
            </span>
          </div>
        </div>
        <button type="button" class="btn-link" data-nav="budget">
          <span>Review Budget</span>
          <i data-lucide="arrow-right"></i>
        </button>
      </div>
    `;
  } else {
    slot.innerHTML = '';
  }
}

/**
 * Renders the Monthly Spending Overview chart (6-month cash flow or daily month spending).
 * @param {Array<object>} transactions
 * @param {string} activeMonth
 * @param {'monthly'|'daily'} overviewMode
 */
function renderOverviewChart(transactions, activeMonth, overviewMode) {
  const canvas = document.getElementById('dashboard-overview-chart');
  const subtitle = document.getElementById('overview-chart-subtitle');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (overviewChartInstance) {
    overviewChartInstance.destroy();
    overviewChartInstance = null;
  }

  document.querySelectorAll('[data-overview-mode]').forEach((btn) => {
    const isActive = btn.getAttribute('data-overview-mode') === overviewMode;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  if (overviewMode === 'daily') {
    if (subtitle) {
      subtitle.textContent = `Daily expenses for ${formatMonthLabel(activeMonth)}`;
    }
    const daily = calculateDailySeries(transactions, activeMonth);
    overviewChartInstance = new window.Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: daily.labels,
        datasets: [
          {
            label: 'Daily Spending',
            data: daily.expenseData,
            backgroundColor: '#0F766E',
            borderRadius: 4,
            maxBarThickness: 18,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `${formatMonthLabel(activeMonth)} ${items[0].label}`,
              label: (ctx) => `Spent: ${formatCurrency(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748B', font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#F1F5F9' },
            ticks: {
              color: '#64748B',
              font: { size: 11 },
              callback: (value) => `$${value}`,
            },
          },
        },
      },
    });
    return;
  }

  if (subtitle) {
    subtitle.textContent = `Income vs. expenses across the 6 months ending ${formatMonthLabel(
      activeMonth
    )}`;
  }

  const series = calculateMonthlySeries(transactions, 6, activeMonth);
  overviewChartInstance = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Income',
          data: series.incomeData,
          backgroundColor: '#0F766E',
          borderRadius: 5,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: series.expenseData,
          backgroundColor: '#E11D48',
          borderRadius: 5,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            useBorderRadius: true,
            borderRadius: 3,
            color: '#475569',
            font: { size: 12, weight: '500' },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748B', font: { size: 12 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#F1F5F9' },
          ticks: {
            color: '#64748B',
            font: { size: 11 },
            callback: (value) => `$${value}`,
          },
        },
      },
    },
  });
}

/**
 * Renders the Expense Category Breakdown doughnut chart and custom legend.
 * @param {Array<object>} transactions
 * @param {string} activeMonth
 */
function renderCategoryBreakdownChart(transactions, activeMonth) {
  const area = document.getElementById('dashboard-category-chart-area');
  const subtitle = document.getElementById('category-chart-subtitle');
  if (!area) return;

  if (subtitle) {
    subtitle.textContent = `Spending distribution for ${formatMonthLabel(activeMonth)}`;
  }

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  const breakdown = calculateCategoryBreakdown(transactions, 'expense', activeMonth);

  if (!breakdown.length) {
    area.innerHTML = `
      <div class="chart-empty">
        <i data-lucide="pie-chart"></i>
        <span>No expenses recorded for ${escapeHtml(formatMonthLabel(activeMonth))}</span>
      </div>
    `;
    return;
  }

  area.innerHTML = `
    <div class="chart-canvas-wrap chart-canvas-doughnut">
      <canvas id="dashboard-category-chart"></canvas>
    </div>
    <ul id="dashboard-category-legend" class="category-legend"></ul>
  `;

  const canvas = document.getElementById('dashboard-category-chart');
  const legendEl = document.getElementById('dashboard-category-legend');

  if (canvas && typeof window.Chart !== 'undefined') {
    categoryChartInstance = new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: breakdown.map((b) => b.category),
        datasets: [
          {
            data: breakdown.map((b) => b.total),
            backgroundColor: breakdown.map((b) => b.color),
            borderColor: '#FFFFFF',
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = breakdown[ctx.dataIndex];
                return `${item.category}: ${formatCurrency(item.total)} (${item.percentage.toFixed(
                  1
                )}%)`;
              },
            },
          },
        },
      },
    });
  }

  if (legendEl) {
    legendEl.innerHTML = breakdown
      .slice(0, 6)
      .map(
        (item) => `
        <li class="legend-row">
          <div class="legend-left">
            <span class="legend-swatch" style="background-color: ${item.color}"></span>
            <span class="legend-name">${escapeHtml(item.category)}</span>
          </div>
          <div class="legend-right tabular-nums">
            <span class="legend-amount">${escapeHtml(formatCurrency(item.total))}</span>
            <span class="legend-pct">${item.percentage.toFixed(1)}%</span>
          </div>
        </li>
      `
      )
      .join('');
  }
}

/**
 * Renders the Recent Transactions table (top 6 newest entries).
 * @param {Array<object>} transactions
 */
function renderRecentTransactions(transactions) {
  const container = document.getElementById('dashboard-recent-transactions');
  if (!container) return;

  const recent = filterAndSortTransactions(transactions, { sortBy: 'date-desc' }).slice(0, 6);
  container.innerHTML = buildTransactionsTableHtml(recent, {
    showActions: true,
    emptyTitle: 'No recent transactions',
    emptyDescription: 'Click "Add Transaction" to record your first income or expense.',
    emptyActionHtml:
      '<button type="button" id="dashboard-empty-add-btn" class="btn btn-primary">Add Transaction</button>',
  });
}

/**
 * Renders the complete Dashboard view.
 * @param {object} state
 */
export function renderDashboardView({ transactions, budget, activeMonth, overviewMode }) {
  const totals = calculateSummaryTotals(transactions, activeMonth);
  const budgetMetrics = calculateBudgetMetrics(transactions, budget, activeMonth);

  renderDashboardBudgetBanner(budgetMetrics, activeMonth);
  renderKpiCards(totals, activeMonth);
  renderOverviewChart(transactions, activeMonth, overviewMode);
  renderCategoryBreakdownChart(transactions, activeMonth);
  renderRecentTransactions(transactions);
}
