// ==================== 데이터 저장/불러오기 ====================

function loadData(key, fallback) {
    try {
        const d = localStorage.getItem(key);
        return d ? JSON.parse(d) : fallback;
    } catch { return fallback; }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ==================== 상태 ====================

let deposits = loadData('deposits', []);
let budgetItems = loadData('budgetItems', []);
let fixedExpenses = loadData('fixedExpenses', []);
let stocks = loadData('stocks', []);
let cryptos = loadData('cryptos', []);
let exchangeRate = loadData('exchangeRate', 1350);

// 기존 데이터 마이그레이션
stocks.forEach(s => {
    if (!s.country) s.country = 'KR';
    if (!s.ticker) s.ticker = '';
});
saveData('stocks', stocks);

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed

// ==================== 유틸 ====================

function fmt(n) {
    return Math.round(n).toLocaleString('ko-KR');
}

function fmtDecimal(n, digits = 2) {
    return n.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtUsd(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getExchangeRate() {
    return exchangeRate;
}

function stockValueKrw(s) {
    const val = s.qty * s.curPrice;
    return s.country === 'US' ? val * getExchangeRate() : val;
}

function stockInvestKrw(s) {
    const val = s.qty * s.avgPrice;
    return s.country === 'US' ? val * getExchangeRate() : val;
}

function pctClass(v) {
    return v >= 0 ? 'positive' : 'negative';
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ==================== 네비게이션 ====================

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');

function switchPage(pageName) {
    navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageName));
    pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + pageName));
    closeMobile();
    if (pageName === 'dashboard') refreshDashboard();
    if (pageName === 'budget') refreshBudget();
    if (pageName === 'stocks') refreshStocks();
    if (pageName === 'crypto') refreshCrypto();
}

navItems.forEach(item => {
    item.addEventListener('click', () => switchPage(item.dataset.page));
});

function closeMobile() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
}

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
});

overlay.addEventListener('click', closeMobile);

// ==================== 자산 현황 (대시보드) ====================

const depositTableBody = document.getElementById('depositTableBody');

document.getElementById('addDepositBtn').addEventListener('click', () => {
    const name = document.getElementById('depositName').value.trim();
    const amount = parseFloat(document.getElementById('depositAmount').value);
    if (!name || isNaN(amount)) return alert('계좌명과 금액을 입력하세요.');
    deposits.push({ id: uid(), name, amount });
    saveData('deposits', deposits);
    document.getElementById('depositName').value = '';
    document.getElementById('depositAmount').value = '';
    refreshDashboard();
});

function deleteDeposit(id) {
    deposits = deposits.filter(d => d.id !== id);
    saveData('deposits', deposits);
    refreshDashboard();
}

function refreshDashboard() {
    // 예금
    depositTableBody.innerHTML = deposits.map(d => `
        <tr>
            <td>${d.name}</td>
            <td>${fmt(d.amount)}원</td>
            <td><button class="btn btn-del" onclick="deleteDeposit('${d.id}')">삭제</button></td>
        </tr>
    `).join('');

    const cashTotal = deposits.reduce((s, d) => s + d.amount, 0);
    const stockTotal = stocks.reduce((s, st) => s + stockValueKrw(st), 0);
    const cryptoTotal = cryptos.reduce((s, c) => s + c.qty * c.curPrice, 0);
    const total = cashTotal + stockTotal + cryptoTotal;

    document.getElementById('totalCash').textContent = fmt(cashTotal) + '원';
    document.getElementById('totalStock').textContent = fmt(stockTotal) + '원';
    document.getElementById('totalCrypto').textContent = fmt(cryptoTotal) + '원';

    // 이번달 수입/지출
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const thisMonthItems = budgetItems.filter(b => {
        const d = new Date(b.date);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    });
    const dashIncome = thisMonthItems.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0);
    const dashExpense = thisMonthItems.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
    const dashFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);
    document.getElementById('dashMonthIncome').textContent = fmt(dashIncome) + '원';
    document.getElementById('dashMonthExpense').textContent = fmt(dashExpense + dashFixed) + '원';

    // 파이 차트
    renderPieChart(cashTotal, stockTotal, cryptoTotal);

    // 월별 상세 내역
    refreshDashMonthDetail();

    // 연간 종합 현황
    refreshAnnualOverview();
}

function renderPieChart(cash, stock, crypto) {
    const svg = document.getElementById('pieChart');
    const legend = document.getElementById('pieLegend');
    const tooltip = document.getElementById('donutTooltip');
    const total = cash + stock + crypto;
    const strokeW = 14;
    const cx = 100, cy = 100, r = 85;

    // 중앙 총자산
    document.getElementById('totalAsset').textContent = fmt(total) + '원';

    const items = [
        { label: '예금/현금', value: cash, color: '#6366F1' },
        { label: '주식', value: stock, color: '#EF4444' },
        { label: '코인', value: crypto, color: '#FACC15' },
    ];

    if (total === 0) {
        svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#334155" stroke-width="${strokeW}"/>`;
        legend.innerHTML = items.map(item => `
            <div class="pie-legend-item">
                <div class="pie-legend-dot" style="background:${item.color}"></div>
                <span class="pie-legend-label">${item.label}</span>
                <span class="pie-legend-value">0원</span>
                <span class="pie-legend-pct">(0%)</span>
            </div>
        `).join('');
        return;
    }

    let paths = '';
    let cumAngle = -90;
    const segments = [];

    items.forEach(item => {
        if (item.value === 0) return;
        const pct = item.value / total;
        const angle = pct * 360;
        const startAngle = cumAngle;

        if (pct >= 0.9999) {
            paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${item.color}" stroke-width="${strokeW}" class="donut-seg" data-idx="${segments.length}"/>`;
        } else {
            const startRad = (cumAngle * Math.PI) / 180;
            const endRad = ((cumAngle + angle) * Math.PI) / 180;
            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);
            const largeArc = angle > 180 ? 1 : 0;
            paths += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}" fill="none" stroke="${item.color}" stroke-width="${strokeW}" stroke-linecap="butt" class="donut-seg" data-idx="${segments.length}"/>`;
        }

        segments.push({ ...item, pct, startAngle, angle });
        cumAngle += angle;
    });

    // 투명 히트 영역 (더 두꺼운 stroke)
    cumAngle = -90;
    items.forEach(item => {
        if (item.value === 0) return;
        const pct = item.value / total;
        const angle = pct * 360;
        const idx = segments.findIndex(s => s.label === item.label);

        if (pct >= 0.9999) {
            paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="transparent" stroke-width="30" class="donut-hit" data-idx="${idx}"/>`;
        } else {
            const startRad = (cumAngle * Math.PI) / 180;
            const endRad = ((cumAngle + angle) * Math.PI) / 180;
            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);
            const largeArc = angle > 180 ? 1 : 0;
            paths += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}" fill="none" stroke="transparent" stroke-width="30" class="donut-hit" data-idx="${idx}"/>`;
        }
        cumAngle += angle;
    });

    svg.innerHTML = paths;

    // 툴팁 이벤트
    const container = document.querySelector('.donut-container');
    svg.querySelectorAll('.donut-hit').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('mouseenter', (e) => {
            const seg = segments[el.dataset.idx];
            if (!seg) return;
            tooltip.innerHTML = `
                <span class="donut-tooltip-color" style="background:${seg.color}"></span>
                <span class="donut-tooltip-label">${seg.label}</span>
                <span class="donut-tooltip-pct">(${(seg.pct * 100).toFixed(1)}%)</span>
                <span class="donut-tooltip-amount">${fmt(seg.value)}원</span>
            `;
            tooltip.classList.add('show');
            // highlight segment
            svg.querySelectorAll('.donut-seg').forEach(s => s.style.opacity = s.dataset.idx === el.dataset.idx ? '1' : '0.3');
        });
        el.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
            tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
        });
        el.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
            svg.querySelectorAll('.donut-seg').forEach(s => s.style.opacity = '1');
        });
    });

    legend.innerHTML = items.map(item => {
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
        return `
            <div class="pie-legend-item">
                <div class="pie-legend-dot" style="background:${item.color}"></div>
                <span class="pie-legend-label">${item.label}</span>
                <span class="pie-legend-value">${fmt(item.value)}원</span>
                <span class="pie-legend-pct">(${pct}%)</span>
            </div>
        `;
    }).join('');
}

