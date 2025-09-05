/********************************************
 * Harvey PDF Table — Branch-Aware Version
 * - Separate localStorage per branch
 * - Auto-load/switch data when branch changes
 * - Date column uses <input type="date"> (defaults to today)
 * - Auto-save after any change
 ********************************************/

let rowCounter = 1;          // updated dynamically
let activeBranch = null;     // tracks which branch is currently loaded

// ---------- Utilities ----------
function isoToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function toIsoDateOrEmpty(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return '';
}

function getBranchValue() {
    return document.getElementById('branchName').value || 'Default';
}

function getStorageKey(branchName) {
    // Namespace per branch to avoid collisions between branches
    const b = branchName || activeBranch || getBranchValue();
    // Safe key for any language
    return `harveyPDFData:${encodeURIComponent(b)}`;
}

function getMetaKey() {
    return 'harveyPDFMeta';
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', function () {
    // restore last branch if saved, else use current select value
    const meta = loadMeta();
    const branchSelect = document.getElementById('branchName');

    if (meta?.lastBranch) {
        branchSelect.value = meta.lastBranch; // if it exists in the dropdown it will select it
    }

    activeBranch = getBranchValue();

    // Only set reportDate to today if no saved data for this branch
    if (!localStorage.getItem(getStorageKey(activeBranch))) {
        document.getElementById('reportDate').value = isoToday();
    }

    // Load state for current branch (also rebuilds the table if saved)
    loadFromLocalStorage(activeBranch);

    // Ensure any pre-existing static HTML rows use <input type="date">
    ensureDateInputsOnExistingRows();

    // Setup listeners (includes branch change handler)
    setupEventListeners();

    // Recalculate nets for existing rows
    document.querySelectorAll('tbody tr').forEach(tr => {
        const idx = parseInt(tr.getAttribute('data-row'), 10);
        if (!isNaN(idx)) calculateNet(idx);
    });

    console.log('تم تحميل مولد PDF للجداول بنجاح - Harvey Edition (فروع متعددة)');
});

// Convert first cell to <input type="date"> on existing rows if needed
function ensureDateInputsOnExistingRows() {
    const tbody = document.querySelector('#dataTable tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach((tr) => {
        const dateCell = tr.cells[0];
        if (!dateCell) return;

        const oldInput = dateCell.querySelector('input');
        let existingValue = '';
        if (oldInput) existingValue = oldInput.value || oldInput.getAttribute('value') || '';

        dateCell.innerHTML = `<input type="date" value="${toIsoDateOrEmpty(existingValue) || isoToday()}">`;

        const dateInput = dateCell.querySelector('input[type="date"]');
        dateInput.addEventListener('change', saveToLocalStorage);
        dateInput.addEventListener('input', saveToLocalStorage);
    });

    rowCounter = rows.length;
}

// ---------- Event Listeners ----------
function setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            generatePDF();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            previewTable();
        }
    });

    // Auto-save top inputs
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
        input.addEventListener('input', saveToLocalStorage);
    });

    // Branch change handler — save current, then load target branch
    document.getElementById('branchName').addEventListener('change', onBranchChange);
}

function onBranchChange() {
    const prevBranch = activeBranch;
    const nextBranch = getBranchValue();

    // 1) Save current branch data under its own key
    if (prevBranch) {
        saveToLocalStorage(prevBranch);
    }

    // 2) Update active branch and meta
    activeBranch = nextBranch;
    saveMeta({ lastBranch: activeBranch });

    // 3) Load the selected branch data
    const loaded = loadFromLocalStorage(activeBranch);

    // 4) If nothing existed for that branch, start a clean default row
    if (!loaded) {
        buildDefaultTable(); // sets today as default
        document.getElementById('reportDate').value = isoToday();
        // Auto-save the empty state so switching away/back shows consistent baseline
        saveToLocalStorage(activeBranch);
    }

    // 5) Recalc net for all rows in the loaded/created table
    document.querySelectorAll('tbody tr').forEach(tr => {
        const idx = parseInt(tr.getAttribute('data-row'), 10);
        if (!isNaN(idx)) calculateNet(idx);
    });

    showNotification(`تم تحميل بيانات ${activeBranch}`, 'success');
}

