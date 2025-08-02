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
            initAvailability(techData);
            highlightActiveTab();
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });

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


    async function initAvailability(techData) {
        // Initialize time selectors
        initializeTimeSelectors();

        // Load current availability status
        const availabilityToggle = document.getElementById('availabilityToggle');
        const toggleText = document.getElementById('toggleText');
        const statusDescription = document.getElementById('statusDescription');

        // Set initial toggle state
        availabilityToggle.checked = techData.is_available;
        updateToggleText(availabilityToggle.checked);

        // Toggle availability
        availabilityToggle.addEventListener('change', async function () {
            const isAvailable = this.checked;
            updateToggleText(isAvailable);

            try {
                const token = localStorage.getItem('access_token');
                const response = await fetch('http://10.2.43.224:8000/technicians/me/availability', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ is_available: isAvailable })
                });

                if (!response.ok) {
                    throw new Error('Failed to update availability');
                }

                showToast(`Availability updated to ${isAvailable ? 'Available' : 'Unavailable'}`, 'success');
            } catch (error) {
                console.error('Error updating availability:', error);
                // Revert toggle if update failed
                this.checked = !isAvailable;
                updateToggleText(!isAvailable);
                showToast('Failed to update availability', 'error');
            }
        });

        function updateToggleText(isAvailable) {
            toggleText.textContent = isAvailable ? 'Available' : 'Unavailable';
            statusDescription.textContent = isAvailable
                ? 'You are currently accepting new bookings.'
                : 'You are not accepting new bookings at this time.';
        }

        // Load working hours
        loadWorkingHours();

        // Save working hours button
        document.getElementById('saveHoursBtn').addEventListener('click', saveWorkingHours);

        // Time off functionality
        document.getElementById('addTimeOffBtn').addEventListener('click', addTimeOff);
        loadTimeOffEntries();
    }

    function initializeTimeSelectors() {
        // Generate time options (every 30 minutes from 00:00 to 23:30)
        const timeOptions = [];
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const displayTime = formatTimeForDisplay(timeString);
                timeOptions.push(`<option value="${timeString}">${displayTime}</option>`);
            }
        }

        // Add options to all time selects
        document.querySelectorAll('.time-select').forEach(select => {
            select.innerHTML = timeOptions.join('');

            // Set default values if not already set
            if (!select.value) {
                select.value = select.classList.contains('start-time') ? '08:00' : '17:00';
            }
        });
    }

    function formatTimeForDisplay(timeString) {
        const [hours, minutes] = timeString.split(':');
        const hourNum = parseInt(hours);
        const period = hourNum >= 12 ? 'PM' : 'AM';
        const displayHour = hourNum % 12 || 12;
        return `${displayHour}:${minutes} ${period}`;
    }

    async function loadWorkingHours() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://10.2.43.224:8000/technicians/me/working-hours', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const hours = await response.json();

            // Set the working hours in the form
            for (const [day, times] of Object.entries(hours)) {
                if (times) {
                    const dayElement = document.querySelector(`.day-hours[data-day="${day}"]`);
                    if (dayElement) {
                        // Handle both string and object time formats
                        let startTime, endTime;
                        
                        if (typeof times.start === 'string') {
                            // If time is in "HH:MM" format
                            startTime = times.start;
                            endTime = times.end;
                        } else {
                            // If time is in datetime format
                            startTime = new Date(times.start).toTimeString().substring(0, 5);
                            endTime = new Date(times.end).toTimeString().substring(0, 5);
                        }

                        dayElement.querySelector('.start-time').value = startTime;
                        dayElement.querySelector('.end-time').value = endTime;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading working hours:', error);
        showToast('Failed to load working hours', 'error');
    }
}

    async function saveWorkingHours() {
        // Collect working hours data from the form
        const workingHours = {};
        const dayElements = document.querySelectorAll('.day-hours');

        dayElements.forEach(dayElement => {
            const day = dayElement.dataset.day;
            const startTime = dayElement.querySelector('.start-time').value;
            const endTime = dayElement.querySelector('.end-time').value;

            // Validate times
            if (startTime && endTime) {
                workingHours[day] = {
                    start: startTime,
                    end: endTime
                };
            }
        });

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://10.2.43.224:8000/technicians/me/working-hours', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(workingHours)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save working hours');
            }

            showToast('Working hours saved successfully', 'success');
        } catch (error) {
            console.error('Error saving working hours:', error);
            showToast(error.message, 'error');
        }
    }

    async function loadTimeOffEntries() {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://10.2.43.224:8000/technicians/me/time-off', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const timeOffEntries = await response.json();
                const timeOffList = document.getElementById('timeOffList');
                timeOffList.innerHTML = '';

                if (timeOffEntries.length === 0) {
                    timeOffList.innerHTML = '<p>No scheduled time off</p>';
                    return;
                }

                timeOffEntries.forEach(entry => {
                    const entryElement = document.createElement('div');
                    entryElement.className = 'time-off-entry';
                    entryElement.innerHTML = `
                        <div>
                            <span class="time-off-dates">${formatDate(entry.start_date)} - ${formatDate(entry.end_date)}</span>
                        </div>
                        <i class="fas fa-trash delete-time-off" data-id="${entry.id}"></i>
                    `;
                    timeOffList.appendChild(entryElement);
                });

                // Add event listeners to delete buttons
                document.querySelectorAll('.delete-time-off').forEach(btn => {
                    btn.addEventListener('click', function () {
                        deleteTimeOffEntry(this.dataset.id);
                    });
                });
            }
        } catch (error) {
            console.error('Error loading time off entries:', error);
        }
    }

    async function addTimeOff() {
        const startDate = document.getElementById('timeOffStart').value;
        const endDate = document.getElementById('timeOffEnd').value;

        if (!startDate || !endDate) {
            showToast('Please select both start and end dates', 'error');
            return;
        }

        if (new Date(endDate) < new Date(startDate)) {
            showToast('End date must be after start date', 'error');
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
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add time off');
            }

            showToast('Time off added successfully', 'success');
            // Clear form
            document.getElementById('timeOffStart').value = '';
            document.getElementById('timeOffEnd').value = '';
            // Reload entries
            loadTimeOffEntries();
        } catch (error) {
            console.error('Error adding time off:', error);
            showToast('Failed to add time off', 'error');
        }
    }

    async function deleteTimeOffEntry(id) {
        if (!confirm('Are you sure you want to delete this time off entry?')) {
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/technicians/me/time-off/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'  // Important to include this
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete time off entry');
            }

            showToast('Time off entry deleted', 'success');
            loadTimeOffEntries();
        } catch (error) {
            console.error('Error deleting time off entry:', error);
            showToast(error.message || 'Failed to delete time off entry', 'error');
        }
    }

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
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

});