// ==================== 대시보드 월별 상세 ====================

let dashViewYear = today.getFullYear();
let dashViewMonth = today.getMonth();

document.getElementById('dashPrevMonth').addEventListener('click', () => {
    dashViewMonth--;
    if (dashViewMonth < 0) { dashViewMonth = 11; dashViewYear--; }
    refreshDashMonthDetail();
});

document.getElementById('dashNextMonth').addEventListener('click', () => {
    dashViewMonth++;
    if (dashViewMonth > 11) { dashViewMonth = 0; dashViewYear++; }
    refreshDashMonthDetail();
});

function refreshDashMonthDetail() {
    document.getElementById('dashCurrentMonth').textContent =
        `${dashViewYear}년 ${dashViewMonth + 1}월`;

    const monthItems = budgetItems.filter(b => {
        const d = new Date(b.date);
        return d.getFullYear() === dashViewYear && d.getMonth() === dashViewMonth;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const incomeItems = monthItems.filter(b => b.type === 'income');
    const expenseItems = monthItems.filter(b => b.type === 'expense');
    const incomeTotal = incomeItems.reduce((s, b) => s + b.amount, 0);
    const expenseTotal = expenseItems.reduce((s, b) => s + b.amount, 0);
    const fixedTotal = fixedExpenses.reduce((s, f) => s + f.amount, 0);
    const netTotal = incomeTotal - expenseTotal - fixedTotal;

    // 요약 바
    document.getElementById('dashMonthSummary').innerHTML = `
        <div class="dash-summary-item">
            <span class="label">수입</span>
            <span class="value positive">+${fmt(incomeTotal)}원</span>
        </div>
        <div class="dash-summary-item">
            <span class="label">지출 (고정 포함)</span>
            <span class="value negative">-${fmt(expenseTotal + fixedTotal)}원</span>
        </div>
        <div class="dash-summary-item">
            <span class="label">순수익</span>
            <span class="value ${netTotal >= 0 ? 'positive' : 'negative'}">${netTotal >= 0 ? '+' : ''}${fmt(netTotal)}원</span>
        </div>
    `;

    // 수입 리스트
    const incomeList = document.getElementById('dashIncomeList');
    if (!incomeItems.length) {
        incomeList.innerHTML = '<div class="detail-empty">수입 내역이 없습니다.</div>';
    } else {
        incomeList.innerHTML = incomeItems.map(b => `
            <div class="detail-item">
                <div class="detail-item-left">
                    <span class="detail-cat income">${b.category}</span>
                    <span class="detail-desc">${b.desc || '-'}</span>
                    <span class="detail-date">${b.date.slice(5)}</span>
                </div>
                <span class="detail-amount positive">+${fmt(b.amount)}원</span>
            </div>
        `).join('');
    }

    // 지출 리스트 (고정지출 + 일반지출)
    const expenseList = document.getElementById('dashExpenseList');
    let expenseHtml = '';

    // 고정지출 먼저
    if (fixedExpenses.length) {
        expenseHtml += fixedExpenses.map(f => `
            <div class="detail-item">
                <div class="detail-item-left">
                    <span class="detail-cat fixed">고정</span>
                    <span class="detail-desc">${f.name}</span>
                    <span class="detail-date">매월 ${f.day}일</span>
                </div>
                <span class="detail-amount" style="color:var(--orange);">-${fmt(f.amount)}원</span>
            </div>
        `).join('');
    }

    // 일반 지출
    if (expenseItems.length) {
        expenseHtml += expenseItems.map(b => `
            <div class="detail-item">
                <div class="detail-item-left">
                    <span class="detail-cat expense">${b.category}</span>
                    <span class="detail-desc">${b.desc || '-'}</span>
                    <span class="detail-date">${b.date.slice(5)}</span>
                </div>
                <span class="detail-amount negative">-${fmt(b.amount)}원</span>
            </div>
        `).join('');
    }

    if (!expenseHtml) {
        expenseHtml = '<div class="detail-empty">지출 내역이 없습니다.</div>';
    }
    expenseList.innerHTML = expenseHtml;
}

// ==================== 연간 종합 현황 ====================

let annualYear = today.getFullYear();
let annualExpandedMonth = null;

document.getElementById('yearPrev').addEventListener('click', () => {
    annualYear--;
    annualExpandedMonth = null;
    refreshAnnualOverview();
});

document.getElementById('yearNext').addEventListener('click', () => {
    annualYear++;
    annualExpandedMonth = null;
    refreshAnnualOverview();
});

function getMonthData(year) {
    const fixedTotal = fixedExpenses.reduce((s, f) => s + f.amount, 0);
    const data = [];
    for (let m = 0; m < 12; m++) {
        const items = budgetItems.filter(b => {
            const d = new Date(b.date);
            return d.getFullYear() === year && d.getMonth() === m;
        });
        const income = items.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0);
        const expense = items.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0) + fixedTotal;
        const saving = income - expense;

        // 투자금액: 해당 월에 추가된 주식/코인 매입금 (budgetItems 기반이 아니므로 0으로 처리하되,
        // 주식/코인 총 투자금은 현재 스냅샷으로 표시)
        data.push({ month: m, income, expense, saving, items });
    }
    return data;
}