// ---------- Persistence ----------
function saveToLocalStorage(forcedBranchName) {
    try {
        const branchName = forcedBranchName || activeBranch || getBranchValue();
        const data = {
            branch: branchName,
            title: document.getElementById('reportTitle').value,
            date: document.getElementById('reportDate').value || isoToday(),
            tableData: collectTableData()
        };
        localStorage.setItem(getStorageKey(branchName), JSON.stringify(data));

        // also keep meta (lastBranch) fresh
        saveMeta({ lastBranch: branchName });
    } catch (e) {
        console.log('Could not save to localStorage');
    }
}

/**
 * Loads data for a given branch.
 * @returns {boolean} true if data existed and was loaded; false otherwise
 */
function loadFromLocalStorage(branchName) {
    try {
        const saved = localStorage.getItem(getStorageKey(branchName));
        if (saved) {
            const data = JSON.parse(saved);
            // IMPORTANT: set the dropdown to the branch of the loaded data (if different)
            const branchSelect = document.getElementById('branchName');
            if (branchSelect.value !== data.branch) branchSelect.value = data.branch;

            if (data.title) document.getElementById('reportTitle').value = data.title;
            if (data.date)  document.getElementById('reportDate').value = data.date;

            if (data.tableData && Array.isArray(data.tableData.rows)) {
                renderTableFromData(data.tableData);
            } else {
                buildDefaultTable();
            }

            activeBranch = data.branch;
            return true;
        }
        return false;
    } catch (e) {
        console.log('Could not load from localStorage');
        return false;
    }
}

function saveMeta(partial = {}) {
    const current = loadMeta() || {};
    const merged = { ...current, ...partial };
    localStorage.setItem(getMetaKey(), JSON.stringify(merged));
}

function loadMeta() {
    try {
        const m = localStorage.getItem(getMetaKey());
        return m ? JSON.parse(m) : null;
    } catch {
        return null;
    }
}

