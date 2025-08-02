async function verifyAuthentication() {
    const token = localStorage.getItem('access_token');
    const userType = localStorage.getItem('user_type');

    if (!token || userType !== 'client') {
        throw new Error('No valid authentication tokens found');
    }

    try {
        const response = await fetch('http://10.2.43.224:8000/clients/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const userData = await response.json();
        localStorage.setItem('user_id', userData.client_id); // Store client ID for later use
        return userData;
    } catch (error) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_type');
        localStorage.removeItem('user_id');
        throw error;
    }
}

function displayUserInfo(userData) {
    const profilePicture = document.getElementById('profilePicture');
    const userName = document.getElementById('userName');

    if (userData.profile_picture_url) {
        profilePicture.src = userData.profile_picture_url;
    } else {
        profilePicture.src = '/assets/profile-placeholder.png';
    }
    userName.textContent = `${userData.name} ${userData.surname}`;
}

function redirectToLogin() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_type');
    localStorage.removeItem('user_id');
    window.location.href = '/index.html';
}

function highlightActiveTab() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
        li.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
        if (a.getAttribute('href') === currentPath) {
            a.parentElement.classList.add('active');
        }
    });
}

// Loading and error states
function showLoading(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <tr>
                <td colspan="${elementId === 'pendingPayments' ? 7 : 8}" class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>${message}</span>
                </td>
            </tr>
        `;
    }
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <tr>
                <td colspan="${elementId === 'pendingPayments' ? 7 : 8}" class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${message}</span>
                </td>
            </tr>
        `;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    verifyAuthentication()
        .then(userData => {
            displayUserInfo(userData);
            highlightActiveTab();
            loadPayments();
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });
});

async function loadPayments() {
    try {
        await loadPendingPayments();
        await loadPaymentHistory();
    } catch (error) {
        console.error('Error loading payments:', error);
        showToast('Failed to load payment data', 'error');
    }
}

async function loadPendingPayments() {
    try {
        showLoading('pendingPayments', 'Loading pending payments...');
        const token = localStorage.getItem('access_token');
        const clientId = localStorage.getItem('user_id');

        const response = await fetch(`http://10.2.43.224:8000/bookings/payable/${clientId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to load pending payments');
        }

        const bookings = await response.json();
        console.log('Payable bookings:', bookings); // Debug log

        displayPendingPayments(bookings);
    } catch (error) {
        console.error('Error loading pending payments:', error);
        showError('pendingPayments', error.message || 'Failed to load pending payments');
        showToast('Failed to load pending payments', 'error');
    }
}

function displayPendingPayments(bookings) {
    const container = document.getElementById('pendingPayments');
    container.innerHTML = '';

    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <span>No pending payments</span>
                </td>
            </tr>
        `;
        return;
    }

    bookings.forEach(booking => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${booking.booking_id}</td>
            <td>${booking.service_type}</td>
            <td>${booking.technician_name || 'N/A'} ${booking.technician_surname || ''}</td>
            <td>R${booking.price?.toFixed(2) || '0.00'}</td>
            <td>${formatDate(booking.end_date || booking.created_at)}</td>
            <td><span class="status-badge status-${booking.status}">${formatStatus(booking.status)}</span></td>
            <td>
                <button class="btn btn-primary" onclick="initiatePayment('${booking.booking_id}', ${booking.price || 0})">
                    <i class="fas fa-credit-card"></i> Pay Now
                </button>
            </td>
        `;
        container.appendChild(row);
    });
}

async function loadPaymentHistory() {
    try {
        showLoading('paymentHistory', 'Loading payment history...');
        const token = localStorage.getItem('access_token');
        const clientId = localStorage.getItem('user_id');

        const response = await fetch(`http://10.2.43.224:8000/payments/client/${clientId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load payment history');
        }

        let payments = await response.json();
        payments = payments.filter(payment => payment.payment_status === 'completed');

        displayPaymentHistory(payments);
    } catch (error) {
        console.error('Error loading payment history:', error);
        showError('paymentHistory', error.message || 'Failed to load payment history');
        showToast('Failed to load payment history', 'error');
    }
}


function displayPaymentHistory(payments) {
    const container = document.getElementById('paymentHistory');
    container.innerHTML = '';

    if (!payments || payments.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-history"></i>
                    <span>No payment history found</span>
                </td>
            </tr>
        `;
        return;
    }

    payments.forEach(payment => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${payment.payment_id}</td>
            <td>${formatDate(payment.transaction_date)}</td>
            <td>${payment.booking_id}</td>
            <td>${payment.service_type}</td>
            <td>R${payment.amount?.toFixed(2) || '0.00'}</td>
            <td>${formatPaymentMethod(payment.payment_method) || 'Not specified'}</td>
            <td><span class="status-badge status-${payment.payment_status}">${formatStatus(payment.payment_status)}</span></td>
            <td>
                <button class="btn btn-secondary" onclick="viewReceipt('${payment.payment_id}')">
                    <i class="fas fa-receipt"></i> View
                </button>
            </td>
        `;
        container.appendChild(row);
    });
}