function refreshAnnualOverview() {
    document.getElementById('yearLabel').textContent = `${annualYear}년`;

    const monthData = getMonthData(annualYear);
    const stockInvest = stocks.reduce((s, st) => s + stockInvestKrw(st), 0);
    const cryptoInvest = cryptos.reduce((s, c) => s + c.qty * c.avgPrice, 0);
    const totalInvest = stockInvest + cryptoInvest;
    const currentAsset = deposits.reduce((s, d) => s + d.amount, 0)
        + stocks.reduce((s, st) => s + stockValueKrw(st), 0)
        + cryptos.reduce((s, c) => s + c.qty * c.curPrice, 0);

    const yearIncome = monthData.reduce((s, d) => s + d.income, 0);
    const yearExpense = monthData.reduce((s, d) => s + d.expense, 0);
    const yearSaving = yearIncome - yearExpense;

    // 연간 합계
    document.getElementById('annualTotals').innerHTML = `
        <div class="annual-total-item">
            <span class="label">총 수입</span>
            <span class="value positive">+${fmt(yearIncome)}원</span>
        </div>
        <div class="annual-total-item">
            <span class="label">총 지출</span>
            <span class="value negative">-${fmt(yearExpense)}원</span>
        </div>
        <div class="annual-total-item">
            <span class="label">총 저축</span>
            <span class="value ${yearSaving >= 0 ? 'positive' : 'negative'}">${yearSaving >= 0 ? '+' : ''}${fmt(yearSaving)}원</span>
        </div>
        <div class="annual-total-item">
            <span class="label">총 투자</span>
            <span class="value" style="color:var(--accent);">${fmt(totalInvest)}원</span>
        </div>
    `;

    // 막대 그래프
    const maxVal = Math.max(...monthData.map(d => Math.max(d.income, d.expense)), 1);

    document.getElementById('annualChart').innerHTML = monthData.map((d, i) => {
        const incH = Math.round((d.income / maxVal) * 150);
        const expH = Math.round((d.expense / maxVal) * 150);
        return `
            <div class="annual-bar-group" onclick="toggleAnnualDetail(${i})">
                <div class="annual-bars">
                    <div class="annual-bar income-bar" style="height:${Math.max(incH, 2)}px;" title="수입: ${fmt(d.income)}원"></div>
                    <div class="annual-bar expense-bar" style="height:${Math.max(expH, 2)}px;" title="지출: ${fmt(d.expense)}원"></div>
                </div>
                <span class="annual-bar-label">${i + 1}월</span>
            </div>
        `;
    }).join('');

    // 테이블
    let cumAsset = 0;
    const tableBody = document.getElementById('annualTableBody');
    tableBody.innerHTML = monthData.map((d, i) => {
        cumAsset += d.saving;
        const isActive = annualExpandedMonth === i;
        return `
            <tr class="${isActive ? 'active-row' : ''}" onclick="toggleAnnualDetail(${i})">
                <td style="text-align:center;">${i + 1}월</td>
                <td class="positive">${d.income ? '+' + fmt(d.income) + '원' : '-'}</td>
                <td class="negative">${d.expense ? '-' + fmt(d.expense) + '원' : '-'}</td>
                <td class="${d.saving >= 0 ? 'positive' : 'negative'}">${d.income || d.expense ? (d.saving >= 0 ? '+' : '') + fmt(d.saving) + '원' : '-'}</td>
                <td style="color:var(--accent);">${i === 0 ? fmt(totalInvest) + '원' : '-'}</td>
                <td>${d.income || d.expense ? fmt(cumAsset) + '원' : '-'}</td>
            </tr>
        `;
    }).join('');

    // tfoot 합계
    document.getElementById('annualTableFoot').innerHTML = `
        <tr style="font-weight:700;border-top:2px solid var(--border);">
            <td style="text-align:center;">합계</td>
            <td class="positive">+${fmt(yearIncome)}원</td>
            <td class="negative">-${fmt(yearExpense)}원</td>
            <td class="${yearSaving >= 0 ? 'positive' : 'negative'}">${yearSaving >= 0 ? '+' : ''}${fmt(yearSaving)}원</td>
            <td style="color:var(--accent);">${fmt(totalInvest)}원</td>
            <td>${fmt(currentAsset)}원</td>
        </tr>
    `;

    // 상세 펼침
    renderAnnualDetail(monthData);
}

function toggleAnnualDetail(month) {
    annualExpandedMonth = annualExpandedMonth === month ? null : month;
    refreshAnnualOverview();
}

function renderAnnualDetail(monthData) {
    const container = document.getElementById('annualDetail');
    if (annualExpandedMonth === null) {
        container.innerHTML = '';
        return;
    }

    const m = annualExpandedMonth;
    const d = monthData[m];
    const incomeItems = d.items.filter(b => b.type === 'income');
    const expenseItems = d.items.filter(b => b.type === 'expense');

    // 카테고리별 그룹
    const incomeByCategory = {};
    incomeItems.forEach(b => {
        incomeByCategory[b.category] = (incomeByCategory[b.category] || 0) + b.amount;
    });
    const expenseByCategory = {};
    expenseItems.forEach(b => {
        expenseByCategory[b.category] = (expenseByCategory[b.category] || 0) + b.amount;
    });
    // 고정지출도 표시
    fixedExpenses.forEach(f => {
        expenseByCategory[f.name + ' (고정)'] = (expenseByCategory[f.name + ' (고정)'] || 0) + f.amount;
    });

    const incomeHtml = Object.keys(incomeByCategory).length
        ? Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) =>
            `<div class="annual-detail-item"><span>${cat}</span><span class="positive">+${fmt(amt)}원</span></div>`
        ).join('')
        : '<div class="annual-detail-item"><span style="color:var(--text-muted);">내역 없음</span><span></span></div>';

    const expenseHtml = Object.keys(expenseByCategory).length
        ? Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) =>
            `<div class="annual-detail-item"><span>${cat}</span><span class="negative">-${fmt(amt)}원</span></div>`
        ).join('')
        : '<div class="annual-detail-item"><span style="color:var(--text-muted);">내역 없음</span><span></span></div>';

    container.innerHTML = `
        <div class="annual-detail-box">
            <div class="annual-detail-title">${annualYear}년 ${m + 1}월 상세</div>
            <div class="annual-detail-cols">
                <div class="annual-detail-col">
                    <h5 class="positive">수입 항목</h5>
                    ${incomeHtml}
                </div>
                <div class="annual-detail-col">
                    <h5 class="negative">지출 항목</h5>
                    ${expenseHtml}
                </div>
            </div>
        </div>
    `;
}

// ==================== 가계부 ====================

const calendarGrid = document.getElementById('calendarGrid');
const budgetModal = document.getElementById('budgetModal');

function updateMonthLabel() {
    document.getElementById('currentMonth').textContent = `${viewYear}년 ${viewMonth + 1}월`;
}

document.getElementById('prevMonth').addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    refreshBudget();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    refreshBudget();
});

