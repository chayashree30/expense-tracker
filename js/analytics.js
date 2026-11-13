/**
 * Expense Analytics View Module (Feature 4)
 * ---------------------------------------------------------------------------
 * Computes and renders total savings, highest spending category, monthly
 * income vs. expenses, category-wise expense breakdown, spending distribution,
 * and dynamic Chart.js visualizations.
 */

import {
  calculateCategoryBreakdown,
  calculateMonthlySeries,
  calculateSummaryTotals,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
} from './transactions.js';

let cashflowChartInstance = null;
let categoryPieChartInstance = null;
let distributionChartInstance = null;

/**
 * Renders the 4 analytics summary KPI cards.
 * @param {Array<object>} transactions
 * @param {string} activeMonth
 */
function renderAnalyticsKpis(transactions, activeMonth) {
  const grid = document.getElementById('analytics-kpi-grid');
  if (!grid) return;

  const totals = calculateSummaryTotals(transactions, activeMonth);
  const expenseBreakdown = calculateCategoryBreakdown(transactions, 'expense');
  const incomeBreakdown = calculateCategoryBreakdown(transactions, 'income');

  const topExpense = expenseBreakdown[0] || null;
  const topIncome = incomeBreakdown[0] || null;

  // Compute average monthly spend across months that have at least one expense
  const expenseMonths = new Set(
    transactions
      .filter((tx) => tx.type === 'expense' && tx.date)
      .map((tx) => tx.date.slice(0, 7))
  );
  const avgMonthlyExpense =
    expenseMonths.size > 0 ? totals.totalExpenses / expenseMonths.size : 0;

  const savingsClass = totals.totalBalance >= 0 ? 'is-income' : 'is-expense';

  grid.innerHTML = `
    <article class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Total Savings</span>
        <span class="kpi-icon-box is-income"><i data-lucide="piggy-bank"></i></span>
      </div>
      <div class="kpi-value tabular-nums ${savingsClass}">
        ${escapeHtml(formatCurrency(totals.totalBalance))}
      </div>
      <div class="kpi-meta tabular-nums">
        Savings rate: ${totals.savingsRate.toFixed(1)}% of total income
      </div>
    </article>

    <article class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Highest Spending Category</span>
        <span class="kpi-icon-box is-expense"><i data-lucide="trending-up"></i></span>
      </div>
      <div class="kpi-value">
        ${topExpense ? escapeHtml(topExpense.category) : 'None'}
      </div>
      <div class="kpi-meta tabular-nums">
        ${
          topExpense
            ? `${escapeHtml(formatCurrency(topExpense.total))} (${topExpense.percentage.toFixed(
                1
              )}% of expenses)`
            : 'No expense records yet'
        }
      </div>
    </article>

    <article class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Avg. Monthly Expense</span>
        <span class="kpi-icon-box"><i data-lucide="bar-chart-3"></i></span>
      </div>
      <div class="kpi-value tabular-nums">
        ${escapeHtml(formatCurrency(avgMonthlyExpense))}
      </div>
      <div class="kpi-meta tabular-nums">
        Across ${expenseMonths.size} active month${expenseMonths.size === 1 ? '' : 's'}
      </div>
    </article>

    <article class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Primary Income Source</span>
        <span class="kpi-icon-box is-accent"><i data-lucide="briefcase"></i></span>
      </div>
      <div class="kpi-value">
        ${topIncome ? escapeHtml(topIncome.category) : 'None'}
      </div>
      <div class="kpi-meta tabular-nums">
        ${
          topIncome
            ? `${escapeHtml(formatCurrency(topIncome.total))} (${topIncome.percentage.toFixed(
                1
              )}% of income)`
            : 'No income records yet'
        }
      </div>
    </article>
  `;
}

/**
 * Renders Monthly Income vs. Expenses grouped bar chart.
 * @param {Array<object>} transactions
 * @param {string} activeMonth
 */
function renderCashflowChart(transactions, activeMonth) {
  const canvas = document.getElementById('analytics-cashflow-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (cashflowChartInstance) {
    cashflowChartInstance.destroy();
    cashflowChartInstance = null;
  }

  const series = calculateMonthlySeries(transactions, 6, activeMonth);

  cashflowChartInstance = new window.Chart(canvas.getContext('2d'), {
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
            useBorderRadius: 3,
            color: '#475569',
            font: { size: 12, weight: '500' },
          },
        },
        tooltip: {
          callbacks: {
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return '';
              const net = series.netData[idx];
              return `Net Savings: ${formatCurrency(net)}`;
            },
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
            callback: (v) => `$${v}`,
          },
        },
      },
    },
  });
}

