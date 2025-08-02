let notifications = [];
let currentFilter = 'all';

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

document.addEventListener('DOMContentLoaded', function () {
    // First verify authentication
    verifyTechnicianAuthentication()
        .then(techData => {
            initNotifications();
            displayTechnicianInfo(techData);
            loadServices();
            highlightActiveTab();
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });

    // Modal elements
    const modal = document.getElementById('serviceModal');
    const modalTitle = document.getElementById('modalTitle');
    const serviceForm = document.getElementById('serviceForm');
    const addServiceBtn = document.getElementById('addServiceBtn');

    // Add service button click
    addServiceBtn.addEventListener('click', function () {
        modalTitle.textContent = 'Add New Service';
        serviceForm.reset();
        modal.style.display = 'flex';
    });

    // Form submission
    serviceForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveService();
    });

    async function loadServices() {
        const servicesList = document.getElementById('servicesList');

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://10.2.43.224:8000/technicians/me/services', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load services');
            }

            const services = await response.json();

            if (services.length === 0) {
                servicesList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-tools"></i>
                        <p>You haven't added any services yet</p>
                        <button class="btn btn-primary" id="addFirstServiceBtn">
                            <i class="fas fa-plus"></i> Add Your First Service
                        </button>
                    </div>
                `;
                document.getElementById('addFirstServiceBtn').addEventListener('click', function () {
                    modalTitle.textContent = 'Add New Service';
                    serviceForm.reset();
                    modal.style.display = 'flex';
                });
                return;
            }

            servicesList.innerHTML = '';
            services.forEach(service => {
                const serviceCard = document.createElement('div');
                serviceCard.className = 'service-card';
                serviceCard.innerHTML = `
                    <div class="service-header">
                        <h3 class="service-name">${service.name}</h3>
                    </div>
                    <div class="service-actions">
                        <i class="fas fa-trash action-icon delete" data-name="${service.name}"></i>
                    </div>
                `;
                servicesList.appendChild(serviceCard);
            });

            // Add event listeners to delete buttons
            document.querySelectorAll('.action-icon.delete').forEach(btn => {
                btn.addEventListener('click', function () {
                    deleteService(this.dataset.name);
                });
            });
        } catch (error) {
            console.error('Error loading services:', error);
            servicesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load services. Please try again.</p>
                    <button class="btn btn-primary" onclick="loadServices()">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    async function saveService() {
        const serviceName = document.getElementById('serviceName').value.trim();

        if (!serviceName) {
            showToast('Please enter a service name', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://10.2.43.224:8000/technicians/me/services', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: serviceName
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add service');
            }

            showToast('Service added successfully', 'success');
            closeModal();
            loadServices();
        } catch (error) {
            console.error('Error saving service:', error);
            showToast(error.message, 'error');
        }
    }

    async function deleteService(serviceName) {
        if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/technicians/me/services/${encodeURIComponent(serviceName)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete service');
            }

            showToast('Service deleted successfully', 'success');
            loadServices();
        } catch (error) {
            console.error('Error deleting service:', error);
            showToast('Failed to delete service', 'error');
        }
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    window.closeModal = closeModal;

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
});