// 가계부 모달 열기/닫기
function openBudgetModal(dateStr) {
    document.getElementById('budgetModalDate').value = dateStr;
    const d = new Date(dateStr);
    document.getElementById('budgetModalTitle').textContent =
        `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    document.getElementById('budgetType').value = 'expense';
    document.getElementById('budgetCategory').value = '';
    document.getElementById('budgetDesc').value = '';
    document.getElementById('budgetAmount').value = '';
    renderDayList(dateStr);
    budgetModal.classList.add('show');
    // focus on amount after a tick
    setTimeout(() => document.getElementById('budgetAmount').focus(), 100);
}

function closeBudgetModal() {
    budgetModal.classList.remove('show');
}

document.getElementById('budgetModalClose').addEventListener('click', closeBudgetModal);
document.getElementById('budgetModalCancel').addEventListener('click', closeBudgetModal);
budgetModal.addEventListener('click', (e) => {
    if (e.target === budgetModal) closeBudgetModal();
});

function renderDayList(dateStr) {
    const dayItems = budgetItems.filter(b => b.date === dateStr)
        .sort((a, b) => a.type.localeCompare(b.type));
    const container = document.getElementById('budgetDayList');

    // 해당 날짜의 고정지출 찾기
    const d = new Date(dateStr);
    const dayOfMonth = d.getDate();
    const daysInThisMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dayFixedItems = fixedExpenses.filter(f => {
        const effectiveDay = Math.min(f.day, daysInThisMonth);
        return effectiveDay === dayOfMonth;
    });

    if (!dayItems.length && !dayFixedItems.length) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">내역이 없습니다.</p>';
        return;
    }

    let html = '';

    // 고정지출 먼저
    html += dayFixedItems.map(f => `
        <div class="budget-day-item">
            <div class="budget-day-info">
                <span class="budget-day-cat fixed-tag">고정</span>
                <span class="budget-day-desc">${f.name}</span>
            </div>
            <span class="budget-day-amount" style="color:var(--orange);">
                -${fmt(f.amount)}원
            </span>
        </div>
    `).join('');

    // 일반 내역
    html += dayItems.map(b => `
        <div class="budget-day-item">
            <div class="budget-day-info">
                <span class="budget-day-cat">${b.category}</span>
                <span class="budget-day-desc">${b.desc || '-'}</span>
            </div>
            <span class="budget-day-amount ${b.type === 'income' ? 'positive' : 'negative'}">
                ${b.type === 'income' ? '+' : '-'}${fmt(b.amount)}원
            </span>
            <button class="btn btn-del" onclick="deleteBudget('${b.id}')">삭제</button>
        </div>
    `).join('');

    container.innerHTML = html;
}

document.getElementById('addBudgetBtn').addEventListener('click', () => {
    const date = document.getElementById('budgetModalDate').value;
    const type = document.getElementById('budgetType').value;
    const category = document.getElementById('budgetCategory').value;
    const desc = document.getElementById('budgetDesc').value.trim();
    const amount = parseFloat(document.getElementById('budgetAmount').value);

    if (!date || !category || isNaN(amount)) return alert('분류와 금액을 입력하세요.');

    budgetItems.push({ id: uid(), type, date, category, desc, amount });
    saveData('budgetItems', budgetItems);
    document.getElementById('budgetDesc').value = '';
    document.getElementById('budgetAmount').value = '';
    document.getElementById('budgetCategory').value = '';

    // 모달 내역 갱신 + 달력 갱신
    renderDayList(date);
    refreshBudget();
});

function deleteBudget(id) {
    const item = budgetItems.find(b => b.id === id);
    const dateStr = item ? item.date : null;
    budgetItems = budgetItems.filter(b => b.id !== id);
    saveData('budgetItems', budgetItems);
    if (dateStr && budgetModal.classList.contains('show')) {
        renderDayList(dateStr);
    }
    refreshBudget();
}

function refreshBudget() {
    updateMonthLabel();

    const monthItems = budgetItems.filter(b => {
        const d = new Date(b.date);
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });

    const income = monthItems.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0);
    const expense = monthItems.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0);
    const fixedTotal = fixedExpenses.reduce((s, f) => s + f.amount, 0);

    document.getElementById('monthIncome').textContent = fmt(income) + '원';
    document.getElementById('monthExpense').textContent = fmt(expense + fixedTotal) + '원';
    document.getElementById('monthFixed').textContent = fmt(fixedTotal) + '원';

    const net = income - expense - fixedTotal;
    const netEl = document.getElementById('monthNet');
    netEl.textContent = (net >= 0 ? '+' : '') + fmt(net) + '원';
    netEl.className = 'summary-value ' + (net >= 0 ? 'positive' : 'negative');

    // 날짜별 합산 맵
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const pad = n => String(n).padStart(2, '0');

    const dayMap = {}; // { "2024-04-05": { income: 0, expense: 0, fixed: 0 } }
    monthItems.forEach(b => {
        if (!dayMap[b.date]) dayMap[b.date] = { income: 0, expense: 0, fixed: 0 };
        dayMap[b.date][b.type] += b.amount;
    });

    // 고정지출을 dayMap에 반영
    fixedExpenses.forEach(f => {
        const effectiveDay = Math.min(f.day, daysInMonth);
        const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(effectiveDay)}`;
        if (!dayMap[dateStr]) dayMap[dateStr] = { income: 0, expense: 0, fixed: 0 };
        dayMap[dateStr].fixed += f.amount;
    });

    // 달력 렌더링
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const todayStr = today.toISOString().slice(0, 10);

    let html = '';

    // 빈 칸 (1일 이전)
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    // 날짜 칸
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
        const isToday = dateStr === todayStr;
        const data = dayMap[dateStr];

        html += `<div class="cal-day${isToday ? ' today' : ''}" onclick="openBudgetModal('${dateStr}')">`;
        html += `<span class="cal-date">${d}</span>`;
        if (data) {
            if (data.income > 0) html += `<span class="cal-income">+${fmt(data.income)}</span>`;
            if (data.fixed > 0) html += `<span class="cal-fixed">-${fmt(data.fixed)}</span>`;
            if (data.expense > 0) html += `<span class="cal-expense">-${fmt(data.expense)}</span>`;
        }
        html += '</div>';
    }

    calendarGrid.innerHTML = html;

    // 카테고리별 지출 (고정지출도 포함)
    const fixedAsExpenses = fixedExpenses.map(f => ({
        type: 'expense', category: f.name, amount: f.amount
    }));
    renderCategoryChart([...monthItems, ...fixedAsExpenses]);

    // 고정지출 테이블
    refreshFixedTable();

    // 연간 막대 차트
    refreshBudgetAnnualChart();
}

function renderCategoryChart(items) {
    const expenses = items.filter(b => b.type === 'expense');
    const catMap = {};
    expenses.forEach(b => {
        catMap[b.category] = (catMap[b.category] || 0) + b.amount;
    });

    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const max = cats.length ? cats[0][1] : 1;

    const colors = ['#6366F1', '#EF4444', '#3B82F6', '#FACC15', '#F97316', '#8B5CF6', '#EC4899', '#14B8A6'];

    const container = document.getElementById('categoryChart');
    if (!cats.length) {
        container.innerHTML = '<p style="color:var(--text-muted);">이번 달 지출 내역이 없습니다.</p>';
        return;
    }

    container.innerHTML = cats.map((c, i) => {
        const pct = (c[1] / max) * 100;
        const color = colors[i % colors.length];
        return `
            <div class="cat-row">
                <span class="cat-label">${c[0]}</span>
                <div class="cat-bar-wrap">
                    <div class="cat-bar" style="width:${pct}%; background:${color};">${Math.round(pct)}%</div>
                </div>
                <span class="cat-amount">${fmt(c[1])}원</span>
            </div>
        `;
    }).join('');
}

