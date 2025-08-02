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

// Technician Settings Page JavaScript
let technicianData = {};
let workingHours = {};
let timeOffEntries = [];
let paymentMethods = [];

// Tab switching
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Load technician profile data
async function loadTechnicianProfile() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load profile data');
        technicianData = await response.json();
        populateProfileForm();
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Failed to load profile data', 'error');
    }
}

// Populate profile form with data
function populateProfileForm() {
    document.getElementById('firstName').value = technicianData.name || '';
    document.getElementById('lastName').value = technicianData.surname || '';
    document.getElementById('email').value = technicianData.email || '';
    document.getElementById('phone').value = technicianData.phone_number || '';
    document.getElementById('location').value = technicianData.location_name || '';
    document.getElementById('about').value = technicianData.about_me || '';
    document.getElementById('experience').value = technicianData.experience_years || '';

    const profilePic = document.getElementById('profilePicturePreview');
    if (technicianData.profile_picture_url) {
        profilePic.src = technicianData.profile_picture_url;
        profilePic.style.display = 'block';
    } else {
        profilePic.style.display = 'none';
    }
}

// Handle profile picture upload
document.getElementById('profilePictureUpload').addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/upload-picture', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload profile picture');

        const result = await response.json();
        technicianData.profile_picture_url = result.url;

        const profilePic = document.getElementById('profilePicturePreview');
        profilePic.src = result.url;
        profilePic.style.display = 'block';
        showToast('Profile picture updated successfully', 'success');
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        showToast('Failed to upload profile picture', 'error');
    }
});

// Remove profile picture
document.getElementById('removeProfilePicture').addEventListener('click', async function () {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ profile_picture_url: null })
        });

        if (!response.ok) throw new Error('Failed to remove profile picture');

        technicianData.profile_picture_url = null;
        const profilePic = document.getElementById('profilePicturePreview');
        profilePic.style.display = 'none';
        showToast('Profile picture removed', 'success');
    } catch (error) {
        console.error('Error removing profile picture:', error);
        showToast('Failed to remove profile picture', 'error');
    }
});

// Save profile changes
document.getElementById('profileForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: document.getElementById('firstName').value,
                surname: document.getElementById('lastName').value,
                phone_number: document.getElementById('phone').value,
                location_name: document.getElementById('location').value,
                about_me: document.getElementById('about').value,
                experience_years: parseFloat(document.getElementById('experience').value) || 0
            })
        });

        if (!response.ok) throw new Error('Failed to update profile');
        await loadTechnicianProfile();
        showToast('Profile updated successfully', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Failed to update profile', 'error');
    }
});

// Load services
async function loadServices() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/services', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load services');
        const services = await response.json();
        renderServices(services);
    } catch (error) {
        console.error('Error loading services:', error);
        showToast('Failed to load services', 'error');
    }
}

