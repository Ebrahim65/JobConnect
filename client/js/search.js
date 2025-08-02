document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    loadSidebarData();
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const locationText = document.getElementById('locationText');
    const userMessage = document.getElementById('userMessage');
    const sendMessage = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');
    const resultsSection = document.getElementById('resultsSection');
    const resultsGrid = document.getElementById('resultsGrid');
    const filterSelect = document.getElementById('filterSelect');
    const sortSelect = document.getElementById('sortSelect');

    // Current location and search results
    let currentLocation = null;
    let searchResults = [];

    // First verify authentication
    verifyAuthentication()
        .then(userData => {
            // Get user location
            getUserLocation();
        })
        .catch(error => {
            console.error('Authentication failed:', error);
            redirectToLogin();
        });

    // Search button click handler
    searchButton.addEventListener('click', performSearch);

    // Enter key in search input
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Send message button click handler
    sendMessage.addEventListener('click', sendChatMessage);

    // Enter key in chat input
    userMessage.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Filter change handler
    filterSelect.addEventListener('change', filterResults);

    // Sort results handler
    sortSelect.addEventListener('change', sortResults);

    // Get user's current location
    function getUserLocation() {
        locationText.textContent = 'Detecting your location...';

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    currentLocation = { lat: latitude, lng: longitude };
                    getLocationName(latitude, longitude);
                },
                error => {
                    console.error('Geolocation error:', error);
                    locationText.textContent = 'Unable to detect location. Using default location.';
                    // Fallback to a default location
                    currentLocation = { lat: -25.5404, lng: 28.0945 };
                }
            );
        } else {
            locationText.textContent = 'Geolocation not supported. Using default location.';
            currentLocation = { lat: -25.6546, lng: 27.2379 }; // Example: Rustenburg
        }
    }

    // Get location name from coordinates
    async function getLocationName(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();

            if (data.address) {
                const address = data.address;
                let displayName = '';
                
                if (address.road) displayName += address.road + ', ';
                if (address.city || address.town || address.village) displayName += (address.city || address.town || address.village) + ', ';
                if (address.state) displayName += address.state;
                
                locationText.textContent = displayName || `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            } else {
                locationText.textContent = `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
        } catch (error) {
            console.error('Error getting location name:', error);
            locationText.textContent = `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }

    // Perform search
    async function performSearch() {
        const query = searchInput.value.trim();

        if (!query) {
            showChatMessage('Please enter a search term.', false);
            return;
        }

        if (!currentLocation) {
            showChatMessage('Still detecting your location. Please wait...', false);
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(
                `http://10.2.43.224:8000/technicians/search?search_string=${encodeURIComponent(query)}&latitude=${currentLocation.lat}&longitude=${currentLocation.lng}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const { in_app_technicians, external_technicians } = await response.json();

            // Combine and format results
            searchResults = [
                ...in_app_technicians.map(tech => ({
                    ...tech,
                    is_inapp: true,
                    rating: parseFloat(tech.avg_rating) || 0,
                    distance_km: tech.distance_km || 0,
                    specialty: tech.service_types?.join(', ') || 'General Technician'
                })),
                ...external_technicians.map(tech => ({
                    ...tech,
                    is_inapp: false,
                    rating: parseFloat(tech.rating) || 0,
                    distance_km: tech.distance_km || 0,
                    specialty: tech.service_type || 'General Technician'
                }))
            ];

            displaySearchResults(searchResults);
            resultsSection.style.display = 'block';
        } catch (error) {
            console.error('Search error:', error);
            showChatMessage('Failed to perform search. Please try again.', false);
        }
    }

    // Display search results
    function displaySearchResults(results) {
        resultsGrid.innerHTML = '';

        if (results.length === 0) {
            resultsGrid.innerHTML = `
                <div class="empty-results">
                    <i class="fas fa-user-times"></i>
                    <p>No technicians found matching your search.</p>
                </div>
            `;
            return;
        }

        results.forEach(tech => {
            const techCard = document.createElement('div');
            techCard.className = 'technician-card';

            techCard.innerHTML = `
                <img src="${tech.profile_picture_url || '/assets/profile-placeholder.png'}" 
                     alt="${tech.name}" 
                     class="tech-avatar"
                     onerror="this.src='/assets/profile-placeholder.png'">
                <div class="tech-info">
                    <h4 class="tech-name">
                        ${tech.name} ${tech.surname || ''}
                        <span class="tech-type ${tech.is_inapp ? 'type-inapp' : 'type-external'}">
                            ${tech.is_inapp ? 'In-App' : 'External'}
                        </span>
                    </h4>
                    <p class="tech-specialty">${tech.specialty}</p>
                    <div class="tech-rating">
                        ${generateStarRating(tech.rating)}
                        <span>${tech.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                    <p class="tech-distance">${tech.distance_km ? `${tech.distance_km.toFixed(1)} km away` : 'Distance not available'}</p>
                    <div class="tech-actions">
                        ${tech.is_inapp ? `
                            <button class="btn-favorite" onclick="toggleFavorite('${tech.technician_id}', this)">
                                <i class="fas fa-heart"></i> Favorite
                            </button>
                            <button class="btn-view" onclick="viewTechnicianProfile('${tech.technician_id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn-book" onclick="bookTechnicianFromSearch('${tech.technician_id}', '${tech.name} ${tech.surname || ''}')">
                                <i class="fas fa-calendar-plus"></i> Book
                            </button>
                        ` : `
                            <button class="btn-view" onclick="viewExternalTechnician('${tech.name} ${tech.surname || ''}', ${tech.latitude}, ${tech.longitude})">
                                <i class="fas fa-map-marker-alt"></i> View
                            </button>
                        `}
                    </div>
                </div>
            `;

            resultsGrid.appendChild(techCard);
        });
    }

    // Filter results based on selection
    function filterResults() {
        const filterValue = filterSelect.value;

        if (filterValue === 'all') {
            displaySearchResults(searchResults);
        } else {
            const filtered = searchResults.filter(tech =>
                filterValue === 'inapp' ? tech.is_inapp : !tech.is_inapp
            );
            displaySearchResults(filtered);
        }
    }

    function sortResults() {
        const sortValue = sortSelect.value;

        switch (sortValue) {
            case 'rating_high':
                searchResults.sort((a, b) => b.rating - a.rating);
                break;
            case 'rating_low':
                searchResults.sort((a, b) => a.rating - b.rating);
                break;
            case 'distance':
                searchResults.sort((a, b) => (a.distance_km || Infinity) - (b.distance_km || Infinity));
                break;
            default:
                // Default sorting (maybe keep original order or sort by relevance)
                break;
        }

        displaySearchResults(searchResults);
    }

    // Chatbot functions
    async function sendChatMessage() {
        const message = userMessage.value.trim();

        if (!message) return;

        // Add user message to chat
        showChatMessage(message, true);
        userMessage.value = '';

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://10.2.43.224:8000/recommendation/recommend', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ description: message })
            });

            if (!response.ok) {
                throw new Error('Recommendation failed');
            }

            const { service_type } = await response.json();
            const recommendation = `Based on your issue, I recommend searching for "${service_type}" professionals. I'll search for qualified ${service_type}s in your area.`;

            showChatMessage(recommendation, false);

            // Auto-fill and search
            searchInput.value = service_type;
            performSearch();

        } catch (error) {
            console.error('Recommendation error:', error);
            showChatMessage("I couldn't understand your issue. Please try describing it differently.", false);
        }
    }

    function showChatMessage(message, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${isUser ? 'user-message' : ''}`;
        messageDiv.innerHTML = `<p>${message}</p>`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Star rating generator
    function generateStarRating(rating) {
        const numericRating = Number(rating) || 0;
        const fullStars = Math.floor(numericRating);
        const hasHalfStar = numericRating % 1 >= 0.5;
        let stars = '';

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars && hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }

        return stars;
    }

    // Authentication functions
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

            return await response.json();
        } catch (error) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_type');
            throw error;
        }
    }

    function redirectToLogin() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_type');
        window.location.href = '/login.html';
    }
});

// Global functions
window.toggleFavorite = async function (technicianId, button) {
    const isFavorite = button.classList.contains('active');
    const token = localStorage.getItem('access_token');

    // Show loading state
    const originalContent = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isFavorite ? 'Removing...' : 'Adding...'}`;
    button.disabled = true;

    try {
        const endpoint = `http://10.2.43.224:8000/clients/favorites`;
        const method = isFavorite ? 'DELETE' : 'POST';

        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ technician_id: technicianId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || (isFavorite ? 'Failed to remove favorite' : 'Failed to add favorite'));
        }

        // Update UI
        button.classList.toggle('active');
        button.innerHTML = `<i class="fas fa-heart"></i> ${isFavorite ? 'Favorite' : 'Favorited'}`;

        // Show toast notification
        showToast(`${isFavorite ? 'Removed from' : 'Added to'} favorites`, 'success');

    } catch (error) {
        console.error('Favorite error:', error);
        showToast(error.message, 'error');
        button.innerHTML = originalContent;
    } finally {
        button.disabled = false;
    }
};