// ==================== 고정지출 ====================

const fixedTableBody = document.getElementById('fixedTableBody');
const fixedEditModal = document.getElementById('fixedEditModal');

document.getElementById('addFixedBtn').addEventListener('click', () => {
    const name = document.getElementById('fixedName').value.trim();
    const amount = parseFloat(document.getElementById('fixedAmount').value);
    const day = parseInt(document.getElementById('fixedDay').value);

    if (!name || isNaN(amount) || isNaN(day) || day < 1 || day > 31) {
        return alert('항목명, 금액, 날짜(1~31)를 입력하세요.');
    }

    fixedExpenses.push({ id: uid(), name, amount, day });
    saveData('fixedExpenses', fixedExpenses);
    document.getElementById('fixedName').value = '';
    document.getElementById('fixedAmount').value = '';
    document.getElementById('fixedDay').value = '';
    refreshBudget();
});

function deleteFixed(id) {
    fixedExpenses = fixedExpenses.filter(f => f.id !== id);
    saveData('fixedExpenses', fixedExpenses);
    refreshBudget();
}

function editFixed(id) {
    const item = fixedExpenses.find(f => f.id === id);
    if (!item) return;
    document.getElementById('fixedEditId').value = id;
    document.getElementById('fixedEditName').value = item.name;
    document.getElementById('fixedEditAmount').value = item.amount;
    document.getElementById('fixedEditDay').value = item.day;
    fixedEditModal.classList.add('show');
}

function closeFixedEditModal() {
    fixedEditModal.classList.remove('show');
}

document.getElementById('fixedEditModalClose').addEventListener('click', closeFixedEditModal);
document.getElementById('fixedEditCancel').addEventListener('click', closeFixedEditModal);
fixedEditModal.addEventListener('click', (e) => {
    if (e.target === fixedEditModal) closeFixedEditModal();
});

document.getElementById('fixedEditSave').addEventListener('click', () => {
    const id = document.getElementById('fixedEditId').value;
    const name = document.getElementById('fixedEditName').value.trim();
    const amount = parseFloat(document.getElementById('fixedEditAmount').value);
    const day = parseInt(document.getElementById('fixedEditDay').value);

    if (!name || isNaN(amount) || isNaN(day) || day < 1 || day > 31) {
        return alert('올바른 값을 입력하세요.');
    }

    const item = fixedExpenses.find(f => f.id === id);
    if (!item) return;
    item.name = name;
    item.amount = amount;
    item.day = day;
    saveData('fixedExpenses', fixedExpenses);
    closeFixedEditModal();
    refreshBudget();
});

function refreshFixedTable() {
    if (!fixedExpenses.length) {
        fixedTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">등록된 고정지출이 없습니다.</td></tr>';
        return;
    }
    fixedTableBody.innerHTML = fixedExpenses.map(f => `
        <tr>
            <td>${f.name}</td>
            <td style="color:var(--orange);">${fmt(f.amount)}원</td>
            <td>${f.day}일</td>
            <td><button class="btn btn-edit" onclick="editFixed('${f.id}')">수정</button></td>
            <td><button class="btn btn-del" onclick="deleteFixed('${f.id}')">삭제</button></td>
        </tr>
    `).join('');
}

// ==================== 가계부 연간 막대 차트 ====================

let budgetChartYear = today.getFullYear();
let budgetChartExpanded = null;

document.getElementById('budgetYearPrev').addEventListener('click', () => {
    budgetChartYear--;
    budgetChartExpanded = null;
    refreshBudgetAnnualChart();
});

document.getElementById('budgetYearNext').addEventListener('click', () => {
    budgetChartYear++;
    budgetChartExpanded = null;
    refreshBudgetAnnualChart();
});

function toggleBudgetChartDetail(month) {
    budgetChartExpanded = budgetChartExpanded === month ? null : month;
    refreshBudgetAnnualChart();
}

function refreshBudgetAnnualChart() {
    document.getElementById('budgetYearLabel').textContent = `${budgetChartYear}년`;

    const fixedTotal = fixedExpenses.reduce((s, f) => s + f.amount, 0);
    const data = [];
    for (let m = 0; m < 12; m++) {
        const items = budgetItems.filter(b => {
            const d = new Date(b.date);
            return d.getFullYear() === budgetChartYear && d.getMonth() === m;
        });
        const income = items.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0);
        const expense = items.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0) + fixedTotal;
        data.push({ month: m, income, expense, items });
    }

    const yearIncome = data.reduce((s, d) => s + d.income, 0);
    const yearExpense = data.reduce((s, d) => s + d.expense, 0);
    const yearSaving = yearIncome - yearExpense;

    // 연간 합계
    document.getElementById('budgetAnnualTotals').innerHTML = `
        <div class="annual-total-item">
            <span class="label">연간 총 수입</span>
            <span class="value positive">+${fmt(yearIncome)}원</span>
        </div>
        <div class="annual-total-item">
            <span class="label">연간 총 지출</span>
            <span class="value negative">-${fmt(yearExpense)}원</span>
        </div>
        <div class="annual-total-item">
            <span class="label">연간 순저축</span>
            <span class="value ${yearSaving >= 0 ? 'positive' : 'negative'}">${yearSaving >= 0 ? '+' : ''}${fmt(yearSaving)}원</span>
        </div>
    `;

    // 막대 그래프
    const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);

    document.getElementById('budgetAnnualChart').innerHTML = data.map((d, i) => {
        const incH = Math.round((d.income / maxVal) * 150);
        const expH = Math.round((d.expense / maxVal) * 150);
        const isActive = budgetChartExpanded === i;
        return `
            <div class="annual-bar-group${isActive ? ' active' : ''}" onclick="toggleBudgetChartDetail(${i})">
                <div class="annual-bars">
                    <div class="annual-bar income-bar" style="height:${Math.max(incH, 2)}px;" title="수입: ${fmt(d.income)}원"></div>
                    <div class="annual-bar expense-bar" style="height:${Math.max(expH, 2)}px;" title="지출: ${fmt(d.expense)}원"></div>
                </div>
                <span class="annual-bar-label">${i + 1}월</span>
            </div>
        `;
    }).join('');

    // 상세 펼침
    const container = document.getElementById('budgetAnnualDetail');
    if (budgetChartExpanded === null) {
        container.innerHTML = '';
        return;
    }

    const m = budgetChartExpanded;
    const d = data[m];
    const incomeItems = d.items.filter(b => b.type === 'income');
    const expenseItems = d.items.filter(b => b.type === 'expense');

    const incomeByCategory = {};
    incomeItems.forEach(b => { incomeByCategory[b.category] = (incomeByCategory[b.category] || 0) + b.amount; });
    const expenseByCategory = {};
    expenseItems.forEach(b => { expenseByCategory[b.category] = (expenseByCategory[b.category] || 0) + b.amount; });
    fixedExpenses.forEach(f => { expenseByCategory[f.name + ' (고정)'] = (expenseByCategory[f.name + ' (고정)'] || 0) + f.amount; });

    const makeList = (map, cls) => Object.keys(map).length
        ? Object.entries(map).sort((a, b) => b[1] - a[1]).map(([cat, amt]) =>
            `<div class="annual-detail-item"><span>${cat}</span><span class="${cls}">${cls === 'positive' ? '+' : '-'}${fmt(amt)}원</span></div>`
        ).join('')
        : '<div class="annual-detail-item"><span style="color:var(--text-muted);">내역 없음</span><span></span></div>';

    container.innerHTML = `
        <div class="annual-detail-box">
            <div class="annual-detail-title">${budgetChartYear}년 ${m + 1}월 상세</div>
            <div class="annual-detail-cols">
                <div class="annual-detail-col">
                    <h5 class="positive">수입 항목</h5>
                    ${makeList(incomeByCategory, 'positive')}
                </div>
                <div class="annual-detail-col">
                    <h5 class="negative">지출 항목</h5>
                    ${makeList(expenseByCategory, 'negative')}
                </div>
            </div>
        </div>
    `;
}