// Render services list
function renderServices(services) {
    const container = document.getElementById('servicesList');

    if (services.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tools"></i>
                <p>No services added yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    services.forEach(service => {
        const serviceElement = document.createElement('div');
        serviceElement.className = 'service-item';
        serviceElement.innerHTML = `
            <span class="service-name">${service.name}</span>
            <button class="btn-delete" onclick="deleteService('${service.name}')">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(serviceElement);
    });
}

// Add new service
document.getElementById('addServiceForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const serviceName = document.getElementById('newService').value.trim();
    if (!serviceName) return;

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/services', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: serviceName })
        });

        if (!response.ok) throw new Error('Failed to add service');
        document.getElementById('newService').value = '';
        await loadServices();
        showToast('Service added successfully', 'success');
    } catch (error) {
        console.error('Error adding service:', error);
        showToast('Failed to add service', 'error');
    }
});

// Delete service
async function deleteService(serviceName) {
    if (!confirm(`Are you sure you want to remove "${serviceName}" from your services?`)) return;

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/technicians/me/services/${encodeURIComponent(serviceName)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete service');
        await loadServices();
        showToast('Service removed', 'success');
    } catch (error) {
        console.error('Error deleting service:', error);
        showToast('Failed to remove service', 'error');
    }
}

// Load working hours
async function loadWorkingHours() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/working-hours', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load working hours');
        workingHours = await response.json();
        populateWorkingHoursForm();
    } catch (error) {
        console.error('Error loading working hours:', error);
        showToast('Failed to load working hours', 'error');
    }
}

// Populate working hours form
function populateWorkingHoursForm() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
        if (workingHours[day]) {
            document.getElementById(`${day}Start`).value = workingHours[day].start;
            document.getElementById(`${day}End`).value = workingHours[day].end;
        } else {
            document.getElementById(`${day}Start`).value = '';
            document.getElementById(`${day}End`).value = '';
        }
    });
}

// Save working hours
document.getElementById('workingHoursForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const hours = {
        monday: getDayHours('monday'),
        tuesday: getDayHours('tuesday'),
        wednesday: getDayHours('wednesday'),
        thursday: getDayHours('thursday'),
        friday: getDayHours('friday'),
        saturday: getDayHours('saturday'),
        sunday: getDayHours('sunday')
    };

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/working-hours', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(hours)
        });

        if (!response.ok) throw new Error('Failed to update working hours');

        const isAvailable = document.getElementById('isAvailable').checked;
        await fetch('http://10.2.43.224:8000/technicians/me/availability', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_available: isAvailable })
        });

        showToast('Working hours updated successfully', 'success');
    } catch (error) {
        console.error('Error updating working hours:', error);
        showToast('Failed to update working hours', 'error');
    }
});

function getDayHours(day) {
    return {
        start: document.getElementById(`${day}Start`).value,
        end: document.getElementById(`${day}End`).value
    };
}

// Load time off entries
async function loadTimeOffEntries() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/time-off', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load time off entries');
        timeOffEntries = await response.json();
        renderTimeOffEntries();
    } catch (error) {
        console.error('Error loading time off entries:', error);
        showToast('Failed to load time off entries', 'error');
    }
}

// Render time off entries
function renderTimeOffEntries() {
    const container = document.getElementById('timeOffList');

    if (timeOffEntries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>No time off scheduled</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    timeOffEntries.forEach(entry => {
        const startDate = new Date(entry.start_date);
        const endDate = new Date(entry.end_date);

        const entryElement = document.createElement('div');
        entryElement.className = 'time-off-entry';
        entryElement.innerHTML = `
            <div class="entry-dates">
                ${formatDate(startDate)} - ${formatDate(endDate)}
            </div>
            <button class="btn-delete" onclick="deleteTimeOffEntry('${entry.id}')">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(entryElement);
    });
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Add time off entry
document.getElementById('timeOffForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const startDate = document.getElementById('timeOffStart').value;
    const endDate = document.getElementById('timeOffEnd').value;

    if (!startDate || !endDate) {
        showToast('Please select both start and end dates', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/time-off', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ start_date: startDate, end_date: endDate })
        });

        if (!response.ok) throw new Error('Failed to add time off entry');

        document.getElementById('timeOffStart').value = '';
        document.getElementById('timeOffEnd').value = '';
        await loadTimeOffEntries();
        showToast('Time off added successfully', 'success');
    } catch (error) {
        console.error('Error adding time off:', error);
        showToast('Failed to add time off', 'error');
    }
});

// Delete time off entry
async function deleteTimeOffEntry(entryId) {
    if (!confirm('Are you sure you want to delete this time off entry?')) return;

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/technicians/me/time-off/${entryId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete time off entry');
        await loadTimeOffEntries();
        showToast('Time off entry deleted', 'success');
    } catch (error) {
        console.error('Error deleting time off:', error);
        showToast('Failed to delete time off entry', 'error');
    }
}

// Load payment methods
async function loadPaymentMethods() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/payment-methods', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load payment methods');
        paymentMethods = await response.json();
        populatePaymentForm();
    } catch (error) {
        console.error('Error loading payment methods:', error);
        showToast('Failed to load payment methods', 'error');
    }
}