window.initiatePayment = async function (bookingId, amount) {
    try {
        const token = localStorage.getItem('access_token');

        openPaymentModal(`
            <h2>Process Payment</h2>
            <div class="payment-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Preparing payment of R${amount.toFixed(2)}...</p>
            </div>
        `);

        // Quick validation
        if (!bookingId || !amount) {
            throw new Error('Invalid payment details');
        }

        // Show simplified payment form with only required fields
        showPaymentForm(bookingId, amount);
    } catch (error) {
        console.error('Payment initiation error:', error);
        showToast(error.message || 'Failed to initiate payment', 'error');
        closePaymentModal();
    }
};

function showPaymentForm(bookingId, amount) {
    const modalBody = `
        <h2>Complete Payment</h2>
        <div class="payment-summary">
            <p><strong>Amount Due:</strong> R${amount.toFixed(2)}</p>
            <p><strong>Booking ID:</strong> ${bookingId}</p>
        </div>
        
        <form id="paymentForm" onsubmit="processPayment(event, '${bookingId}', ${amount})">
            <div class="form-group">
                <label>Payment Method</label>
                <div class="payment-methods">
                    <label class="payment-method">
                        <input type="radio" name="paymentMethod" value="card" checked required>
                        <i class="fab fa-cc-visa"></i>
                        <i class="fab fa-cc-mastercard"></i>
                        Credit/Debit Card
                    </label>
                    <label class="payment-method">
                        <input type="radio" name="paymentMethod" value="banking" required>
                        <i class="fas fa-university"></i>
                        Bank Transfer
                    </label>
                </div>
            </div>
            
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-lock"></i> Pay R${amount.toFixed(2)}
            </button>
        </form>
    `;

    document.getElementById('paymentModalBody').innerHTML = modalBody;
}

window.processPayment = async function (e, bookingId, amount) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const token = localStorage.getItem('access_token');
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

        const response = await fetch('http://10.2.43.224:8000/payments/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                booking_id: bookingId,
                amount: amount,
                payment_method: paymentMethod
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Payment failed');
        }

        showToast('Payment completed successfully!', 'success');
        closePaymentModal();
        
        // Refresh payments list if the function exists
        if (typeof loadPayments === 'function') {
            loadPayments();
        }
    } catch (error) {
        console.error('Payment error:', error);
        showToast(error.message || 'Payment failed. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-lock"></i> Try Again';
    }
};

window.viewReceipt = async function (paymentId) {
    try {
        const token = localStorage.getItem('access_token');

        // First validate payment exists and belongs to user
        const paymentResponse = await fetch(`http://10.2.43.224:8000/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!paymentResponse.ok) {
            throw new Error('Payment not found or access denied');
        }

        // Then download the receipt
        const receiptResponse = await fetch(`http://10.2.43.224:8000/payments/${paymentId}/receipt`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!receiptResponse.ok) {
            throw new Error('Failed to generate receipt');
        }

        // Create download link
        const blob = await receiptResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${paymentId}.pdf`;
        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Error viewing receipt:', error);
        showToast(error.message || 'Failed to download receipt', 'error');
    }
};

window.downloadReceipt = async function (paymentId) {
    try {
        const token = localStorage.getItem('access_token');
        const downloadBtn = document.querySelector(`button[onclick="downloadReceipt('${paymentId}')"]`);

        const originalText = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        const response = await fetch(`http://10.2.43.224:8000/payments/${paymentId}/receipt`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(await response.text() || 'Failed to generate receipt');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${paymentId}.pdf`;
        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast('Receipt downloaded successfully', 'success');
    } catch (error) {
        console.error('Receipt download error:', error);
        showToast(error.message || 'Failed to download receipt', 'error');
    } finally {
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }
    }
};

// Helper functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatStatus(status) {
    const statusMap = {
        'completed': 'Completed',
        'pending': 'Pending',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'confirmed': 'Confirmed',
        'cancelled': 'Cancelled'
    };
    return statusMap[status?.toLowerCase()] || status;
}

function formatPaymentMethod(method) {
    const methodMap = {
        'card': 'Credit Card',
        'bank': 'Bank Transfer',
        'cash': 'Cash'
    };
    return methodMap[method?.toLowerCase()] || method;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);

    toast.querySelector('.toast-close').onclick = () => toast.remove();
}

function openPaymentModal(content) {
    document.getElementById('paymentModalBody').innerHTML = content;
    document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
}