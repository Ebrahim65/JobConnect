let notifications = [];
let currentFilter = 'all';
let incomeChart, paymentStatusChart, earningsChart;
let transactionsCurrentPage = 1;
const transactionsPerPage = 10;
let transactionsTotal = 0;
let dateFilter = {
    startDate: null,
    endDate: null
};

// Initialize notifications
async function initNotifications() {
    await loadNotifications();
    updateUnreadCount();
    setInterval(updateUnreadCount, 60000); // Update count every minute
}

// Load notifications from API
async function loadNotifications() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/notifications/?status=${currentFilter}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load notifications');
        }

        notifications = await response.json();
        renderNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
        showToast('Failed to load notifications', 'error');
    }
}

// Render notifications in the dropdown
function renderNotifications() {
    const notificationList = document.getElementById('notificationList');

    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications found</p>
            </div>
        `;
        return;
    }

    notificationList.innerHTML = '';
    notifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.is_read ? '' : 'unread'}`;
        notificationItem.innerHTML = `
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${formatTime(notification.created_at)}</div>
        `;
        notificationItem.onclick = () => handleNotificationClick(notification.notification_id);
        notificationList.appendChild(notificationItem);
    });
}

// Format time for display
function formatTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Toggle notification dropdown
function toggleNotifications() {
    const dropdown = document.querySelector('.notification-dropdown');
    dropdown.classList.toggle('show');

    if (dropdown.classList.contains('show')) {
        loadNotifications();
    }
}

// Filter notifications
function filterNotifications() {
    currentFilter = document.getElementById('notificationFilter').value;
    loadNotifications();
}

// Handle notification click
async function handleNotificationClick(notificationId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/notifications/${notificationId}/mark-read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to mark notification as read');
        }

        // Update UI
        const notification = notifications.find(n => n.notification_id === notificationId);
        if (notification) {
            notification.is_read = true;
            renderNotifications();
            updateUnreadCount();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Mark all notifications as read
async function markAllAsRead() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/notifications/mark-all-read', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to mark all notifications as read');
        }

        // Update UI
        notifications.forEach(notification => {
            notification.is_read = true;
        });
        renderNotifications();
        updateUnreadCount();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showToast('Failed to mark all as read', 'error');
    }
}

// View all notifications (redirect to notifications page)
function viewAllNotifications() {
    window.location.href = '/notifications.html';
}

// Update unread count badge
async function updateUnreadCount() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/notifications/unread/count', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get unread count');
        }

        const data = await response.json();
        const unreadCount = document.getElementById('unreadCount');
        unreadCount.textContent = data.count || '0';
        unreadCount.style.display = data.count > 0 ? 'block' : 'none';
    } catch (error) {
        console.error('Error updating unread count:', error);
    }
}

// Format currency for ZAR (South African Rand)
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 2
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Format date for API (YYYY-MM-DD)
function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
}

// Load income data
async function loadIncomeData() {
    try {
        const token = localStorage.getItem('access_token');
        let url = 'http://10.2.43.224:8000/income/me';

        // Add date filters if they exist
        if (dateFilter.startDate || dateFilter.endDate) {
            url += '?';
            if (dateFilter.startDate) url += `start_date=${dateFilter.startDate}`;
            if (dateFilter.endDate) url += `${dateFilter.startDate ? '&' : ''}end_date=${dateFilter.endDate}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load income data');
        }

        const incomeData = await response.json();
        updateIncomeUI(incomeData);
        createCharts(incomeData);

        // Load earnings over time data for the time series chart
        loadEarningsOverTime();
    } catch (error) {
        console.error('Error loading income data:', error);
        showToast('Failed to load income data', 'error');
    }
}

// Load earnings over time data
async function loadEarningsOverTime() {
    try {
        const token = localStorage.getItem('access_token');
        let url = 'http://10.2.43.224:8000/income/earnings-over-time';

        if (dateFilter.startDate || dateFilter.endDate) {
            url += '?';
            if (dateFilter.startDate) url += `start_date=${dateFilter.startDate}`;
            if (dateFilter.endDate) url += `${dateFilter.startDate ? '&' : ''}end_date=${dateFilter.endDate}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load earnings over time data');
        }

        const earningsData = await response.json();

        // Ensure dates are properly formatted
        const formattedData = earningsData.map(item => ({
            date: item.date,  // Should already be YYYY-MM-DD from backend
            amount: item.amount
        }));

        createEarningsChart(formattedData);
    } catch (error) {
        console.error('Error loading earnings over time data:', error);
    }
}

// Update UI with income data
function updateIncomeUI(data) {
    document.getElementById('totalIncome').textContent = formatCurrency(data.total_income || 0);
    document.getElementById('completedIncome').textContent = formatCurrency(data.completed_income || 0);
    document.getElementById('pendingIncome').textContent = formatCurrency(data.pending_income || 0);
    document.getElementById('failedIncome').textContent = formatCurrency(data.failed_income || 0);
    document.getElementById('refundedIncome').textContent = formatCurrency(data.refunded_income || 0);
    document.getElementById('totalPayments').textContent = data.total_payments || 0;
    document.getElementById('firstPaymentDate').textContent = formatDate(data.first_payment_date);
    document.getElementById('lastPaymentDate').textContent = formatDate(data.last_payment_date);
}