// ==================== 주식 ====================

const stockKrTableBody = document.getElementById('stockKrTableBody');
const stockUsTableBody = document.getElementById('stockUsTableBody');

// 환율
const exchangeRateInput = document.getElementById('exchangeRate');
const exchangeStatus = document.getElementById('exchangeStatus');
exchangeRateInput.value = exchangeRate;

let exchangeUpdatedAt = loadData('exchangeUpdatedAt', null);

function updateExchangeStatus(msg) {
    exchangeStatus.textContent = msg;
}

function showExchangeTime() {
    if (!exchangeUpdatedAt) {
        updateExchangeStatus('환율 정보 없음 - 새로고침 버튼을 누르거나 수동 입력하세요.');
        return;
    }
    const d = new Date(exchangeUpdatedAt);
    const pad = n => String(n).padStart(2, '0');
    const timeStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    updateExchangeStatus(`마지막 업데이트: ${timeStr} (자동)`);
}

async function fetchExchangeRate() {
    updateExchangeStatus('환율 정보를 불러오는 중...');
    try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const krw = data.rates && data.rates.KRW;
        if (!krw) throw new Error('KRW 환율 데이터 없음');

        exchangeRate = krw;
        exchangeRateInput.value = krw;
        exchangeUpdatedAt = new Date().toISOString();
        saveData('exchangeRate', exchangeRate);
        saveData('exchangeUpdatedAt', exchangeUpdatedAt);
        showExchangeTime();
        refreshStocks();
        refreshDashboard();
    } catch (e) {
        showExchangeTime();
        updateExchangeStatus(
            (exchangeUpdatedAt
                ? exchangeStatus.textContent + ' | '
                : '')
            + 'API 실패: ' + e.message + ' - 수동 입력으로 대체하세요.'
        );
    }
}

document.getElementById('refreshExchangeBtn').addEventListener('click', fetchExchangeRate);

document.getElementById('saveExchangeBtn').addEventListener('click', () => {
    const val = parseFloat(exchangeRateInput.value);
    if (isNaN(val) || val <= 0) return alert('올바른 환율을 입력하세요.');
    exchangeRate = val;
    exchangeUpdatedAt = new Date().toISOString();
    saveData('exchangeRate', exchangeRate);
    saveData('exchangeUpdatedAt', exchangeUpdatedAt);
    const d = new Date(exchangeUpdatedAt);
    const pad = n => String(n).padStart(2, '0');
    const timeStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    updateExchangeStatus(`마지막 업데이트: ${timeStr} (수동)`);
    refreshStocks();
    refreshDashboard();
});

// 국가 선택 시 폼 전환
const stockCountrySelect = document.getElementById('stockCountry');
const stockCurrencyHint = document.getElementById('stockCurrencyHint');
const stockTickerInput = document.getElementById('stockTicker');
const stockNameInput = document.getElementById('stockName');
const stockCurPriceInput = document.getElementById('stockCurPrice');

function updateStockForm() {
    const isUS = stockCountrySelect.value === 'US';
    stockTickerInput.style.display = isUS ? '' : 'none';
    stockCurPriceInput.placeholder = isUS ? '현재가 (자동조회)' : '현재가';
    stockCurrencyHint.textContent = isUS
        ? '미국 주식/ETF: 달러($)로 입력 \u00B7 티커 입력 시 현재가 자동 조회'
        : '한국 주식: 원화(\u20A9)로 입력';
}

stockCountrySelect.addEventListener('change', updateStockForm);

