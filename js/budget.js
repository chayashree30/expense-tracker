/**
 * Budget Management View Module (Feature 5)
 * ---------------------------------------------------------------------------
 * Handles monthly budget limit configuration, utilization calculation,
 * 80% warning notifications, exceeded alerts, and monthly expense breakdown.
 */

import {
  buildTransactionsTableHtml,
  calculateBudgetMetrics,
  escapeHtml,
  filterAndSortTransactions,
  formatCurrency,
  formatMonthLabel,
} from './transactions.js';

/**
 * Validates the monthly budget limit input.
 * @param {string|number} rawValue
 * @returns {{ valid: boolean, error: string, value: number }}
 */
export function validateBudgetLimit(rawValue) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter a monthly budget amount.', value: 0 };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { valid: false, error: 'Monthly budget must be greater than $0.00.', value: 0 };
  }
  if (numeric > 100000000) {
    return { valid: false, error: 'Monthly budget exceeds allowed maximum.', value: 0 };
  }
  return { valid: true, error: '', value: Math.round(numeric * 100) / 100 };
}

/**
 * Updates the compact Monthly Budget widget inside the sidebar.
 * @param {Array<object>} transactions
 * @param {{ monthlyLimit: number }} budget
 * @param {string} activeMonth
 */
export function updateSidebarBudgetWidget(transactions, budget, activeMonth) {
  const metrics = calculateBudgetMetrics(transactions, budget, activeMonth);
  const pctEl = document.getElementById('sidebar-budget-pct');
  const barEl = document.getElementById('sidebar-budget-bar');
  const subEl = document.getElementById('sidebar-budget-sub');

  if (pctEl) {
    pctEl.textContent = metrics.limit > 0 ? `${metrics.utilizationPct.toFixed(0)}%` : 'Unset';
  }
  if (barEl) {
    barEl.style.width = `${metrics.clampedPct}%`;
    barEl.classList.remove('is-warning', 'is-exceeded');
    if (metrics.status === 'warning') barEl.classList.add('is-warning');
    if (metrics.status === 'exceeded') barEl.classList.add('is-exceeded');
  }
  if (subEl) {
    subEl.textContent =
      metrics.limit > 0
        ? `${formatCurrency(metrics.spent)} of ${formatCurrency(metrics.limit)}`
        : `${formatCurrency(metrics.spent)} spent · Set limit`;
  }
}

/**
 * Renders the Budget Management view.
 * @param {object} state
 */