// Create charts
function createCharts(data) {
    const ctx1 = document.getElementById('incomeDistributionChart').getContext('2d');
    const ctx2 = document.getElementById('paymentStatusChart').getContext('2d');

    // Destroy existing charts if they exist
    if (incomeChart) incomeChart.destroy();
    if (paymentStatusChart) paymentStatusChart.destroy();

    // Income Distribution Chart (Doughnut)
    incomeChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending', 'Failed', 'Refunded'],
            datasets: [{
                data: [
                    data.completed_income || 0,
                    data.pending_income || 0,
                    data.failed_income || 0,
                    data.refunded_income || 0
                ],
                backgroundColor: [
                    '#4facfe',
                    '#f6d365',
                    '#f5576c',
                    '#a0aec0'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    });

    // Payment Status Chart (Bar)
    paymentStatusChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Completed', 'Pending', 'Failed', 'Refunded'],
            datasets: [{
                label: 'Payment Count',
                data: [
                    data.completed_payments || 0,
                    data.pending_payments || 0,
                    data.failed_payments || 0,
                    data.refunded_payments || 0
                ],
                backgroundColor: [
                    '#4facfe',
                    '#f6d365',
                    '#f5576c',
                    '#a0aec0'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.parsed.y} payments`;
                        }
                    }
                }
            }
        }
    });
}

// Create earnings over time chart
function createEarningsChart(data) {
    const ctx = document.getElementById('earningsOverTimeChart').getContext('2d');

    if (earningsChart) earningsChart.destroy();

    // Prepare labels and data
    const labels = data.map(item => item.date);
    const earningsData = data.map(item => item.amount);

    earningsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Earnings',
                data: earningsData,
                backgroundColor: 'rgba(79, 172, 254, 0.2)',
                borderColor: '#4facfe',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Earnings: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM d, yyyy',
                        displayFormats: {
                            day: 'MMM d'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Load transactions data
async function loadTransactions() {
    const tableBody = document.getElementById('transactionsTable').querySelector('tbody');
    const loadingElement = document.getElementById('transactionsLoading');
    const emptyElement = document.getElementById('transactionsEmpty');

    tableBody.innerHTML = '';
    loadingElement.style.display = 'block';
    emptyElement.style.display = 'none';

    try {
        const token = localStorage.getItem('access_token');
        let url = `http://10.2.43.224:8000/income/transactions?page=${transactionsCurrentPage}&per_page=${transactionsPerPage}`;

        if (dateFilter.startDate) {
            url += `&start_date=${dateFilter.startDate}`;
        }
        if (dateFilter.endDate) {
            url += `&end_date=${dateFilter.endDate}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load transactions');
        }

        const data = await response.json();
        transactionsTotal = data.total_transactions;

        if (data.transactions.length === 0) {
            emptyElement.style.display = 'block';
        } else {
            data.transactions.forEach(transaction => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${formatDate(transaction.payment_date)}</td>
                    <td>${transaction.job_id?.substring(0, 8) || 'N/A'}</td>
                    <td>${transaction.client_name || 'Unknown Client'}</td>
                    <td>${formatCurrency(transaction.amount)}</td>
                    <td><span class="status-badge status-${transaction.status.toLowerCase()}">${transaction.status}</span></td>
                    <td>${transaction.payment_type || 'Unknown'}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        updateTransactionsPagination();
    } catch (error) {
        console.error('Error loading transactions:', error);
        showToast('Failed to load transactions', 'error');
        emptyElement.style.display = 'block';
    } finally {
        loadingElement.style.display = 'none';
    }
}

// Update transactions pagination
function updateTransactionsPagination() {
    const pagination = document.getElementById('transactionsPagination');
    pagination.innerHTML = '';

    const totalPages = Math.ceil(transactionsTotal / transactionsPerPage);
    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = transactionsCurrentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (transactionsCurrentPage > 1) {
            transactionsCurrentPage--;
            loadTransactions();
        }
    });
    pagination.appendChild(prevBtn);

    // Page buttons
    const maxVisiblePages = 5;
    let startPage = Math.max(1, transactionsCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.className = 'page-btn';
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => {
            transactionsCurrentPage = 1;
            loadTransactions();
        });
        pagination.appendChild(firstBtn);

        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === transactionsCurrentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            transactionsCurrentPage = i;
            loadTransactions();
        });
        pagination.appendChild(pageBtn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }

        const lastBtn = document.createElement('button');
        lastBtn.className = 'page-btn';
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener('click', () => {
            transactionsCurrentPage = totalPages;
            loadTransactions();
        });
        pagination.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = transactionsCurrentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (transactionsCurrentPage < totalPages) {
            transactionsCurrentPage++;
            loadTransactions();
        }
    });
    pagination.appendChild(nextBtn);
}

// Export to CSV
async function exportToCSV() {
    try {
        const token = localStorage.getItem('access_token');
        let url = 'http://10.2.43.224:8000/income/export/csv';

        if (dateFilter.startDate || dateFilter.endDate) {
            url += '?';
            if (dateFilter.startDate) url += `start_date=${dateFilter.startDate}`;
            if (dateFilter.endDate) url += `${dateFilter.startDate ? '&' : ''}end_date=${dateFilter.endDate}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to export CSV');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `income_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        showToast('CSV export started', 'success');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast('Failed to export CSV', 'error');
    }
}

// Export to PDF
async function exportToPDF() {
    try {
        showToast('Preparing PDF report...', 'info');

        const token = localStorage.getItem('access_token');
        let url = 'http://10.2.43.224:8000/income/export/pdf';

        if (dateFilter.startDate || dateFilter.endDate) {
            url += '?';
            if (dateFilter.startDate) url += `start_date=${dateFilter.startDate}`;
            if (dateFilter.endDate) url += `${dateFilter.startDate ? '&' : ''}end_date=${dateFilter.endDate}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to export PDF');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `income_report_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        showToast('PDF export completed', 'success');
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showToast('Failed to export PDF', 'error');
    }
}

// Initialize date filters
function initDateFilters() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const applyBtn = document.getElementById('applyDateFilter');
    const resetBtn = document.getElementById('resetDateFilter');

    // Set default dates (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    endDateInput.valueAsDate = endDate;
    startDateInput.valueAsDate = startDate;

    dateFilter = {
        startDate: formatDateForAPI(startDate),
        endDate: formatDateForAPI(endDate)
    };

    applyBtn.addEventListener('click', () => {
        const start = startDateInput.valueAsDate;
        const end = endDateInput.valueAsDate;

        if (start && end && start > end) {
            showToast('Start date cannot be after end date', 'error');
            return;
        }

        dateFilter = {
            startDate: start ? formatDateForAPI(start) : null,
            endDate: end ? formatDateForAPI(end) : null
        };

        transactionsCurrentPage = 1;
        loadTransactions();
        loadIncomeData(); // Reload charts with filtered data
    });

    resetBtn.addEventListener('click', () => {
        startDateInput.valueAsDate = startDate;
        endDateInput.valueAsDate = endDate;
        dateFilter = {
            startDate: formatDateForAPI(startDate),
            endDate: formatDateForAPI(endDate)
        };
        transactionsCurrentPage = 1;
        loadTransactions();
        loadIncomeData();
    });
}

function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease-out;
    `;

    // Set background color based on type
    const typeColors = {
        success: '#4CAF50',
        error: '#F44336',
        info: '#2196F3',
        warning: '#FF9800'
    };
    toast.style.backgroundColor = typeColors[type] || typeColors.info;

    // Add icon based on type
    const typeIcons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    toast.innerHTML = `
        <i class="fas ${typeIcons[type] || typeIcons.info}"></i>
        <span>${message}</span>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Auto-remove after delay
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);

    // Add click to dismiss
    toast.onclick = () => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    };
}