// ---------- Default Table Builder ----------
function buildDefaultTable() {
    const tbody = document.querySelector('#dataTable tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr data-row="0">
            <td><input type="date" value="${isoToday()}"></td>
            <td><input type="number" placeholder="0" onchange="calculateNet(0)" oninput="calculateNet(0)"></td>
            <td><input type="number" placeholder="0" onchange="calculateNet(0)" oninput="calculateNet(0)"></td>
            <td class="expenses-cell">
                <div class="expenses-container" id="expenses-0">
                    <div class="expense-item">
                        <input type="number" placeholder="المبلغ" onchange="calculateNet(0)" oninput="calculateNet(0)">
                        <span class="expense-separator">:</span>
                        <input type="text" placeholder="الوصف" class="expense-description">
                        <button type="button" onclick="removeExpense(this, 0)" class="remove-expense" title="حذف المصروف">×</button>
                    </div>
                </div>
                <button type="button" onclick="addExpense(0)" class="add-expense">+ إضافة مصروف</button>
            </td>
            <td><input type="number" class="net-field" readonly placeholder="0"></td>
            <td><input type="number" placeholder="0"></td>
        </tr>
    `;

    rowCounter = 1;

    // Bind save events for fresh inputs
    document.querySelectorAll('tbody input, select').forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
        input.addEventListener('input', saveToLocalStorage);
    });
}

// ---------- Row & Expense Controls ----------
function addRow() {
    const tbody = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    const newRow = tbody.insertRow();
    newRow.setAttribute('data-row', rowCounter);

    const cells = [
        `<input type="date" value="${isoToday()}">`,
        `<input type="number" placeholder="0" onchange="calculateNet(${rowCounter})" oninput="calculateNet(${rowCounter})">`,
        `<input type="number" placeholder="0" onchange="calculateNet(${rowCounter})" oninput="calculateNet(${rowCounter})">`,
        `<div class="expenses-container" id="expenses-${rowCounter}">
            <div class="expense-item">
                <input type="number" placeholder="المبلغ" onchange="calculateNet(${rowCounter})" oninput="calculateNet(${rowCounter})">
                <span class="expense-separator">:</span>
                <input type="text" placeholder="الوصف" class="expense-description">
                <button type="button" onclick="removeExpense(this, ${rowCounter})" class="remove-expense" title="حذف المصروف">×</button>
            </div>
        </div>
        <button type="button" onclick="addExpense(${rowCounter})" class="add-expense">+ إضافة مصروف</button>`,
        '<input type="number" class="net-field" readonly placeholder="0">',
        '<input type="number" placeholder="0">'
    ];

    cells.forEach((cellContent, index) => {
        const cell = newRow.insertCell();
        if (index === 3) cell.className = 'expenses-cell';
        cell.innerHTML = cellContent;
    });

    // Bind save events for the new inputs
    newRow.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
        input.addEventListener('input', saveToLocalStorage);
    });

    calculateNet(rowCounter);
    rowCounter++;
    saveToLocalStorage();
}

function removeRow() {
    const table = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    if (table.rows.length > 1) {
        table.deleteRow(table.rows.length - 1);
        rowCounter = Math.max(0, rowCounter - 1);
        saveToLocalStorage();
    } else {
        showNotification('لا يمكن حذف الصف الأخير', 'warning');
    }
}

function clearTable() {
    if (confirm('هل أنت متأكد من مسح جميع البيانات؟')) {
        buildDefaultTable();
        saveToLocalStorage();
        showNotification('تم مسح الجدول بنجاح', 'success');
    }
}

function addExpense(rowIndex) {
    const expensesContainer = document.getElementById(`expenses-${rowIndex}`);
    const newExpenseItem = document.createElement('div');
    newExpenseItem.className = 'expense-item';
    newExpenseItem.innerHTML = `
        <input type="number" placeholder="المبلغ" onchange="calculateNet(${rowIndex})" oninput="calculateNet(${rowIndex})">
        <span class="expense-separator">:</span>
        <input type="text" placeholder="الوصف" class="expense-description">
        <button type="button" onclick="removeExpense(this, ${rowIndex})" class="remove-expense" title="حذف المصروف">×</button>
    `;
    expensesContainer.appendChild(newExpenseItem);

    newExpenseItem.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
        input.addEventListener('input', saveToLocalStorage);
    });

    const amountInput = newExpenseItem.querySelector('input[type="number"]');
    setTimeout(() => amountInput && amountInput.focus(), 100);
}

function removeExpense(button, rowIndex) {
    const expenseItem = button.parentElement;
    const expensesContainer = expenseItem.parentElement;

    if (expensesContainer.children.length > 1) {
        expenseItem.remove();
        calculateNet(rowIndex);
        saveToLocalStorage();
    } else {
        showNotification('لا يمكن حذف آخر مصروف في الصف', 'warning');
    }
}

// ---------- Calculation ----------
function calculateNet(rowIndex) {
    const row = document.querySelector(`tr[data-row="${rowIndex}"]`);
    if (!row) return;

    const morningShift = parseFloat(row.cells[1].querySelector('input').value) || 0;
    const eveningShift = parseFloat(row.cells[2].querySelector('input').value) || 0;

    let totalExpenses = 0;
    const expensesContainer = document.getElementById(`expenses-${rowIndex}`);
    if (expensesContainer) {
        const expenseInputs = expensesContainer.querySelectorAll('.expense-item input[type="number"]');
        expenseInputs.forEach(input => { totalExpenses += parseFloat(input.value) || 0; });
    }

    const net = morningShift + eveningShift - totalExpenses;

    const netField = row.cells[4].querySelector('input');
    netField.value = net;

    netField.style.color = net >= 0 ? '#27ae60' : '#e74c3c';
    netField.style.transform = 'scale(1.05)';
    setTimeout(() => { netField.style.transform = 'scale(1)'; }, 200);

    saveToLocalStorage();
}

// ---------- Data Collection & Summary ----------
function collectTableData() {
    const table = document.getElementById('dataTable');
    const headers = [];
    const rows = [];

    const headerCells = table.querySelectorAll('thead th');
    headerCells.forEach(header => headers.push(header.textContent));

    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');

        cells.forEach((cell, index) => {
            if (index === 3) {
                const expenses = [];
                const expenseItems = cell.querySelectorAll('.expense-item');
                expenseItems.forEach(item => {
                    const amountInput = item.querySelector('input[type="number"]');
                    const descInput   = item.querySelector('input[type="text"]');
                    const amount = amountInput ? amountInput.value || '0' : '0';
                    const description = descInput ? descInput.value || '' : '';
                    if (amount !== '0' || description !== '') {
                        expenses.push({ amount, description });
                    }
                });
                rowData.push(expenses);
            } else {
                const input = cell.querySelector('input');
                rowData.push(input ? input.value : cell.textContent);
            }
        });
        rows.push(rowData);
    });

    return { headers, rows };
}

function calculateSummary(tableData) {
    let totalMorning = 0;
    let totalEvening = 0;
    let totalExpenses = 0;
    let totalNet = 0;
    let totalDeliveries = 0;

    tableData.rows.forEach(row => {
        totalMorning += parseFloat(row[1]) || 0;
        totalEvening += parseFloat(row[2]) || 0;

        if (Array.isArray(row[3])) {
            row[3].forEach(expense => {
                totalExpenses += parseFloat(expense.amount) || 0;
            });
        }

        totalNet += parseFloat(row[4]) || 0;
        totalDeliveries += parseFloat(row[5]) || 0;
    });

    return {
        totalMorning,
        totalEvening,
        totalExpenses,
        totalNet,
        totalDeliveries,
        grandTotal: totalMorning + totalEvening - totalExpenses + totalDeliveries
    };
}

// ---------- Preview & PDF ----------
function previewTable() {
    const branchName = getBranchValue();
    const reportTitle = document.getElementById('reportTitle').value;
    const reportDate = document.getElementById('reportDate').value || isoToday();
    const tableData = collectTableData();
    const summary = calculateSummary(tableData);

    if (tableData.rows.length === 0 || !tableData.rows.some(row => row.some(cell => cell && cell !== '0'))) {
        showNotification('يرجى إدخال بعض البيانات أولاً', 'warning');
        return;
    }

    const previewHtml = createPDFTemplate(branchName, reportTitle, reportDate, tableData, summary);

    document.getElementById('pdfPreview').innerHTML = previewHtml;
    document.getElementById('preview').style.display = 'block';
    document.getElementById('preview').scrollIntoView({ behavior: 'smooth' });

    showNotification('تم إنشاء المعاينة بنجاح', 'success');
}

function closePreview() {
    document.getElementById('preview').style.display = 'none';
}

function formatDate(dateString) {
    const val = dateString || isoToday();
    const date = new Date(val);
    if (isNaN(date.getTime())) return new Date().toLocaleDateString('ar-EG');
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatNumber(num) {
    return parseFloat(num || 0).toLocaleString('ar-EG');
}

function formatExpenses(expenses) {
    if (!Array.isArray(expenses) || expenses.length === 0) {
        return '<div class="pdf-expenses">لا توجد مصروفات</div>';
    }

    let expensesHtml = '<div class="pdf-expenses">';
    expenses.forEach(expense => {
        if (expense.amount && expense.amount !== '0') {
            expensesHtml += `
                <div class="pdf-expense-item">
                    <span class="pdf-expense-amount">${formatNumber(expense.amount)} جنيه</span>
                    <span class="pdf-expense-desc">${expense.description || 'بدون وصف'}</span>
                </div>
            `;
        }
    });
    expensesHtml += '</div>';

    return expensesHtml;
}

function createPDFTemplate(branchName, reportTitle, reportDate, tableData, summary) {
    return `
        <div class="pdf-template">
            <div class="pdf-header">
                <div class="pdf-logo-section">
                    <img src="assets/Harvey's Logo.jpg" alt="Harvey Logo">
                </div>
                <div class="pdf-branch">${branchName}</div>
            </div>

            <div class="pdf-title">
                <h1>${reportTitle}</h1>
            </div>

            <div class="pdf-date">
                تاريخ التقرير: ${formatDate(reportDate)}
            </div>

            <table class="pdf-table">
                <thead>
                    <tr>
                        ${tableData.headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableData.rows.map(row => `
                        <tr>
                            <td><strong>${row[0] || ''}</strong></td>
                            <td>${formatNumber(row[1])}</td>
                            <td>${formatNumber(row[2])}</td>
                            <td>${formatExpenses(row[3])}</td>
                            <td class="net-highlight">${formatNumber(row[4])}</td>
                            <td>${formatNumber(row[5])}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="pdf-summary">
                <div class="summary-card">
                    <h3>إجمالي الشيفت الصباحي</h3>
                    <div class="value">${formatNumber(summary.totalMorning)}</div>
                </div>
                <div class="summary-card">
                    <h3>إجمالي الشيفت المسائي</h3>
                    <div class="value">${formatNumber(summary.totalEvening)}</div>
                </div>
                <div class="summary-card">
                    <h3>إجمالي المصروفات</h3>
                    <div class="value">${formatNumber(summary.totalExpenses)}</div>
                </div>
                <div class="summary-card">
                    <h3>إجمالي الصافي</h3>
                    <div class="value">${formatNumber(summary.totalNet)}</div>
                </div>
                <div class="summary-card">
                    <h3>إجمالي التسليمات</h3>
                    <div class="value">${formatNumber(summary.totalDeliveries)}</div>
                </div>
                <div class="summary-card">
                    <h3>المجموع النهائي</h3>
                    <div class="value">${formatNumber(summary.grandTotal)}</div>
                </div>
            </div>

            <div class="pdf-footer">
                <p>تم إنشاء هذا التقرير بواسطة نظام هارفي المتقدم ⚡ </p>
                <p>تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}</p>
            </div>
        </div>
    `;
}

async function generatePDF() {
    const branchName = getBranchValue();
    const reportTitle = document.getElementById('reportTitle').value;
    const reportDate = document.getElementById('reportDate').value || isoToday();
    const tableData = collectTableData();
    const summary = calculateSummary(tableData);

    if (tableData.rows.length === 0 || !tableData.rows.some(row => row.some(cell => cell && cell !== '0'))) {
        showNotification('يرجى إدخال بعض البيانات أولاً', 'warning');
        return;
    }

    const generateBtn = document.querySelector('.generate-btn');
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">جاري إنشاء PDF...</span>';
    generateBtn.disabled = true;

    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = createPDFTemplate(branchName, reportTitle, reportDate, tableData, summary);
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.background = 'white';
    tempContainer.style.width = '800px';
    tempContainer.style.fontFamily = 'Tajawal, Arial, sans-serif';
    document.body.appendChild(tempContainer);

    try {
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(tempContainer.firstElementChild, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            height: tempContainer.firstElementChild.scrollHeight,
            width: tempContainer.firstElementChild.scrollWidth
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;

        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const formattedDate = new Date(reportDate).toLocaleDateString('ar-EG').replace(/\//g, '-');
        const fileName = `${reportTitle}_${branchName}_${formattedDate}.pdf`;
        pdf.save(fileName);

        showNotification('تم إنشاء ملف PDF بنجاح!', 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showNotification('حدث خطأ أثناء إنشاء ملف PDF. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
        document.body.removeChild(tempContainer);
        generateBtn.innerHTML = originalText;
        generateBtn.disabled = false;
    }
}

// ---------- CSV Export ----------
function exportToExcel() {
    const branchName = getBranchValue();
    const reportTitle = document.getElementById('reportTitle').value;
    const reportDate = document.getElementById('reportDate').value || isoToday();
    const tableData = collectTableData();

    if (tableData.rows.length === 0 || !tableData.rows.some(row => row.some(cell => cell && cell !== '0'))) {
        showNotification('يرجى إدخال بعض البيانات أولاً', 'warning');
        return;
    }

    let csvContent = `\uFEFF${reportTitle} - ${branchName}\n`;
    csvContent += `تاريخ التقرير: ${formatDate(reportDate)}\n\n`;
    csvContent += tableData.headers.join(',') + '\n';

    tableData.rows.forEach(row => {
        const csvRow = [];
        row.forEach((cell, index) => {
            if (index === 3 && Array.isArray(cell)) {
                const expensesText = cell.map(exp => `${exp.amount}:${exp.description}`).join(';');
                csvRow.push(`"${expensesText}"`);
            } else {
                csvRow.push(cell);
            }
        });
        csvContent += csvRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reportTitle}_${branchName}_${new Date(reportDate).toLocaleDateString('ar-EG').replace(/\//g, '-')}.csv`;
    link.click();

    showNotification('تم تصدير ملف Excel بنجاح!', 'success');
}

// ---------- Notifications ----------
function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#27ae60' : type === 'warning' ? '#f39c12' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 300px;
        font-family: 'Tajawal', Arial, sans-serif;
        font-size: 14px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        direction: rtl;
        text-align: right;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 100);

    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => { notification.parentNode && notification.parentNode.removeChild(notification); }, 300);
    }, 3000);
}

// ---------- Render from Saved Data ----------
function renderTableFromData(tableData) {
    const tbody = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    tableData.rows.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-row', i);

        // Date
        const td0 = document.createElement('td');
        td0.innerHTML = `<input type="date" value="${toIsoDateOrEmpty(row[0]) || isoToday()}">`;
        tr.appendChild(td0);

        // Morning
        const td1 = document.createElement('td');
        td1.innerHTML = `<input type="number" placeholder="0" value="${row[1] || ''}" onchange="calculateNet(${i})" oninput="calculateNet(${i})">`;
        tr.appendChild(td1);

        // Evening
        const td2 = document.createElement('td');
        td2.innerHTML = `<input type="number" placeholder="0" value="${row[2] || ''}" onchange="calculateNet(${i})" oninput="calculateNet(${i})">`;
        tr.appendChild(td2);

        // Expenses
        const td3 = document.createElement('td');
        td3.className = 'expenses-cell';

        const containerId = `expenses-${i}`;
        const expContainer = document.createElement('div');
        expContainer.className = 'expenses-container';
        expContainer.id = containerId;

        const expenses = Array.isArray(row[3]) ? row[3] : [];
        const list = expenses.length ? expenses : [{ amount: '', description: '' }];

        list.forEach(exp => {
            const item = document.createElement('div');
            item.className = 'expense-item';
            item.innerHTML = `
                <input type="number" placeholder="المبلغ" value="${exp.amount || ''}" onchange="calculateNet(${i})" oninput="calculateNet(${i})">
                <span class="expense-separator">:</span>
                <input type="text" placeholder="الوصف" value="${exp.description || ''}" class="expense-description">
                <button type="button" onclick="removeExpense(this, ${i})" class="remove-expense" title="حذف المصروف">×</button>
            `;
            expContainer.appendChild(item);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'add-expense';
        addBtn.textContent = '+ إضافة مصروف';
        addBtn.setAttribute('onclick', `addExpense(${i})`);

        td3.appendChild(expContainer);
        td3.appendChild(addBtn);
        tr.appendChild(td3);

        // Net
        const td4 = document.createElement('td');
        td4.innerHTML = `<input type="number" class="net-field" readonly value="${row[4] || ''}" placeholder="0">`;
        tr.appendChild(td4);

        // Deliveries
        const td5 = document.createElement('td');
        td5.innerHTML = `<input type="number" placeholder="0" value="${row[5] || ''}">`;
        tr.appendChild(td5);

        tbody.appendChild(tr);
    });

    rowCounter = tableData.rows.length;

    tbody.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
        input.addEventListener('input', saveToLocalStorage);
    });
}
