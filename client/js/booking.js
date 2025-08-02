function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);

    // Manual close
    toast.querySelector('.toast-close').onclick = () => toast.remove();
}

document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    loadSidebarData();
    //initNotifications();
    const bookingsTable = document.getElementById('bookingsTable');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const modal = document.getElementById('bookingModal');
    const closeBtn = document.querySelector('.close-btn');
    const modalBody = document.getElementById('modalBody');

    // Current filter
    let currentFilter = 'all';

    // First verify authentication
    verifyAuthentication()
        .then(userData => {
            loadBookings();
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });

    // Filter button click handlers
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.status;
            loadBookings();
        });
    });

    // Modal close button
    closeBtn.addEventListener('click', function () {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Load bookings
    async function loadBookings() {
        try {
            bookingsTable.innerHTML = `
            <tr>
                <td colspan="6" class="loading-row">
                    <i class="fas fa-spinner fa-spin"></i>
                    Loading bookings...
                </td>
            </tr>
        `;

            const token = localStorage.getItem('access_token');
            let url = 'http://10.2.43.224:8000/bookings';
            if (currentFilter !== 'all') {
                url += `?status=${currentFilter}`;
            }

            // First load all bookings
            const bookingsResponse = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!bookingsResponse.ok) {
                throw new Error('Failed to load bookings');
            }

            let bookings = await bookingsResponse.json();

            // Get all completed booking IDs
            const completedBookingIds = bookings
                .filter(b => b.status === 'completed')
                .map(b => b.booking_id);

            // If there are completed bookings, fetch their reviews in one batch
            let reviews = [];
            if (completedBookingIds.length > 0) {
                const reviewsResponse = await fetch(
                    `http://10.2.43.224:8000/reviews/booking-reviews?` +
                    new URLSearchParams({
                        booking_ids: completedBookingIds.join(',')
                    }), {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
                );

                if (reviewsResponse.ok) {
                    reviews = await reviewsResponse.json();
                }
            }

            // Map reviews to bookings
            bookings = bookings.map(booking => {
                if (booking.status === 'completed') {
                    const bookingReview = reviews.find(r => r.booking_id === booking.booking_id);
                    return {
                        ...booking,
                        has_review: !!bookingReview,
                        review_id: bookingReview?.review_id || null,
                        review_rating: bookingReview?.rating || null,
                        review_comment: bookingReview?.comment || null
                    };
                }
                return {
                    ...booking,
                    has_review: false,
                    review_id: null,
                    review_rating: null,
                    review_comment: null
                };
            });

            displayBookings(bookings);
        } catch (error) {
            console.error('Error loading bookings:', error);
            showError('Failed to load bookings. Please try again.');
            displayMockBookings();
        }
    }

    // Display bookings in table
    function displayBookings(bookings) {
        bookingsTable.innerHTML = '';

        if (bookings.length === 0) {
            bookingsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-bookings">
                        <i class="fas fa-calendar-times"></i>
                        <span>No bookings found</span>
                    </td>
                </tr>
            `;
            return;
        }

        bookings.forEach(booking => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${booking.technician_name || 'N/A'} ${booking.technician_surname || ''}</td>
                <td>${booking.service_type || 'N/A'}</td>
                <td>${formatDate(booking.created_at)}</td>
                <td><span class="status-badge status-${booking.status}">${formatStatus(booking.status)}</span></td>
                <td>${booking.price ? `R${booking.price.toFixed(2)}` : 'N/A'}</td>
                <td>
                    <button class="action-btn btn-primary" onclick="viewBookingDetails('${booking.booking_id}')">
                        <i class="fas fa-eye"></i> Details
                    </button>
                    ${booking.status === 'pending' ? `
                    <button class="action-btn btn-danger" onclick="cancelBooking('${booking.booking_id}')">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    ` : ''}
                    ${booking.status === 'offered' ? `
                    <button class="action-btn btn-success" onclick="showOfferResponse('${booking.booking_id}')">
                        <i class="fas fa-handshake"></i> Respond
                    </button>
                    ` : ''}
                </td>
            `;
            bookingsTable.appendChild(row);
        });
    }

    // View booking details
    window.viewBookingDetails = async function (bookingId) {
        try {
            const token = localStorage.getItem('access_token');

            // First get the booking details
            const bookingResponse = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!bookingResponse.ok) {
                throw new Error('Failed to load booking details');
            }

            const booking = await bookingResponse.json();

            // Then check for review if booking is completed
            if (booking.status === 'completed') {
                try {
                    const reviewResponse = await fetch(
                        `http://10.2.43.224:8000/reviews?booking_id=${bookingId}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        }
                    );

                    if (reviewResponse.ok) {
                        const reviewData = await reviewResponse.json();
                        if (reviewData.length > 0) {
                            booking.has_review = true;
                            booking.review_id = reviewData[0].review_id;
                            booking.review_rating = reviewData[0].rating;
                            booking.review_comment = reviewData[0].comment;
                            booking.review_created_at = reviewData[0].created_at;
                        } else {
                            booking.has_review = false;
                        }
                    }
                } catch (reviewError) {
                    console.error('Error fetching review:', reviewError);
                    booking.has_review = false;
                }
            }

            showBookingModal(booking);
        } catch (error) {
            console.error('Error loading booking details:', error);
            showError('Failed to load booking details. Please try again.');
        }
    };

    // Show booking modal with details
    function showBookingModal(booking) {
        modalBody.innerHTML = `
        <div class="booking-detail">
            <label>Technician:</label>
            <p>${booking.technician_name} ${booking.technician_surname || ''}</p>
        </div>
        <div class="booking-detail">
            <label>Service Type:</label>
            <p>${booking.service_type || 'N/A'}</p>
        </div>
        <div class="booking-detail">
            <label>Description:</label>
            <p>${booking.description || 'No description provided'}</p>
        </div>
        <div class="booking-detail">
            <label>Status:</label>
            <p><span class="status-badge status-${booking.status}">${formatStatus(booking.status)}</span></p>
        </div>
        <div class="booking-detail">
            <label>Created:</label>
            <p>${formatDate(booking.created_at)}</p>
        </div>
        ${booking.start_date ? `
        <div class="booking-detail">
            <label>Scheduled Start:</label>
            <p>${formatDate(booking.start_date)}</p>
        </div>
        ` : ''}
        ${booking.end_date ? `
        <div class="booking-detail">
            <label>Completion Date:</label>
            <p>${formatDate(booking.end_date)}</p>
        </div>
        ` : ''}
        <div class="booking-detail">
            <label>Price:</label>
            <p>${booking.price ? `R${booking.price.toFixed(2)}` : 'Not specified'}</p>
        </div>
        
        ${booking.status === 'completed' ? `
        <div class="review-section">
            <h3>${booking.has_review ? 'Your Review' : 'Leave a Review'}</h3>
            
            ${booking.has_review ? `
                <div class="existing-review">
                    <div class="review-header">
                        <div class="review-rating">
                            ${renderStars(booking.review_rating)}
                            <span class="rating-value">${booking.review_rating.toFixed(1)}/5</span>
                        </div>
                        <div class="review-date">${formatDate(booking.review_created_at)}</div>
                    </div>
                    ${booking.review_comment ? `
                    <div class="review-comment">
                        <p>${booking.review_comment}</p>
                    </div>
                    ` : ''}
                    <div class="review-actions">
                        <button class="btn btn-primary" onclick="editReview('${booking.booking_id}')">
                            <i class="fas fa-edit"></i> Edit Review
                        </button>
                        <button class="btn btn-danger" onclick="deleteReview('${booking.review_id}', '${booking.booking_id}')">
                            <i class="fas fa-trash"></i> Delete Review
                        </button>
                    </div>
                </div>
            ` : `
                <div class="review-form">
                    <div class="rating-input">
                        <label>Rating:</label>
                        <div class="star-rating">
                            ${[1, 2, 3, 4, 5].map(i => `
                                <i class="far fa-star" data-rating="${i}" onclick="setRating(this)"></i>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="reviewComment">Comment (optional):</label>
                        <textarea id="reviewComment" rows="3" placeholder="Share your experience..."></textarea>
                    </div>
                    <button class="btn btn-primary" onclick="submitReview('${booking.booking_id}')">
                        <i class="fas fa-paper-plane"></i> Submit Review
                    </button>
                </div>
            `}
        </div>
        ` : ''}
        
        <div class="booking-actions">
            ${booking.status === 'pending' ? `
            <button class="btn btn-danger" onclick="cancelBooking('${booking.booking_id}')">
                <i class="fas fa-times"></i> Cancel Booking
            </button>
            ` : ''}
            ${booking.status === 'offered' ? `
            <button class="btn btn-success" onclick="acceptOffer('${booking.booking_id}')">
                <i class="fas fa-check"></i> Accept Offer
            </button>
            <button class="btn btn-danger" onclick="rejectOffer('${booking.booking_id}')">
                <i class="fas fa-times"></i> Reject Offer
            </button>
            ` : ''}
            <button class="btn btn-secondary" onclick="modal.style.display='none'">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;

        modal.style.display = 'flex';
    }

    // Cancel booking
    window.cancelBooking = async function (bookingId) {
        try {
            // Create a modal for cancellation reason
            const modal = document.createElement('div');
            modal.className = 'booking-modal';
            modal.innerHTML = `
            <div class="modal-content">
                <span class="close-btn">&times;</span>
                <h3>Cancel Booking</h3>
                <form id="cancelForm">
                    <div class="form-group">
                        <label for="cancelReason">Reason for cancellation (min 10 characters):</label>
                        <textarea id="cancelReason" required rows="4" minlength="10" 
                                  placeholder="Please explain why you're cancelling this booking"></textarea>
                    </div>
                    <button type="submit" class="btn-submit btn-danger">Confirm Cancellation</button>
                </form>
            </div>
        `;

            document.body.appendChild(modal);

            // Handle modal close
            const closeBtn = modal.querySelector('.close-btn');
            closeBtn.onclick = () => modal.remove();

            // Handle form submission
            const cancelForm = modal.querySelector('#cancelForm');
            cancelForm.onsubmit = async (e) => {
                e.preventDefault();

                const reason = document.getElementById('cancelReason').value.trim();

                if (reason.length < 10) {
                    showToast('Please provide a reason with at least 10 characters', 'error');
                    return;
                }

                if (!confirm('Are you sure you want to cancel this booking?')) {
                    return;
                }

                const token = localStorage.getItem('access_token');
                const submitBtn = cancelForm.querySelector('.btn-submit');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Processing...';

                try {
                    const response = await fetch(`http://10.2.43.224:8000/clients/bookings/${bookingId}/cancel`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            status: 'cancelled',
                            reason: reason
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to cancel booking');
                    }

                    showToast('Booking cancelled successfully', 'success');
                    modal.remove();
                    loadBookings();

                    // Also close the details modal if open
                    const detailsModal = document.getElementById('bookingModal');
                    if (detailsModal) {
                        detailsModal.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error cancelling booking:', error);
                    showToast('Failed to cancel booking', 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Confirm Cancellation';
                }
            };

            // Close modal when clicking outside
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            };

        } catch (error) {
            console.error('Error creating cancel modal:', error);
            showToast('Failed to initiate cancellation. Please try again.', 'error');
        }
    };

    // Respond to offer
    window.showOfferResponse = async function (bookingId) {
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

            modalBody.innerHTML = `
                <div class="booking-detail">
                    <label>Technician's Offer:</label>
                    <p>${booking.technician_name} ${booking.technician_surname} has offered to complete this service for R${booking.price?.toFixed(2) || '0.00'}</p>
                </div>
                <div class="booking-detail">
                    <label>Service:</label>
                    <p>${booking.service_type}</p>
                </div>
                <div class="booking-detail">
                    <label>Description:</label>
                    <p>${booking.description || 'No description provided'}</p>
                </div>
                <div class="booking-actions">
                    <button class="btn btn-success" onclick="acceptOffer('${booking.booking_id}')">
                        <i class="fas fa-check"></i> Accept Offer
                    </button>
                    <button class="btn btn-danger" onclick="rejectOffer('${booking.booking_id}')">
                        <i class="fas fa-times"></i> Reject Offer
                    </button>
                    <button class="btn btn-secondary" onclick="modal.style.display='none'">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            `;

            modal.style.display = 'flex';
        } catch (error) {
            console.error('Error loading booking details:', error);
            showError('Failed to load booking details. Please try again.');
        }
    };

    window.acceptOffer = async function (bookingId) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/respond`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accept: true
                })
            });

            if (!response.ok) {
                throw new Error('Failed to accept offer');
            }

            showSuccess('Offer accepted successfully!');
            loadBookings();
            modal.style.display = 'none';
        } catch (error) {
            console.error('Error accepting offer:', error);
            showError('Failed to accept offer. Please try again.');
        }
    };

    window.rejectOffer = async function (bookingId) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/respond`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accept: false
                })
            });

            if (!response.ok) {
                throw new Error('Failed to reject offer');
            }

            showSuccess('Offer rejected successfully');
            loadBookings();
            modal.style.display = 'none';
        } catch (error) {
            console.error('Error rejecting offer:', error);
            showError('Failed to reject offer. Please try again.');
        }
    };

    function chatOnWhatsApp(phoneNumber, serviceType) {
        if (!phoneNumber) {
            showError('Client phone number not available');
            return;
        }

        // Remove any non-digit characters
        const cleanedPhone = phoneNumber.replace(/\D/g, '');
        const message = `Hi, this is regarding your ${serviceType} booking on JobConnect`;
        const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
    }

    // Helper functions
    // Format date for display
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // Format booking status
    function formatStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'completed': 'Completed',
            'cancelled': 'Cancelled',
            'offered': 'Offer Received'
        };
        return statusMap[status?.toLowerCase()] || status;
    }

    function displayMockBookings() {
        console.warn('Using mock booking data');
        const mockBookings = [
            {
                booking_id: '1',
                technician_name: 'John',
                technician_surname: 'Smith',
                service_type: 'Plumbing Repair',
                created_at: '2023-06-15T10:00:00',
                status: 'confirmed',
                price: 450.00,
                description: 'Fixing leaking pipes in kitchen'
            },
            {
                booking_id: '2',
                technician_name: 'Sarah',
                technician_surname: 'Johnson',
                service_type: 'Electrical Wiring',
                created_at: '2023-06-16T14:00:00',
                status: 'pending',
                price: null,
                description: 'Installing new light fixtures'
            }
        ];
        displayBookings(mockBookings);
    }

    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'notification success';
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 3000);
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'notification error';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    // Helper function to render star ratings
    // Render star rating display
    function renderStars(rating) {
        if (!rating) return '';

        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let stars = '';

        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars + 1 && hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }

        return stars;
    }

    // Set rating stars
    window.setRating = function (starElement) {
        const rating = parseInt(starElement.dataset.rating);
        const stars = starElement.parentElement.querySelectorAll('.far, .fas');

        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.remove('far');
                star.classList.add('fas');
            } else {
                star.classList.remove('fas');
                star.classList.add('far');
            }
        });
    };

    // Submit review
    window.submitReview = async function (bookingId) {
        try {
            const token = localStorage.getItem('access_token');
            const stars = document.querySelectorAll('.star-rating .fas');
            const rating = stars.length;
            const comment = document.getElementById('reviewComment').value.trim();

            if (rating === 0) {
                showToast('Please select a rating', 'error');
                return;
            }

            const response = await fetch('http://10.2.43.224:8000/reviews', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    booking_id: bookingId,
                    rating: rating,
                    comment: comment || null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to submit review');
            }

            showToast('Review submitted successfully!', 'success');
            viewBookingDetails(bookingId); // Refresh the modal to show the review
        } catch (error) {
            console.error('Error submitting review:', error);
            showToast(error.message || 'Failed to submit review', 'error');
        }
    };

    // Edit review
    // Edit review
    window.editReview = async function (bookingId) {
        try {
            const token = localStorage.getItem('access_token');

            // First get the booking details to get the review_id
            const bookingResponse = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!bookingResponse.ok) {
                throw new Error('Failed to load booking details');
            }

            const booking = await bookingResponse.json();

            // Then get the review details
            const reviewResponse = await fetch(
                `http://10.2.43.224:8000/reviews?booking_id=${bookingId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!reviewResponse.ok) {
                throw new Error('Failed to load review details');
            }

            const reviewData = await reviewResponse.json();
            if (reviewData.length === 0) {
                throw new Error('No review found for this booking');
            }

            const review = reviewData[0];

            modalBody.innerHTML = `
            <div class="booking-detail">
                <label>Technician:</label>
                <p>${booking.technician_name} ${booking.technician_surname || ''}</p>
            </div>
            <div class="booking-detail">
                <label>Service:</label>
                <p>${booking.service_type}</p>
            </div>
            
            <div class="review-section" data-booking-id="${bookingId}">
                <h3>Edit Your Review</h3>
                <div class="review-form">
                    <div class="rating-input">
                        <label>Rating:</label>
                        <div class="star-rating">
                            ${[1, 2, 3, 4, 5].map(i => `
                                <i class="${i <= review.rating ? 'fas' : 'far'} fa-star" 
                                   data-rating="${i}" onclick="setRating(this)"></i>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="reviewComment">Comment:</label>
                        <textarea id="reviewComment" rows="3">${review.comment || ''}</textarea>
                    </div>
                    <button class="btn btn-primary" onclick="updateReview('${review.review_id}', '${bookingId}')">
                        <i class="fas fa-save"></i> Update Review
                    </button>
                    <button class="btn btn-danger" onclick="deleteReview('${review.review_id}', '${bookingId}')">
                        <i class="fas fa-trash"></i> Delete Review
                    </button>
                </div>
            </div>
            
            <div class="booking-actions">
                <button class="btn btn-secondary" onclick="modal.style.display='none'">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        `;
        } catch (error) {
            console.error('Error loading review:', error);
            showToast('Failed to load review for editing', 'error');
        }
    };

    // Update review - modified to accept bookingId parameter
    window.updateReview = async function (reviewId, bookingId) {
        try {
            const token = localStorage.getItem('access_token');
            const stars = document.querySelectorAll('.star-rating .fas');
            const rating = stars.length;
            const comment = document.getElementById('reviewComment').value.trim();

            if (rating === 0) {
                showToast('Please select a rating', 'error');
                return;
            }

            const response = await fetch(`http://10.2.43.224:8000/reviews/${reviewId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rating: rating,
                    comment: comment || null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update review');
            }

            showToast('Review updated successfully!', 'success');
            viewBookingDetails(bookingId); // Refresh the modal with the updated review
        } catch (error) {
            console.error('Error updating review:', error);
            showToast(error.message || 'Failed to update review', 'error');
        }
    };

    // Delete review
    window.deleteReview = async function (reviewId, bookingId) {
        if (!confirm('Are you sure you want to delete this review?')) {
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/reviews/${reviewId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete review');
            }

            showToast('Review deleted successfully', 'success');
            viewBookingDetails(bookingId); // Refresh the modal
        } catch (error) {
            console.error('Error deleting review:', error);
            showToast(error.message || 'Failed to delete review', 'error');
        }
    };

    // Add these new functions to handle start and complete actions
    window.startJob = async function (bookingId) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/start`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to start job');
            }

            showToast('Job started successfully', 'success');
            viewBookingDetails(bookingId); // Refresh the modal
            loadBookings(); // Refresh the bookings list
        } catch (error) {
            console.error('Error starting job:', error);
            showToast(error.message || 'Failed to start job', 'error');
        }
    };

    window.completeJob = async function (bookingId) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`http://10.2.43.224:8000/bookings/${bookingId}/complete`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to complete job');
            }

            showToast('Job completed successfully', 'success');
            viewBookingDetails(bookingId); // Refresh the modal
            loadBookings(); // Refresh the bookings list
        } catch (error) {
            console.error('Error completing job:', error);
            showToast(error.message || 'Failed to complete job', 'error');
        }
    };
});