export function renderBudgetView({ transactions, budget, activeMonth }) {
  const metrics = calculateBudgetMetrics(transactions, budget, activeMonth);
  const monthLabel = formatMonthLabel(activeMonth);

  const input = document.getElementById('budget-limit-input');
  if (input && document.activeElement !== input) {
    input.value = metrics.limit > 0 ? String(metrics.limit) : '';
  }

  const monthLabelEl = document.getElementById('budget-month-label');
  if (monthLabelEl) {
    monthLabelEl.textContent = `Tracking expenses for ${monthLabel}`;
  }

  const statusTextEl = document.getElementById('budget-status-text');
  if (statusTextEl) {
    statusTextEl.className = `status-text is-${metrics.status}`;
    if (metrics.status === 'exceeded') {
      statusTextEl.innerHTML = '<i data-lucide="alert-octagon"></i><span>Budget Exceeded</span>';
    } else if (metrics.status === 'warning') {
      statusTextEl.innerHTML = '<i data-lucide="alert-triangle"></i><span>Warning (80%+)</span>';
    } else if (metrics.status === 'nominal') {
      statusTextEl.innerHTML = '<i data-lucide="check-circle-2"></i><span>On Track</span>';
    } else {
      statusTextEl.innerHTML = '<i data-lucide="minus-circle"></i><span>No Budget Set</span>';
    }
  }

  // Render Top Status Banner (80% warning or >=100% exceeded alert)
  const bannerSlot = document.getElementById('budget-status-banner-slot');
  if (bannerSlot) {
    if (metrics.status === 'exceeded') {
      bannerSlot.innerHTML = `
        <div class="alert-banner is-exceeded" role="alert">
          <div class="alert-banner-body">
            <i data-lucide="alert-octagon"></i>
            <div>
              <span class="alert-banner-title">Alert: Monthly Budget Exceeded</span>
              <span class="tabular-nums">
                Your ${escapeHtml(monthLabel)} expenses (${escapeHtml(
        formatCurrency(metrics.spent)
      )}) have exceeded your ${escapeHtml(formatCurrency(metrics.limit))} budget by
                <strong>${escapeHtml(formatCurrency(metrics.overAmount))}</strong>.
              </span>
            </div>
          </div>
        </div>
      `;
    } else if (metrics.status === 'warning') {
      bannerSlot.innerHTML = `
        <div class="alert-banner is-warning" role="status">
          <div class="alert-banner-body">
            <i data-lucide="alert-triangle"></i>
            <div>
              <span class="alert-banner-title">Warning: 80% Budget Threshold Reached</span>
              <span class="tabular-nums">
                You have spent ${metrics.utilizationPct.toFixed(1)}% of your ${escapeHtml(
        monthLabel
      )} budget. Remaining allowance: <strong>${escapeHtml(
        formatCurrency(metrics.remaining)
      )}</strong>.
              </span>
            </div>
          </div>
        </div>
      `;
    } else if (metrics.status === 'nominal') {
      bannerSlot.innerHTML = `
        <div class="alert-banner is-nominal" role="status">
          <div class="alert-banner-body">
            <i data-lucide="check-circle-2"></i>
            <div>
              <span class="alert-banner-title">Budget On Track</span>
              <span class="tabular-nums">
                ${metrics.utilizationPct.toFixed(1)}% utilized for ${escapeHtml(
        monthLabel
      )}, with ${escapeHtml(formatCurrency(metrics.remaining))} remaining.
              </span>
            </div>
          </div>
        </div>
      `;
    } else {
      bannerSlot.innerHTML = '';
    }
  }

  // Render Utilization Metrics Card Content
  const metricsContent = document.getElementById('budget-metrics-content');
  if (metricsContent) {
    if (metrics.limit <= 0) {
      metricsContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="target"></i></div>
          <h3 class="empty-state-title">No monthly budget configured</h3>
          <p class="empty-state-desc">
            Enter a monthly limit on the left to track utilization and receive 80% and over-budget alerts.
          </p>
        </div>
      `;
    } else {
      const remainingClass = metrics.remaining < 0 ? 'is-exceeded' : 'is-nominal';
      const remainingLabel = metrics.remaining < 0 ? 'Over Budget' : 'Remaining Budget';
      const remainingDisplay =
        metrics.remaining < 0
          ? `-${formatCurrency(Math.abs(metrics.remaining))}`
          : formatCurrency(metrics.remaining);
      const fillClass =
        metrics.status === 'exceeded'
          ? 'is-exceeded'
          : metrics.status === 'warning'
          ? 'is-warning'
          : '';

      metricsContent.innerHTML = `
        <div class="budget-metrics-wrap">
          <div class="budget-figures-row">
            <div class="budget-figure-item">
              <span class="budget-figure-label">Monthly Budget</span>
              <span class="budget-figure-value tabular-nums">${escapeHtml(
                formatCurrency(metrics.limit)
              )}</span>
            </div>
            <div class="budget-figure-item">
              <span class="budget-figure-label">Monthly Expenses</span>
              <span class="budget-figure-value tabular-nums">${escapeHtml(
                formatCurrency(metrics.spent)
              )}</span>
            </div>
            <div class="budget-figure-item">
              <span class="budget-figure-label">${remainingLabel}</span>
              <span class="budget-figure-value tabular-nums ${remainingClass}">${escapeHtml(
        remainingDisplay
      )}</span>
            </div>
          </div>

          <div class="progress-section">
            <div class="progress-header">
              <span class="progress-label">Budget Utilization</span>
              <span class="progress-pct-value tabular-nums">${metrics.utilizationPct.toFixed(
                1
              )}%</span>
            </div>
            <div
              class="progress-track"
              role="progressbar"
              aria-valuenow="${Math.round(metrics.utilizationPct)}"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Monthly budget utilization"
            >
              <div class="progress-fill ${fillClass}" style="width: ${metrics.clampedPct}%"></div>
            </div>
            <div class="progress-scale tabular-nums">
              <span>0%</span>
              <span>80% Warning</span>
              <span>100% Limit</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Render Monthly Expense Contributors Table
  const contributorsSub = document.getElementById('budget-contributors-subtitle');
  if (contributorsSub) {
    contributorsSub.textContent = `Expense transactions recorded in ${monthLabel}`;
  }

  const contributorsTable = document.getElementById('budget-contributors-table');
  if (contributorsTable) {
    const monthlyExpenses = filterAndSortTransactions(
      transactions.filter(
        (tx) => tx.type === 'expense' && tx.date && tx.date.slice(0, 7) === activeMonth
      ),
      { sortBy: 'date-desc' }
    );

    contributorsTable.innerHTML = buildTransactionsTableHtml(monthlyExpenses, {
      showActions: true,
      emptyTitle: `No expenses in ${monthLabel}`,
      emptyDescription: 'Any expenses dated in this month will automatically count toward your budget.',
    });
  }
}
