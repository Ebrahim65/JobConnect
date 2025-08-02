document.addEventListener('DOMContentLoaded', async function () {
    // Get booking ID from URL
    const pathParts = window.location.pathname.split('/');
    const bookingId = pathParts[pathParts.length - 1];

    if (!bookingId) {
        showToast('Invalid booking ID', 'error');
        window.location.href = '/client/bookings.html';
        return;
    }

    // Load booking details
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load booking details');
        }

        const booking = await response.json();
        displayBookingDetails(booking);
    } catch (error) {
        console.error('Error loading booking:', error);
        showToast('Failed to load booking details', 'error');
        window.location.href = '/client/bookings.html';
    }

    function displayBookingDetails(booking) {
        // Update basic info
        document.getElementById('bookingId').textContent = booking.booking_id;
        document.getElementById('bookingService').textContent = booking.service_type;
        document.getElementById('bookingDescription').textContent = booking.description;

        // Format dates
        const createdDate = new Date(booking.created_at);
        document.getElementById('bookingCreated').textContent = createdDate.toLocaleString();

        if (booking.start_date) {
            const startDate = new Date(booking.start_date);
            document.getElementById('bookingDate').textContent = startDate.toLocaleString();
        }

        // Price
        if (booking.price) {
            document.getElementById('bookingPrice').textContent = `$${booking.price.toFixed(2)}`;
        }

        // Status
        const statusBadge = document.getElementById('bookingStatus');
        statusBadge.textContent = formatStatus(booking.status);
        statusBadge.className = `status-badge status-${booking.status.toLowerCase()}`;

        // Technician info
        document.getElementById('techName').textContent =
            `${booking.technician_name} ${booking.technician_surname}`;

        const techAvatar = document.getElementById('techAvatar');
        techAvatar.src = booking.technician_avatar || '/assets/profile-placeholder.png';
        techAvatar.onerror = () => {
            techAvatar.src = '/assets/profile-placeholder.png';
        };

        // Set up action buttons
        const cancelBtn = document.getElementById('cancelBtn');
        if (booking.status.toLowerCase() === 'pending') {
            cancelBtn.disabled = false;
            cancelBtn.onclick = () => cancelBooking(booking.booking_id);
        }

        document.getElementById('messageBtn').onclick = () => {
            // Implement messaging functionality
            showToast('Messaging feature coming soon!', 'info');
        };
    }

    async function cancelBooking(bookingId) {
        if (!confirm('Are you sure you want to cancel this booking?')) return;

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'cancelled'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to cancel booking');
            }

            showToast('Booking cancelled successfully', 'success');
            setTimeout(() => {
                window.location.href = '/client/bookings.html';
            }, 1500);
        } catch (error) {
            console.error('Error cancelling booking:', error);
            showToast('Failed to cancel booking', 'error');
        }
    }

    function formatStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'completed': 'Completed',
            'cancelled': 'Cancelled',
            'in_progress': 'In Progress'
        };
        return statusMap[status.toLowerCase()] || status;
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
});