// Populate payment form
function populatePaymentForm() {
    if (paymentMethods.length === 0) return;

    const primaryMethod = paymentMethods.find(m => m.is_primary) || paymentMethods[0];
    document.getElementById('paymentMethod').value = primaryMethod.payment_method;
    togglePaymentDetails(primaryMethod.payment_method);

    if (primaryMethod.payment_method === 'bank_transfer') {
        document.getElementById('bankName').value = primaryMethod.bank_name || '';
        document.getElementById('accountName').value = primaryMethod.account_name || '';
        document.getElementById('accountNumber').value = primaryMethod.account_number || '';
        document.getElementById('branchCode').value = primaryMethod.branch_code || '';
    } else if (primaryMethod.payment_method === 'paypal') {
        document.getElementById('paypalEmail').value = primaryMethod.paypal_email || '';
    }
}

// Toggle payment details
document.getElementById('paymentMethod').addEventListener('change', function () {
    togglePaymentDetails(this.value);
});

function togglePaymentDetails(method) {
    document.getElementById('bankDetails').style.display = method === 'bank_transfer' ? 'block' : 'none';
    document.getElementById('paypalDetails').style.display = method === 'paypal' ? 'block' : 'none';
}

// Save payment settings
document.getElementById('paymentForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const method = document.getElementById('paymentMethod').value;
    let paymentData = { payment_method: method, is_primary: true };

    if (method === 'bank_transfer') {
        paymentData.bank_name = document.getElementById('bankName').value;
        paymentData.account_name = document.getElementById('accountName').value;
        paymentData.account_number = document.getElementById('accountNumber').value;
        paymentData.branch_code = document.getElementById('branchCode').value;
    } else if (method === 'paypal') {
        paymentData.paypal_email = document.getElementById('paypalEmail').value;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/payment-methods', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        if (!response.ok) throw new Error('Failed to update payment settings');
        showToast('Payment settings updated successfully', 'success');
    } catch (error) {
        console.error('Error updating payment settings:', error);
        showToast('Failed to update payment settings', 'error');
    }
});

// Change password
document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const email = document.getElementById('email').value; // Make sure you have this field
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/auth/change-password', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword
            })
        });

        if (!response.ok) throw new Error('Failed to change password');
        
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        showToast('Password changed successfully', 'success');
    } catch (error) {
        console.error('Error changing password:', error);
        showToast(error.message || 'Failed to change password', 'error');
    }
});

// Show toast message
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${getToastIcon(type)}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);

    toast.onclick = () => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    };
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 10px;
    `;
    document.body.appendChild(container);
    return container;
}

function getToastIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    return icons[type] || icons.info;
}

// Notification dropdown functions (same as dashboard.js)
function toggleNotifications() {
    const dropdown = document.querySelector('.notification-dropdown');
    dropdown.classList.toggle('show');

    if (dropdown.classList.contains('show')) {
        loadNotifications();
    }
}

async function loadNotifications() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/notifications/?status=all`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load notifications');
        }

        const notifications = await response.json();
        renderNotifications(notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
        showToast('Failed to load notifications', 'error');
    }
}

function renderNotifications(notifications) {
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
        const notification = allNotifications.find(n => n.notification_id === notificationId);
        if (notification) {
            notification.is_read = true;
            renderNotifications(allNotifications);
            updateUnreadCount();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

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

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    // First verify authentication before doing anything else
    verifyTechnicianAuthentication()
        .then(techData => {
            // If we get here, authentication was successful
            initNotifications();
            displayTechnicianInfo(techData);
            loadTechnicianProfile();
            loadServices();
            loadWorkingHours();
            loadTimeOffEntries();
            loadPaymentMethods();
            updateUnreadCount();
            highlightActiveTab();

            // Check availability status
            document.getElementById('isAvailable').checked = techData.is_available || false;
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });
});

// Authentication verification for technicians
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

function displayTechnicianInfo(techData) {
    if (techData.profile_picture_url) {
        profilePicture.src = techData.profile_picture_url;
    } else {
        profilePicture.src = '/assets/profile-placeholder.png';
    }

    userName.textContent = `${techData.name} ${techData.surname || ''}`;
}