// Yahoo Finance API로 미국 주식 현재가 조회 (CORS 프록시 경유)
async function fetchYahooPrice(ticker) {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`;
    const proxies = [
        url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    ];

    let lastError;
    for (const makeUrl of proxies) {
        try {
            const res = await fetch(makeUrl(yahooUrl));
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (price == null) throw new Error('가격 데이터 없음');
            return price;
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError;
}

document.getElementById('addStockBtn').addEventListener('click', async () => {
    const country = stockCountrySelect.value;
    const ticker = stockTickerInput.value.trim().toUpperCase();
    const name = stockNameInput.value.trim();
    const qty = parseFloat(document.getElementById('stockQty').value);
    const avgPrice = parseFloat(document.getElementById('stockAvgPrice').value);
    let curPrice = parseFloat(stockCurPriceInput.value);

    if (country === 'US' && !ticker) return alert('티커를 입력하세요.');
    if (!name || isNaN(qty) || isNaN(avgPrice)) return alert('종목명, 수량, 평균 매입가를 입력하세요.');

    // 미국 주식: 현재가 비어 있으면 자동 조회
    if (country === 'US' && isNaN(curPrice)) {
        stockCurrencyHint.textContent = `${ticker} 현재가 조회 중...`;
        try {
            curPrice = await fetchYahooPrice(ticker);
            stockCurrencyHint.textContent = `${ticker} 현재가: $${fmtUsd(curPrice)} 조회 완료`;
        } catch (e) {
            stockCurrencyHint.textContent = 'API 실패: ' + e.message;
            curPrice = parseFloat(prompt(`${ticker} 현재가를 직접 입력하세요 ($):`, '0')) || 0;
        }
    }

    if (isNaN(curPrice)) return alert('현재가를 입력하세요.');

    stocks.push({
        id: uid(), country, name, qty, avgPrice, curPrice,
        ticker: country === 'US' ? ticker : ''
    });
    saveData('stocks', stocks);
    stockNameInput.value = '';
    stockTickerInput.value = '';
    document.getElementById('stockQty').value = '';
    document.getElementById('stockAvgPrice').value = '';
    stockCurPriceInput.value = '';
    updateStockForm();
    refreshStocks();
});

// 미국 주식 시세 일괄 갱신
document.getElementById('refreshUsStockBtn').addEventListener('click', async () => {
    const usStocks = stocks.filter(s => s.country === 'US' && s.ticker);
    if (!usStocks.length) return alert('갱신할 미국 종목이 없습니다.');

    const btn = document.getElementById('refreshUsStockBtn');
    btn.disabled = true;
    btn.classList.add('btn-loading');

    let success = 0, fail = 0;
    for (const s of usStocks) {
        try {
            s.curPrice = await fetchYahooPrice(s.ticker);
            success++;
        } catch {
            fail++;
        }
    }

    saveData('stocks', stocks);
    refreshStocks(true);
    refreshDashboard();
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    btn.innerHTML = '&#x21bb; 시세 갱신';
});

function deleteStock(id) {
    stocks = stocks.filter(s => s.id !== id);
    saveData('stocks', stocks);
    refreshStocks();
}

// ==================== 수정 모달 ====================

const editModal = document.getElementById('editModal');
const editModalClose = document.getElementById('editModalClose');
const editCancelBtn = document.getElementById('editCancelBtn');
const editSaveBtn = document.getElementById('editSaveBtn');

function openEditModal(type, id) {
    let item, title;
    const avgLabel = document.getElementById('editAvgPriceLabel');
    const curLabel = document.getElementById('editCurPriceLabel');

    if (type === 'stock') {
        item = stocks.find(s => s.id === id);
        if (!item) return;
        const curr = item.country === 'US' ? '$' : '\u20A9';
        title = (item.country === 'US' ? '미국 주식' : '한국 주식') + ' 수정';
        document.getElementById('editName').value = item.name;
        document.getElementById('editQty').value = item.qty;
        document.getElementById('editQty').step = item.country === 'US' ? 'any' : '1';
        avgLabel.textContent = '평균 매입가 (' + curr + ')';
        curLabel.textContent = '현재가 (' + curr + ')';
    } else {
        item = cryptos.find(c => c.id === id);
        if (!item) return;
        title = '코인 수정';
        document.getElementById('editName').value = item.ticker;
        document.getElementById('editQty').value = item.qty;
        document.getElementById('editQty').step = 'any';
        avgLabel.textContent = '평균 매입가 (\u20A9)';
        curLabel.textContent = '현재가 (\u20A9)';
    }

    document.getElementById('editModalTitle').textContent = title;
    document.getElementById('editId').value = id;
    document.getElementById('editType').value = type;
    document.getElementById('editAvgPrice').value = item.avgPrice;
    document.getElementById('editCurPrice').value = item.curPrice;
    editModal.classList.add('show');
}

function closeEditModal() {
    editModal.classList.remove('show');
}

editModalClose.addEventListener('click', closeEditModal);
editCancelBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

editSaveBtn.addEventListener('click', () => {
    const id = document.getElementById('editId').value;
    const type = document.getElementById('editType').value;
    const qty = parseFloat(document.getElementById('editQty').value);
    const avgPrice = parseFloat(document.getElementById('editAvgPrice').value);
    const curPrice = parseFloat(document.getElementById('editCurPrice').value);

    if (isNaN(qty) || isNaN(avgPrice) || isNaN(curPrice)) {
        return alert('올바른 숫자를 입력하세요.');
    }
    if (qty <= 0) return alert('수량은 0보다 커야 합니다.');

    if (type === 'stock') {
        const s = stocks.find(st => st.id === id);
        if (!s) return;
        s.qty = qty;
        s.avgPrice = avgPrice;
        s.curPrice = curPrice;
        saveData('stocks', stocks);
        refreshStocks();
    } else {
        const c = cryptos.find(cr => cr.id === id);
        if (!c) return;
        c.qty = qty;
        c.avgPrice = avgPrice;
        c.curPrice = curPrice;
        saveData('cryptos', cryptos);
        refreshCrypto();
    }
    closeEditModal();
});

function editStock(id) {
    openEditModal('stock', id);
}

function editCrypto(id) {
    openEditModal('crypto', id);
}

function refreshStocks(flash) {
    const rate = getExchangeRate();
    const krStocks = stocks.filter(s => s.country === 'KR');
    const usStocks = stocks.filter(s => s.country === 'US');

    // 전체 평가액 먼저 계산 (비중 산출용)
    const allStockValueKrw = stocks.reduce((s, st) => s + stockValueKrw(st), 0);

    let totalInvestKrw = 0, totalValueKrw = 0;
    const flashCls = flash ? ' cell-flash' : '';

    // 한국 주식
    stockKrTableBody.innerHTML = krStocks.map(s => {
        const invest = s.qty * s.avgPrice;
        const value = s.qty * s.curPrice;
        const profit = value - invest;
        const pct = invest > 0 ? (profit / invest) * 100 : 0;
        const weight = allStockValueKrw > 0 ? (value / allStockValueKrw * 100) : 0;
        totalInvestKrw += invest;
        totalValueKrw += value;

        return `
            <tr>
                <td>${s.name}</td>
                <td>${fmt(s.qty)}</td>
                <td>${fmt(s.avgPrice)}원</td>
                <td class="${flashCls}">${fmt(s.curPrice)}원</td>
                <td>${fmt(invest)}원</td>
                <td class="${flashCls}">${fmt(value)}원</td>
                <td class="${pctClass(profit)}${flashCls}">${profit >= 0 ? '+' : ''}${fmt(profit)}원</td>
                <td class="${pctClass(pct)}${flashCls}">${pct >= 0 ? '+' : ''}${fmtDecimal(pct)}%</td>
                <td class="weight-col">${fmtDecimal(weight, 1)}%</td>
                <td><button class="btn btn-edit" onclick="editStock('${s.id}')">수정</button></td>
                <td><button class="btn btn-del" onclick="deleteStock('${s.id}')">삭제</button></td>
            </tr>
        `;
    }).join('');

    if (!krStocks.length) {
        stockKrTableBody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);">한국 주식이 없습니다.</td></tr>';
    }

    // 미국 주식
    stockUsTableBody.innerHTML = usStocks.map(s => {
        const invest = s.qty * s.avgPrice;
        const value = s.qty * s.curPrice;
        const profit = value - invest;
        const pct = invest > 0 ? (profit / invest) * 100 : 0;
        const valueKrw = value * rate;
        const weight = allStockValueKrw > 0 ? (valueKrw / allStockValueKrw * 100) : 0;
        totalInvestKrw += invest * rate;
        totalValueKrw += valueKrw;

        return `
            <tr>
                <td>${s.name}${s.ticker ? ' <span style="color:var(--text-muted);font-size:0.78rem;">(' + s.ticker + ')</span>' : ''}</td>
                <td>${fmtDecimal(s.qty, 2)}</td>
                <td>$${fmtUsd(s.avgPrice)}</td>
                <td class="${flashCls}">$${fmtUsd(s.curPrice)}</td>
                <td>$${fmtUsd(invest)}</td>
                <td class="${flashCls}">$${fmtUsd(value)}</td>
                <td class="${flashCls}">${fmt(valueKrw)}원</td>
                <td class="${pctClass(profit)}${flashCls}">${profit >= 0 ? '+' : ''}${fmt(profit * rate)}원</td>
                <td class="${pctClass(pct)}${flashCls}">${pct >= 0 ? '+' : ''}${fmtDecimal(pct)}%</td>
                <td class="weight-col">${fmtDecimal(weight, 1)}%</td>
                <td><button class="btn btn-edit" onclick="editStock('${s.id}')">수정</button></td>
                <td><button class="btn btn-del" onclick="deleteStock('${s.id}')">삭제</button></td>
            </tr>
        `;
    }).join('');

    if (!usStocks.length) {
        stockUsTableBody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);">미국 주식/ETF가 없습니다.</td></tr>';
    }

    const totalPct = totalInvestKrw > 0 ? ((totalValueKrw - totalInvestKrw) / totalInvestKrw) * 100 : 0;
    document.getElementById('stockTotalInvest').textContent = fmt(totalInvestKrw) + '원';
    document.getElementById('stockTotalValue').textContent = fmt(totalValueKrw) + '원';

    const retEl = document.getElementById('stockTotalReturn');
    retEl.textContent = (totalPct >= 0 ? '+' : '') + fmtDecimal(totalPct) + '%';
    retEl.className = 'summary-value ' + pctClass(totalPct);
}

// ==================== 코인 (업비트 API) ====================

const cryptoTableBody = document.getElementById('cryptoTableBody');

document.getElementById('addCryptoBtn').addEventListener('click', async () => {
    let ticker = document.getElementById('cryptoTicker').value.trim().toUpperCase();
    const qty = parseFloat(document.getElementById('cryptoQty').value);
    const avgPrice = parseFloat(document.getElementById('cryptoAvgPrice').value);

    if (!ticker || isNaN(qty) || isNaN(avgPrice)) {
        return alert('티커, 수량, 평균 매입가를 입력하세요.');
    }

    // 업비트 시세 조회
    let curPrice = 0;
    try {
        const market = 'KRW-' + ticker;
        const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${market}`);
        const data = await res.json();
        if (data && data.length > 0 && data[0].trade_price) {
            curPrice = data[0].trade_price;
        } else {
            curPrice = parseFloat(prompt('시세를 불러올 수 없습니다. 현재가를 직접 입력하세요:', '0')) || 0;
        }
    } catch {
        curPrice = parseFloat(prompt('API 오류. 현재가를 직접 입력하세요:', '0')) || 0;
    }

    cryptos.push({ id: uid(), ticker, qty, avgPrice, curPrice });
    saveData('cryptos', cryptos);
    document.getElementById('cryptoTicker').value = '';
    document.getElementById('cryptoQty').value = '';
    document.getElementById('cryptoAvgPrice').value = '';
    refreshCrypto();
});

