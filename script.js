/**************************************
 * Harvey PDF Table — Enhanced Version
 * - Persist full table in localStorage
 * - Rebuild table on load
 * - Date column uses <input type="date">
 * - New rows default to today's date
 * - Auto-save after any change
 **************************************/

let rowCounter = 1; // will be updated dynamically

// ---------- Utilities ----------
function isoToday() {
    // yyyy-mm-dd
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function toIsoDateOrEmpty(value) {
    // If already yyyy-mm-dd, return as is
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }
    // Try to parse free text date to ISO, else return ''
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return '';
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', function () {
    // Only set reportDate to today if it's not already saved
    if (!localStorage.getItem('harveyPDFData')) {
        document.getElementById('reportDate').value = isoToday();
    }

    // Load saved state (this also rebuilds the table if saved)
    loadFromLocalStorage();

    // Ensure any pre-existing rows in HTML use <input type="date"> with default today
    ensureDateInputsOnExistingRows();

    // Setup listeners
    setupEventListeners();

    // Recalculate nets for any existing rows
    document.querySelectorAll('tbody tr').forEach(tr => {
        const idx = parseInt(tr.getAttribute('data-row'), 10);
        if (!isNaN(idx)) calculateNet(idx);
    });

    console.log('تم تحميل مولد PDF للجداول بنجاح - Harvey Edition');
});

// Convert the first cell in each existing row to <input type="date"> if it isn't already
function ensureDateInputsOnExistingRows() {
    const tbody = document.querySelector('#dataTable tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach((tr, i) => {
        const dateCell = tr.cells[0];
        if (!dateCell) return;

        const oldInput = dateCell.querySelector('input');
        let existingValue = '';
        if (oldInput) existingValue = oldInput.value || oldInput.getAttribute('value') || '';

        dateCell.innerHTML = `<input type="date" value="${toIsoDateOrEmpty(existingValue) || isoToday()}">`;

        // Attach save listener to the new date input
        const dateInput = dateCell.querySelector('input[type="date"]');
        dateInput.addEventListener('change', saveToLocalStorage);
        dateInput.addEventListener('input', saveToLocalStorage);
    });

    // Update rowCounter to current number of rows
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

    // First load already handled in DOMContentLoaded
}

// ---------- Persistence ----------
function saveToLocalStorage() {
    try {
        const data = {
            branch: document.getElementById('branchName').value,
            title: document.getElementById('reportTitle').value,
            date: document.getElementById('reportDate').value || isoToday(),
            tableData: collectTableData()
        };
        localStorage.setItem('harveyPDFData', JSON.stringify(data));
    } catch (e) {
        console.log('Could not save to localStorage');
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('harveyPDFData');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.branch) document.getElementById('branchName').value = data.branch;
            if (data.title) document.getElementById('reportTitle').value = data.title;
            if (data.date) document.getElementById('reportDate').value = data.date;

            if (data.tableData && Array.isArray(data.tableData.rows)) {
                renderTableFromData(data.tableData);
            }
        }
    } catch (e) {
        console.log('Could not load from localStorage');
    }
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
        const tbody = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
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

        // Re-bind save events
        document.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', saveToLocalStorage);
            input.addEventListener('input', saveToLocalStorage);
        });

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

    // Bind save events
    newExpenseItem.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
        input.addEventListener('input', saveToLocalStorage);
    });

    // Focus amount
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

    // Total expenses
    const expensesContainer = document.getElementById(`expenses-${rowIndex}`);
    let totalExpenses = 0;

    if (expensesContainer) {
        const expenseInputs = expensesContainer.querySelectorAll('.expense-item input[type="number"]');
        expenseInputs.forEach(input => {
            totalExpenses += parseFloat(input.value) || 0;
        });
    }

    const net = morningShift + eveningShift - totalExpenses;

    // Update net field
    const netField = row.cells[4].querySelector('input');
    netField.value = net;

    // Visual feedback
    netField.style.color = net >= 0 ? '#27ae60' : '#e74c3c';
    netField.style.transform = 'scale(1.05)';
    setTimeout(() => {
        netField.style.transform = 'scale(1)';
    }, 200);

    // Auto-save after calculation
    saveToLocalStorage();
}

// ---------- Data Collection & Summary ----------
function collectTableData() {
    const table = document.getElementById('dataTable');
    const headers = [];
    const rows = [];

    // Get headers
    const headerCells = table.querySelectorAll('thead th');
    headerCells.forEach(header => headers.push(header.textContent));

    // Get data rows
    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');

        cells.forEach((cell, index) => {
            if (index === 3) {
                // Expenses cell
                const expenses = [];
                const expenseItems = cell.querySelectorAll('.expense-item');
                expenseItems.forEach(item => {
                    const amountInput = item.querySelector('input[type="number"]');
                    const descInput = item.querySelector('input[type="text"]');
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
    const branchName = document.getElementById('branchName').value;
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
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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
    const branchName = document.getElementById('branchName').value;
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
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
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
    const branchName = document.getElementById('branchName').value;
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
    if (existingNotification) {
        existingNotification.remove();
    }

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

    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ---------- Render from Saved Data ----------
function renderTableFromData(tableData) {
    const tbody = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    tableData.rows.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-row', i);

        // Date (as type="date")
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

    // Update rowCounter
    rowCounter = tableData.rows.length;

    // Bind save events
    tbody.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
        input.addEventListener('input', saveToLocalStorage);
    });
}