window.bookTechnicianFromSearch = async function (technicianId, technicianName) {
    try {
        // First get the technician's schedule
        const schedules = await getTechnicianSchedule(technicianId);
        const hasSchedule = schedules.length > 0;

        // Create booking modal
        const modal = document.createElement('div');
        modal.className = 'booking-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-btn">&times;</span>
                <h3>Book Technician</h3>
                <p class="tech-booking-for">Booking for: <strong>${technicianName}</strong></p>
                <form id="bookingForm">
                    <div class="form-scroll-container">
                        <div class="form-group">
                            <label for="serviceType">Service Needed:</label>
                            <input type="text" id="serviceType" required placeholder="e.g., Plumbing, Electrical">
                        </div>
                        
                        ${hasSchedule ? `
                        <div class="form-group" id="scheduleSelection">
                            <label>Available Time Slots:</label>
                            <select id="scheduleSelect">
                                <option value="">Select an available time slot</option>
                                ${schedules.map(schedule => `
                                    <option value="${schedule.schedule_id}">
                                        ${formatDate(schedule.start_time)} - ${formatDate(schedule.end_time)}
                                    </option>
                                `).join('')}
                                <option value="custom">Custom time slot</option>
                            </select>
                            <div id="customDateContainer" style="display: none; margin-top: 10px;">
                                <div class="form-group">
                                    <label for="customStartDate">Start Date & Time:</label>
                                    <input type="datetime-local" id="customStartDate">
                                </div>
                                <div class="form-group">
                                    <label for="customEndDate">End Date & Time:</label>
                                    <input type="datetime-local" id="customEndDate">
                                </div>
                            </div>
                        </div>
                        ` : `
                        <div class="form-group">
                            <label for="startDate">Start Date & Time:</label>
                            <input type="datetime-local" id="startDate" required>
                        </div>
                        <div class="form-group">
                            <label for="endDate">End Date & Time:</label>
                            <input type="datetime-local" id="endDate" required>
                        </div>
                        `}
                        
                        <div class="form-group">
                            <label for="description">Description:</label>
                            <textarea id="description" required rows="4" placeholder="Describe the issue in detail"></textarea>
                        </div>

                        <!-- Address Fields with Autocomplete -->
                        <div class="form-group address-group">
                            <label for="address">Address:</label>
                            <input type="text" id="address" required placeholder="Start typing your address...">
                            <div id="addressSuggestions" class="location-suggestions"></div>
                        </div>

                        <div class="form-group">
                            <label for="city">City:</label>
                            <input type="text" id="city" required>
                        </div>

                        <div class="form-group">
                            <label for="postalCode">Postal Code:</label>
                            <input type="text" id="postalCode" required>
                        </div>

                        <div class="form-group">
                            <label for="province">Province/State:</label>
                            <input type="text" id="province" required>
                        </div>

                        <div class="form-group">
                            <label for="country">Country:</label>
                            <input type="text" id="country" required>
                        </div>

                        <!-- Hidden fields for coordinates -->
                        <input type="hidden" id="latitude">
                        <input type="hidden" id="longitude">

                        <div id="mapPreview" style="height: 200px; margin-bottom: 15px; display: none;">
                            <!-- Map will be displayed here -->
                        </div>
                    </div>

                    <button type="submit" class="btn-submit">Submit Booking</button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Initialize address autocomplete
        const addressInput = modal.querySelector('#address');
        const addressSuggestions = modal.querySelector('#addressSuggestions');
        const cityInput = modal.querySelector('#city');
        const postalCodeInput = modal.querySelector('#postalCode');
        const provinceInput = modal.querySelector('#province');
        const countryInput = modal.querySelector('#country');
        const latitudeInput = modal.querySelector('#latitude');
        const longitudeInput = modal.querySelector('#longitude');
        const mapPreview = modal.querySelector('#mapPreview');

        let debounceTimer;
        let activeSuggestionIndex = -1;
        let currentRequest = null;
        let map;
        let marker;

        // Address autocomplete functionality
        addressInput.addEventListener('input', function(e) {
            clearTimeout(debounceTimer);
            
            if (currentRequest) {
                currentRequest.abort();
            }
            
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                addressSuggestions.style.display = 'none';
                return;
            }
            
            debounceTimer = setTimeout(() => {
                fetchAddressSuggestions(query);
            }, 500);
        });

        addressInput.addEventListener('keydown', function(e) {
            const items = addressSuggestions.querySelectorAll('.location-suggestion-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
                updateActiveSuggestion(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, -1);
                updateActiveSuggestion(items);
            } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
                e.preventDefault();
                items[activeSuggestionIndex].click();
            }
        });

        addressInput.addEventListener('focus', function() {
            if (addressInput.value.trim().length >= 3 && addressSuggestions.innerHTML) {
                addressSuggestions.style.display = 'block';
            }
        });

        modal.addEventListener('click', function(e) {
            if (!addressInput.contains(e.target)) {
                addressSuggestions.style.display = 'none';
            }
        });

        function fetchAddressSuggestions(query) {
            addressSuggestions.innerHTML = '<div class="location-loading">Searching locations...</div>';
            addressSuggestions.style.display = 'block';
            activeSuggestionIndex = -1;
            
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
            
            const controller = new AbortController();
            currentRequest = controller;
            
            fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    currentRequest = null;
                    if (data && data.length > 0) {
                        renderAddressSuggestions(data);
                    } else {
                        addressSuggestions.innerHTML = '<div class="location-loading">No locations found</div>';
                    }
                })
                .catch(error => {
                    if (error.name !== 'AbortError') {
                        console.error('Error fetching address suggestions:', error);
                        addressSuggestions.innerHTML = '<div class="location-loading">Error loading suggestions</div>';
                    }
                });
        }

        function renderAddressSuggestions(results) {
            addressSuggestions.innerHTML = '';
            
            results.forEach((result, index) => {
                const item = document.createElement('div');
                item.className = 'location-suggestion-item';
                
                const address = result.address;
                let displayText = result.display_name.split(',').slice(0, 3).join(', ');
                
                item.textContent = displayText;
                item.dataset.lat = result.lat;
                item.dataset.lon = result.lon;
                item.dataset.displayName = displayText;
                item.dataset.address = JSON.stringify(address);
                
                item.addEventListener('click', function() {
                    const addressData = JSON.parse(this.dataset.address);
                    
                    // Update form fields with selected address
                    addressInput.value = this.dataset.displayName;
                    cityInput.value = addressData.city || addressData.town || addressData.village || '';
                    postalCodeInput.value = addressData.postcode || '';
                    provinceInput.value = addressData.state || '';
                    countryInput.value = addressData.country || '';
                    latitudeInput.value = this.dataset.lat;
                    longitudeInput.value = this.dataset.lon;
                    
                    // Show map preview
                    updateMapPreview(parseFloat(this.dataset.lat), parseFloat(this.dataset.lon));
                    
                    addressSuggestions.style.display = 'none';
                });
                
                item.addEventListener('mouseover', function() {
                    activeSuggestionIndex = index;
                    updateActiveSuggestion(addressSuggestions.querySelectorAll('.location-suggestion-item'));
                });
                
                addressSuggestions.appendChild(item);
            });
        }

        function updateActiveSuggestion(items) {
            items.forEach((item, index) => {
                item.classList.toggle('active', index === activeSuggestionIndex);
                
                if (index === activeSuggestionIndex) {
                    item.scrollIntoView({ block: 'nearest' });
                }
            });
        }

        function updateMapPreview(lat, lon) {
            mapPreview.style.display = 'block';
            
            if (!map) {
                map = L.map('mapPreview').setView([lat, lon], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);
                
                marker = L.marker([lat, lon]).addTo(map)
                    .bindPopup('Service Location')
                    .openPopup();
            } else {
                map.setView([lat, lon], 15);
                marker.setLatLng([lat, lon]);
            }
        }

        // Show custom date inputs when "Custom time slot" is selected
        if (hasSchedule) {
            const scheduleSelect = modal.querySelector('#scheduleSelect');
            const customDateContainer = modal.querySelector('#customDateContainer');

            scheduleSelect.addEventListener('change', (e) => {
                customDateContainer.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        }

        // Handle modal close
        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.onclick = () => {
            modal.remove();
            document.body.style.overflow = '';
        };

        // Handle form submission
        const bookingForm = modal.querySelector('#bookingForm');
        bookingForm.onsubmit = async (e) => {
            e.preventDefault();

            const serviceType = document.getElementById('serviceType').value.trim();
            const description = document.getElementById('description').value.trim();
            const address = document.getElementById('address').value.trim();
            const city = document.getElementById('city').value.trim();
            const postalCode = document.getElementById('postalCode').value.trim();
            const province = document.getElementById('province').value.trim();
            const country = document.getElementById('country').value.trim();
            const latitude = document.getElementById('latitude').value;
            const longitude = document.getElementById('longitude').value;

            // Validate required fields
            if (!serviceType || !description || !address || !city || !postalCode || !province || !country) {
                showToast('Please fill in all required fields', 'error');
                return;
            }

            if (!latitude || !longitude) {
                showToast('Please select a valid address from the suggestions', 'error');
                return;
            }

            let startDate, endDate;

            if (hasSchedule) {
                const scheduleSelect = document.getElementById('scheduleSelect');
                const selectedScheduleId = scheduleSelect.value;

                if (!selectedScheduleId) {
                    showToast('Please select a time slot or choose custom', 'error');
                    return;
                }

                if (selectedScheduleId === 'custom') {
                    const startInput = document.getElementById('customStartDate').value;
                    const endInput = document.getElementById('customEndDate').value;

                    if (!startInput || !endInput) {
                        showToast('Please enter custom start and end times', 'error');
                        return;
                    }

                    startDate = new Date(startInput);
                    endDate = new Date(endInput);
                } else {
                    const selectedSchedule = schedules.find(s => s.schedule_id === selectedScheduleId);
                    startDate = new Date(selectedSchedule.start_time);
                    endDate = new Date(selectedSchedule.end_time);
                }
            } else {
                const startInput = document.getElementById('startDate').value;
                const endInput = document.getElementById('endDate').value;

                if (!startInput || !endInput) {
                    showToast('Please enter start and end times', 'error');
                    return;
                }

                startDate = new Date(startInput);
                endDate = new Date(endInput);
            }

            const token = localStorage.getItem('access_token');
            const submitBtn = bookingForm.querySelector('.btn-submit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';

            try {
                const response = await fetch('http://10.2.43.224:8000/bookings', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        technician_id: technicianId,
                        service_type: serviceType,
                        description: description,
                        start_date: formatDateForPostgres(startDate),
                        end_date: formatDateForPostgres(endDate),
                        client_address: address,
                        client_city: city,
                        client_postal_code: postalCode,
                        client_province: province,
                        client_country: country,
                        client_latitude: parseFloat(latitude),
                        client_longitude: parseFloat(longitude)
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Booking failed');
                }

                const bookingData = await response.json();
                modal.remove();
                document.body.style.overflow = '';

                // Show success message
                const successModal = document.createElement('div');
                successModal.className = 'booking-modal';
                successModal.innerHTML = `
                    <div class="modal-content success">
                        <h3>Booking Request Sent!</h3>
                        <p>Your booking for <strong>${serviceType}</strong> has been submitted successfully.</p>
                        <p>Technician: ${technicianName}</p>
                        <p>Location: ${address}, ${city}, ${province}, ${country}</p>
                        <p>Booking ID: ${bookingData.booking_id}</p>
                        <p>Status: <span class="status-pending">Pending</span></p>
                        <div class="modal-actions">
                            <button class="btn-close" onclick="this.parentElement.parentElement.remove()">Close</button>
                            <button class="btn-view" onclick="showBookingDetails('${bookingData.booking_id}')">
                                View Details
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(successModal);

            } catch (error) {
                console.error('Booking error:', error);
                showToast(`Booking failed: ${error.message}`, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Booking';
            }
        };

        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
                document.body.style.overflow = '';
            }
        };

    } catch (error) {
        console.error('Error creating booking modal:', error);
        showToast('Failed to initiate booking. Please try again.', 'error');
    }
};

window.viewTechnicianProfile = async function (technicianId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/technicians/${technicianId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load technician profile');
        }

        const technician = await response.json();
        displayTechnicianProfileModal(technician);
    } catch (error) {
        console.error('Error viewing technician profile:', error);
        showToast('Failed to load technician profile', 'error');
    }
};

function displayTechnicianProfileModal(technician) {
    const modal = document.createElement('div');
    modal.className = 'profile-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <div class="profile-header">
                <img src="${technician.profile_picture_url || '/assets/profile-placeholder.png'}" 
                     alt="${technician.name}" 
                     class="profile-avatar"
                     onerror="this.src='/assets/profile-placeholder.png'">
                <div class="profile-info">
                    <h3>${technician.name} ${technician.surname}</h3>
                    <p class="profile-specialty">${technician.service_types?.join(', ') || 'General Technician'}</p>
                    <div class="profile-rating">
                        ${generateStarRating(technician.avg_rating || 0)}
                        <span>${(technician.avg_rating || 0).toFixed(1)} (${technician.review_count || 0} reviews)</span>
                    </div>
                </div>
            </div>
            <div class="profile-details">
                <div class="detail-section">
                    <h4>About</h4>
                    <p>${technician.bio || 'No bio available'}</p>
                </div>
                <div class="detail-section">
                    <h4>Services</h4>
                    <ul class="service-list">
                        ${technician.service_types?.map(service => `<li>${service}</li>`).join('') || '<li>No specific services listed</li>'}
                    </ul>
                </div>
                <div class="profile-actions">
                    <button class="btn-favorite" onclick="toggleFavorite('${technician.technician_id}', this)">
                        <i class="fas fa-heart"></i> Favorite
                    </button>
                    <button class="btn-book" onclick="bookTechnicianFromSearch('${technician.technician_id}', '${technician.name} ${technician.surname}')">
                        <i class="fas fa-calendar-plus"></i> Book Now
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close modal
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => modal.remove();

    // Close when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

window.viewExternalTechnician = function (name, lat, lng) {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}@${lat},${lng}`;
    window.open(mapsUrl, '_blank');
};

// Helper functions
function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'in_progress': 'In Progress',
        'offered': 'Offer Sent',
        'rejected': 'Rejected'
    };
    return statusMap[status?.toLowerCase()] || status;
}

function formatDate(dateString) {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateForPostgres(date) {
    return date.toISOString().replace('Z', '');
}

function generateStarRating(rating) {
    const numericRating = Number(rating) || 0;
    const fullStars = Math.floor(numericRating);
    const hasHalfStar = numericRating % 1 >= 0.5;
    let stars = '';

    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<i class="fas fa-star"></i>';
        } else if (i === fullStars && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        } else {
            stars += '<i class="far fa-star"></i>';
        }
    }

    return stars;
}

async function getTechnicianSchedule(technicianId) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://10.2.43.224:8000/schedule/technician/${technicianId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load technician schedule');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching technician schedule:', error);
        return [];
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS for the new elements
const style = document.createElement('style');
style.textContent = `
.location-suggestions {
    position: absolute;
    width: calc(100% - 30px);
    max-height: 200px;
    overflow-y: auto;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    z-index: 1000;
    display: none;
    margin-top: 5px;
}

.location-suggestion-item {
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid #eee;
}

.location-suggestion-item:hover, .location-suggestion-item.active {
    background-color: #f5f5f5;
}

.location-suggestion-item:last-child {
    border-bottom: none;
}

.location-loading {
    padding: 8px 12px;
    color: #666;
    font-style: italic;
}

.address-group {
    position: relative;
}

.booking-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    overflow-y: auto;
    padding: 20px;
}

.booking-modal .modal-content {
    background-color: white;
    border-radius: 8px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    position: relative;
    padding: 25px;
}

.booking-modal .close-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    background: none;
    border: none;
    z-index: 1;
}

.booking-modal .form-scroll-container {
    max-height: calc(90vh - 150px);
    overflow-y: auto;
    padding-right: 10px;
}

.booking-modal .form-group {
    margin-bottom: 15px;
}

.booking-modal label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #444;
}

.booking-modal input,
.booking-modal textarea,
.booking-modal select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
}

.booking-modal textarea {
    resize: vertical;
    min-height: 100px;
}

.booking-modal .btn-submit {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    width: 100%;
    transition: background-color 0.3s;
}

.booking-modal .btn-submit:hover {
    background-color: #45a049;
}

.booking-modal .btn-submit:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}

.tech-booking-for {
    margin-bottom: 15px;
    color: #666;
}

/* Custom scrollbar */
.booking-modal .form-scroll-container::-webkit-scrollbar {
    width: 8px;
}

.booking-modal .form-scroll-container::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.booking-modal .form-scroll-container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
}

.booking-modal .form-scroll-container::-webkit-scrollbar-thumb:hover {
    background: #555;
}

/* Success modal */
.booking-modal .modal-content.success {
    text-align: center;
}

.modal-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.modal-actions button {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}

.modal-actions .btn-close {
    background-color: #f8f9fa;
    color: #6c757d;
}

.modal-actions .btn-close:hover {
    background-color: #e9ecef;
}

.modal-actions .btn-view {
    background-color: #2a5bd7;
    color: white;
}

.modal-actions .btn-view:hover {
    background-color: #1e4bbb;
}

.status-pending {
    color: #FFA500;
    font-weight: bold;
}

.toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    transform: translateX(0);
    transition: transform 0.3s ease, opacity 0.3s ease;
}

.toast-success {
    background-color: #4CAF50;
}

.toast-error {
    background-color: #F44336;
}

.toast-info {
    background-color: #2196F3;
}

.toast i {
    font-size: 18px;
}

.fade-out {
    opacity: 0;
    transform: translateX(100%);
}
`;
document.head.appendChild(style);

// Add Leaflet CSS if not already added
if (!document.querySelector('link[href*="leaflet"]')) {
    const leafletCSS = document.createElement('link');
    leafletCSS.rel = 'stylesheet';
    leafletCSS.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
    document.head.appendChild(leafletCSS);
}

// Add Leaflet JS if not already added
if (!document.querySelector('script[src*="leaflet"]')) {
    const leafletJS = document.createElement('script');
    leafletJS.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
    document.head.appendChild(leafletJS);
}