document.getElementById('refreshCryptoBtn').addEventListener('click', refreshCryptoPrices);

async function refreshCryptoPrices() {
    if (cryptos.length === 0) return;

    const btn = document.getElementById('refreshCryptoBtn');
    btn.disabled = true;
    btn.classList.add('btn-loading');

    const markets = cryptos.map(c => 'KRW-' + c.ticker).join(',');
    try {
        const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid response');

        data.forEach(d => {
            const ticker = d.market.replace('KRW-', '');
            const coin = cryptos.find(c => c.ticker === ticker);
            if (coin) coin.curPrice = d.trade_price;
        });

        saveData('cryptos', cryptos);
        refreshCrypto(true);
    } catch (e) {
        alert('시세 갱신 실패: ' + e.message);
    }

    btn.disabled = false;
    btn.classList.remove('btn-loading');
    btn.innerHTML = '&#x21bb; 시세 갱신';
}

function deleteCrypto(id) {
    cryptos = cryptos.filter(c => c.id !== id);
    saveData('cryptos', cryptos);
    refreshCrypto();
}

function refreshCrypto(flash) {
    let totalInvest = 0, totalValue = 0;
    const allCryptoValue = cryptos.reduce((s, c) => s + c.qty * c.curPrice, 0);
    const flashCls = flash ? ' cell-flash' : '';

    cryptoTableBody.innerHTML = cryptos.map(c => {
        const invest = c.qty * c.avgPrice;
        const value = c.qty * c.curPrice;
        const profit = value - invest;
        const pct = invest > 0 ? (profit / invest) * 100 : 0;
        const weight = allCryptoValue > 0 ? (value / allCryptoValue * 100) : 0;
        totalInvest += invest;
        totalValue += value;

        return `
            <tr>
                <td>${c.ticker}</td>
                <td>${fmtDecimal(c.qty, 4)}</td>
                <td>${fmt(c.avgPrice)}원</td>
                <td class="${flashCls}">${fmt(c.curPrice)}원</td>
                <td>${fmt(invest)}원</td>
                <td class="${flashCls}">${fmt(value)}원</td>
                <td class="${pctClass(profit)}${flashCls}">${profit >= 0 ? '+' : ''}${fmt(profit)}원</td>
                <td class="${pctClass(pct)}${flashCls}">${pct >= 0 ? '+' : ''}${fmtDecimal(pct)}%</td>
                <td class="weight-col">${fmtDecimal(weight, 1)}%</td>
                <td><button class="btn btn-edit" onclick="editCrypto('${c.id}')">수정</button></td>
                <td><button class="btn btn-del" onclick="deleteCrypto('${c.id}')">삭제</button></td>
            </tr>
        `;
    }).join('');

    const totalPct = totalInvest > 0 ? ((totalValue - totalInvest) / totalInvest) * 100 : 0;
    document.getElementById('cryptoTotalInvest').textContent = fmt(totalInvest) + '원';
    document.getElementById('cryptoTotalValue').textContent = fmt(totalValue) + '원';

    const retEl = document.getElementById('cryptoTotalReturn');
    retEl.textContent = (totalPct >= 0 ? '+' : '') + fmtDecimal(totalPct) + '%';
    retEl.className = 'summary-value ' + pctClass(totalPct);
}

// ==================== 데이터 초기화 ====================

document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (!confirm('모든 데이터를 삭제하시겠습니까?')) return;
    localStorage.removeItem('deposits');
    localStorage.removeItem('budgetItems');
    localStorage.removeItem('fixedExpenses');
    localStorage.removeItem('stocks');
    localStorage.removeItem('cryptos');
    localStorage.removeItem('exchangeRate');
    localStorage.removeItem('exchangeUpdatedAt');
    deposits = [];
    budgetItems = [];
    fixedExpenses = [];
    stocks = [];
    cryptos = [];
    exchangeRate = 1350;
    exchangeUpdatedAt = null;
    exchangeRateInput.value = 1350;
    updateExchangeStatus('환율 정보 없음 - 새로고침 버튼을 누르거나 수동 입력하세요.');
    refreshDashboard();
    refreshBudget();
    refreshStocks();
    refreshCrypto();
});

// ==================== 초기 렌더링 ====================

refreshDashboard();
refreshBudget();
refreshStocks();
refreshCrypto();

// 앱 실행 시 환율 자동 조회
fetchExchangeRate();