function displayTechnicianInfo(techData) {
    const profilePicture = document.getElementById('profilePicture');
    const userName = document.getElementById('userName');

    if (techData.profile_picture_url) {
        profilePicture.src = techData.profile_picture_url;
    } else {
        profilePicture.src = '/assets/profile-placeholder.png';
    }

    userName.textContent = `${techData.name} ${techData.surname || ''}`;
}

function redirectToLogin() {
    // Clear any remaining tokens
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_type');
    window.location.href = '/index.html';
}

function highlightActiveTab() {
    // Get current page path
    const currentPath = window.location.pathname;

    // Remove active class from all tabs
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
        li.classList.remove('active');
    });

    // Find matching tab and add active class
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
        if (a.getAttribute('href') === currentPath) {
            a.parentElement.classList.add('active');
        }
    });
}

async function verifyTechnicianAuthentication() {
    const token = localStorage.getItem('access_token');
    const userType = localStorage.getItem('user_type');

    // Basic checks first
    if (!token || userType !== 'technician') {
        throw new Error('No valid authentication tokens found');
    }

    try {
        // Verify with backend
        const response = await fetch('http://10.2.43.224:8000/technicians/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        // Clear invalid tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_type');
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // First verify authentication
    verifyTechnicianAuthentication()
        .then(techData => {
            initNotifications();
            displayTechnicianInfo(techData);
            initDateFilters();
            loadIncomeData();
            loadTransactions();
            highlightActiveTab();

            // Set up export buttons
            document.getElementById('exportCSV').addEventListener('click', exportToCSV);
            document.getElementById('exportPDF').addEventListener('click', exportToPDF);

            // Initialize earnings chart container if it doesn't exist
            if (!document.getElementById('earningsOverTimeChart')) {
                const earningsChartContainer = document.createElement('div');
                earningsChartContainer.className = 'chart-container';
                earningsChartContainer.innerHTML = `
                    <h3>Earnings Over Time</h3>
                    <canvas id="earningsOverTimeChart"></canvas>
                `;
                document.querySelector('.income-charts').appendChild(earningsChartContainer);
            }
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });
});