/**
 * Renders Category-Wise Expense Breakdown doughnut chart.
 * @param {Array<object>} breakdown
 */
function renderCategoryPieChart(breakdown) {
  const canvas = document.getElementById('analytics-category-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (categoryPieChartInstance) {
    categoryPieChartInstance.destroy();
    categoryPieChartInstance = null;
  }

  const wrap = canvas.parentElement;
  const existingEmpty = wrap?.querySelector('.chart-empty');
  if (existingEmpty) existingEmpty.remove();

  if (!breakdown.length) {
    canvas.hidden = true;
    const empty = document.createElement('div');
    empty.className = 'chart-empty';
    empty.innerHTML = '<i data-lucide="pie-chart"></i><span>No expense data available</span>';
    wrap?.appendChild(empty);
    return;
  }

  canvas.hidden = false;
  categoryPieChartInstance = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((b) => b.color),
          borderColor: '#FFFFFF',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            useBorderRadius: 3,
            color: '#334155',
            font: { size: 12 },
          },
        },
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

/**
 * Renders Spending Distribution horizontal bar chart.
 * @param {Array<object>} breakdown
 */
function renderDistributionChart(breakdown) {
  const canvas = document.getElementById('analytics-distribution-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (distributionChartInstance) {
    distributionChartInstance.destroy();
    distributionChartInstance = null;
  }

  const wrap = canvas.parentElement;
  const existingEmpty = wrap?.querySelector('.chart-empty');
  if (existingEmpty) existingEmpty.remove();

  if (!breakdown.length) {
    canvas.hidden = true;
    const empty = document.createElement('div');
    empty.className = 'chart-empty';
    empty.innerHTML = '<i data-lucide="bar-chart-2"></i><span>No spending distribution yet</span>';
    wrap?.appendChild(empty);
    return;
  }

  canvas.hidden = false;
  distributionChartInstance = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          label: 'Total Spent',
          data: breakdown.map((b) => b.total),
          backgroundColor: breakdown.map((b) => b.color),
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = breakdown[ctx.dataIndex];
              return `${formatCurrency(item.total)} (${item.percentage.toFixed(1)}% share)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#F1F5F9' },
          ticks: {
            color: '#64748B',
            font: { size: 11 },
            callback: (v) => `$${v}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#334155', font: { size: 12, weight: '500' } },
        },
      },
    },
  });
}

/**
 * Renders the Category Breakdown Details table.
 * @param {Array<object>} breakdown
 */
function renderCategoryTable(breakdown) {
  const container = document.getElementById('analytics-category-table');
  if (!container) return;

  if (!breakdown.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="pie-chart"></i></div>
        <h3 class="empty-state-title">No expense analytics yet</h3>
        <p class="empty-state-desc">
          Record expense transactions to view category-wise breakdowns and spending shares.
        </p>
      </div>
    `;
    return;
  }

  const rows = breakdown
    .map(
      (item) => `
      <tr>
        <td>
          <div class="legend-left">
            <span class="legend-swatch" style="background-color: ${item.color}"></span>
            <span class="tx-title">${escapeHtml(item.category)}</span>
          </div>
        </td>
        <td class="td-right tabular-nums">${item.count}</td>
        <td class="td-right tabular-nums">${escapeHtml(formatCurrency(item.average))}</td>
        <td class="td-right tabular-nums">${item.percentage.toFixed(1)}%</td>
        <td class="td-right tx-amount tabular-nums">${escapeHtml(formatCurrency(item.total))}</td>
      </tr>
    `
    )
    .join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th class="th-right">Transactions</th>
            <th class="th-right">Avg. Spend</th>
            <th class="th-right">Share</th>
            <th class="th-right">Total Spent</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Renders the complete Expense Analytics view.
 * @param {object} state
 */
export function renderAnalyticsView({ transactions, activeMonth }) {
  const breakdown = calculateCategoryBreakdown(transactions, 'expense');
  renderAnalyticsKpis(transactions, activeMonth);
  renderCashflowChart(transactions, activeMonth);
  renderCategoryPieChart(breakdown);
  renderDistributionChart(breakdown);
  renderCategoryTable(breakdown);
}
