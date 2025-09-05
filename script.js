let rowCounter = 2; // Start from 2 since we have 2 initial rows

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reportDate').value = today;
    
    // Calculate initial net values
    calculateNet(0);
    calculateNet(1);
    
    // Add event listeners for better interactivity
    setupEventListeners();
    
    console.log('تم تحميل مولد PDF للجداول بنجاح - Harvey Edition');
});

function setupEventListeners() {
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            generatePDF();
        }
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            previewTable();
        }
    });
    
    // Auto-save to localStorage
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
    });
    
    // Load from localStorage
    loadFromLocalStorage();
}

function saveToLocalStorage() {
    try {
        const data = {
            branch: document.getElementById('branchName').value,
            title: document.getElementById('reportTitle').value,
            date: document.getElementById('reportDate').value,
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
        }
    } catch (e) {
        console.log('Could not load from localStorage');
    }
}

function addRow() {
    const table = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    const newRow = table.insertRow();
    newRow.setAttribute('data-row', rowCounter);
    
    // Add cells with input fields for new columns
    const cells = [
        '<input type="text" placeholder="التاريخ">',
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
        if (index === 3) { // Expenses cell
            cell.className = 'expenses-cell';
        }
        cell.innerHTML = cellContent;
    });
    
    rowCounter++;
    
    // Add event listeners to new inputs
    newRow.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
    });
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
                <td><input type="text" placeholder="التاريخ"></td>
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
        
        // Re-add event listeners
        document.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', saveToLocalStorage);
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
    
    // Add event listeners to new inputs
    newExpenseItem.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', saveToLocalStorage);
    });
    
    // Focus on the amount input
    const amountInput = newExpenseItem.querySelector('input[type="number"]');
    setTimeout(() => amountInput.focus(), 100);
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

function calculateNet(rowIndex) {
    const row = document.querySelector(`tr[data-row="${rowIndex}"]`);
    if (!row) return;
    
    const morningShift = parseFloat(row.cells[1].querySelector('input').value) || 0;
    const eveningShift = parseFloat(row.cells[2].querySelector('input').value) || 0;
    
    // Calculate total expenses
    const expensesContainer = document.getElementById(`expenses-${rowIndex}`);
    let totalExpenses = 0;
    
    if (expensesContainer) {
        const expenseInputs = expensesContainer.querySelectorAll('.expense-item input[type="number"]');
        expenseInputs.forEach(input => {
            totalExpenses += parseFloat(input.value) || 0;
        });
    }
    
    // Calculate net: (morning + evening) - total expenses
    const net = morningShift + eveningShift - totalExpenses;
    
    // Update net field
    const netField = row.cells[4].querySelector('input');
    netField.value = net;
    
    // Add visual feedback for the calculation
    netField.style.color = net >= 0 ? '#27ae60' : '#e74c3c';
    
    // Add animation effect
    netField.style.transform = 'scale(1.05)';
    setTimeout(() => {
        netField.style.transform = 'scale(1)';
    }, 200);
}

function collectTableData() {
    const table = document.getElementById('dataTable');
    const headers = [];
    const rows = [];
    
    // Get headers
    const headerCells = table.querySelectorAll('thead th');
    headerCells.forEach(header => {
        headers.push(header.textContent);
    });
    
    // Get data rows
    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');
        
        cells.forEach((cell, index) => {
            if (index === 3) { // Expenses cell
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
        
        // Calculate expenses for this row
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

function previewTable() {
    const branchName = document.getElementById('branchName').value;
    const reportTitle = document.getElementById('reportTitle').value;
    const reportDate = document.getElementById('reportDate').value;
    const tableData = collectTableData();
    const summary = calculateSummary(tableData);
    
    if (tableData.rows.length === 0 || !tableData.rows.some(row => row.some(cell => cell && cell !== '0'))) {
        showNotification('يرجى إدخال بعض البيانات أولاً', 'warning');
        return;
    }
    
    const previewHtml = createPDFTemplate(branchName, reportTitle, reportDate, tableData, summary);
    
    document.getElementById('pdfPreview').innerHTML = previewHtml;
    document.getElementById('preview').style.display = 'block';
    
    // Scroll to preview
    document.getElementById('preview').scrollIntoView({ behavior: 'smooth' });
    
    showNotification('تم إنشاء المعاينة بنجاح', 'success');
}

function closePreview() {
    document.getElementById('preview').style.display = 'none';
}

function formatDate(dateString) {
    if (!dateString) return new Date().toLocaleDateString('ar-EG');
    const date = new Date(dateString);
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
                <div class="pdf-branch">${branchName}</div>\
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
    const reportDate = document.getElementById('reportDate').value;
    const tableData = collectTableData();
    const summary = calculateSummary(tableData);
    
    if (tableData.rows.length === 0 || !tableData.rows.some(row => row.some(cell => cell && cell !== '0'))) {
        showNotification('يرجى إدخال بعض البيانات أولاً', 'warning');
        return;
    }
    
    // Show loading indicator
    const generateBtn = document.querySelector('.generate-btn');
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">جاري إنشاء PDF...</span>';
    generateBtn.disabled = true;
    
    // Create a temporary container for the PDF content
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = createPDFTemplate(branchName, reportTitle, reportDate, tableData, summary);
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.background = 'white';
    tempContainer.style.width = '800px';
    tempContainer.style.fontFamily = 'Tajawal, Arial, sans-serif';
    document.body.appendChild(tempContainer);
    
    try {
        // Wait for SVG to render
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Generate PDF using html2canvas and jsPDF
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
        
        // Add image to PDF
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        // Add new pages if content is longer than one page
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        // Save the PDF
        const formattedDate = new Date(reportDate).toLocaleDateString('ar-EG').replace(/\//g, '-');
        const fileName = `${reportTitle}_${branchName}_${formattedDate}.pdf`;
        pdf.save(fileName);
        
        // Show success message
        showNotification('تم إنشاء ملف PDF بنجاح!', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showNotification('حدث خطأ أثناء إنشاء ملف PDF. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
        // Clean up
        document.body.removeChild(tempContainer);
        generateBtn.innerHTML = originalText;
        generateBtn.disabled = false;
    }
}

function exportToExcel() {
    const branchName = document.getElementById('branchName').value;
    const reportTitle = document.getElementById('reportTitle').value;
    const reportDate = document.getElementById('reportDate').value;
    const tableData = collectTableData();
    
    if (tableData.rows.length === 0 || !tableData.rows.some(row => row.some(cell => cell && cell !== '0'))) {
        showNotification('يرجى إدخال بعض البيانات أولاً', 'warning');
        return;
    }
    
    // Create CSV content
    let csvContent = `\uFEFF${reportTitle} - ${branchName}\n`;
    csvContent += `تاريخ التقرير: ${formatDate(reportDate)}\n\n`;
    
    // Add headers
    csvContent += tableData.headers.join(',') + '\n';
    
    // Add data rows
    tableData.rows.forEach(row => {
        const csvRow = [];
        row.forEach((cell, index) => {
            if (index === 3 && Array.isArray(cell)) {
                // Format expenses for CSV
                const expensesText = cell.map(exp => `${exp.amount}:${exp.description}`).join(';');
                csvRow.push(`"${expensesText}"`);
            } else {
                csvRow.push(cell);
            }
        });
        csvContent += csvRow.join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reportTitle}_${branchName}_${new Date(reportDate).toLocaleDateString('ar-EG').replace(/\//g, '-')}.csv`;
    link.click();
    
    showNotification('تم تصدير ملف Excel بنجاح!', 'success');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification
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
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}