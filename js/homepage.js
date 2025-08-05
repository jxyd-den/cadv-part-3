document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://bfav8bi1v2.execute-api.us-east-1.amazonaws.com/stalls';
    const stallsGrid = document.getElementById("stallsGrid");
    const loadingContainer = document.getElementById("loadingContainer");
    const searchInput = document.getElementById("searchInput");
    const clearSearch = document.getElementById("clearSearch");
    const filterBtn = document.getElementById("filterBtn");
    const profileBtn = document.getElementById("profileBtn");
    const cartBtn = document.getElementById("cartBtn"); // Add this line

    let allStalls = []; // Store all stalls for filtering
    let currentFilters = {
        sortOrder: 'asc', // 'asc' or 'desc'
        location: 'all' // 'all' or specific location
    };

    async function loadStallsFromDynamoDB() {
        try {
            // Show loading
            loadingContainer.style.display = "flex";

            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const responseData = await response.json();
            console.log('API Response:', responseData);

            // Handle different response formats
            let stallsArray = [];
            if (responseData.success && Array.isArray(responseData.data)) {
                stallsArray = responseData.data;
            } else if (Array.isArray(responseData.Items)) {
                stallsArray = responseData.Items;
            } else if (Array.isArray(responseData)) {
                stallsArray = responseData;
            }

            if (!stallsArray || stallsArray.length === 0) {
                stallsGrid.innerHTML = "<p>No stalls found.</p>";
                allStalls = [];
            } else {
                allStalls = stallsArray; // Store all stalls
                setupFilterPanel(); // Setup filter panel first
                applyFiltersAndDisplay(); // Apply filters and display
            }

        } catch (error) {
            console.error("Error loading stalls:", error);
            stallsGrid.innerHTML = "<p>Error loading stall data.</p>";
            allStalls = [];
        } finally {
            // Hide loading
            loadingContainer.style.display = "none";
        }
    }

    function displayStalls(stallsToShow) {
        if (!stallsToShow || stallsToShow.length === 0) {
            stallsGrid.innerHTML = `
                <div class="no-results">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                        <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h3>No stalls found</h3>
                    <p>Try adjusting your search terms or filters</p>
                </div>
            `;
            return;
        }

        stallsGrid.innerHTML = "";
        stallsToShow.forEach(stall => {
            // CREATE the stallElement here
            const stallElement = document.createElement("div");
            stallElement.className = "stall-card";

            // Add click event listener to navigate to menu page
            stallElement.addEventListener('click', () => {
                console.log('Stall clicked:', stall);
                sessionStorage.setItem('selectedStall', JSON.stringify(stall));
                const stallId = stall.stall_id || stall.id;
                console.log('Navigating to menu.html with stallId:', stallId);
                window.location.href = `menu.html?stallId=${stallId}`;
            });

            // Handle both full URLs and relative paths with URL encoding
            let imageHTML = '';
            if (stall.stall_image && stall.stall_image.trim()) {
                const imageValue = stall.stall_image.trim();
                let imagePath;

                // Check if it's already a full URL
                if (imageValue.startsWith('http://') || imageValue.startsWith('https://')) {
                    // Convert S3 API URL to S3 Website URL
                    if (imageValue.includes('s3.us-east-1.amazonaws.com') || imageValue.includes('s3.amazonaws.com')) {
                        // Extract just the filename from the URL
                        let filename = imageValue.split('/').pop();
                        // Decode URL encoding: convert + to spaces and decode %20 etc.
                        filename = decodeURIComponent(filename.replace(/\+/g, ' '));
                        // Use relative path with Images folder (capital I)
                        imagePath = `./Images/${filename}`;
                    } else {
                        // It's some other external URL, use as is
                        imagePath = imageValue;
                    }
                } else {
                    let filename = imageValue.replace(/\+/g, ' '); // Convert + to spaces
                    filename = decodeURIComponent(filename);
                    imagePath = `./Images/${filename}`;
                }

                console.log('Original image value:', imageValue);
                console.log('Final image path:', imagePath);

                imageHTML = `
                    <img src="${imagePath}" 
                         alt="${stall.stall_name}" 
                         style="width: 100%; height: 200px; object-fit: cover;" 
                         onerror="console.error('Failed to load image:', '${imagePath}'); this.style.display='none';"
                         onload="console.log('Image loaded successfully:', '${imagePath}')">
                `;
            } else {
                imageHTML = `
                    <div style="width: 100%; height: 200px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
                `;
            }

            stallElement.innerHTML = `
                <div class="stall-image">
                    ${imageHTML}
                    <div class="stall-id">ID: ${stall.stall_id || stall.id || 'N/A'}</div>
                </div>
                <div class="stall-info">
                    <h3 class="stall-name">${stall.stall_name || stall.name || 'Unknown Stall'}</h3>
                    <p class="stall-description">${stall.stall_description || stall.description || 'No description'}</p>
                    <p class="stall-location"><strong>Location:</strong> <span>${stall.stall_location || stall.location || 'N/A'}</span></p>
                    <div class="view-menu-btn">
                        <span>Click to view menu</span>
                    </div>
                </div>
            `;
            stallsGrid.appendChild(stallElement);
        });
    }

    function filterStalls(searchTerm) {
        if (!searchTerm.trim()) {
            return allStalls; // Return all stalls if search is empty
        }

        const filtered = allStalls.filter(stall => {
            const stallName = (stall.stall_name || stall.name || '').toLowerCase();
            const stallDescription = (stall.stall_description || stall.description || '').toLowerCase();
            const stallLocation = (stall.stall_location || stall.location || '').toLowerCase();
            const search = searchTerm.toLowerCase().trim();

            // Search in name, description, and location
            return stallName.includes(search) ||
                stallDescription.includes(search) ||
                stallLocation.includes(search);
        });

        return filtered;
    }

    function applyFilters(stalls) {
        let filteredStalls = [...stalls];

        // Filter by location
        if (currentFilters.location !== 'all') {
            filteredStalls = filteredStalls.filter(stall => {
                const stallLocation = (stall.stall_location || stall.location || '').toLowerCase();
                return stallLocation.includes(currentFilters.location.toLowerCase());
            });
        }

        // Sort by stall_id
        filteredStalls.sort((a, b) => {
            const idA = parseInt(a.stall_id || a.id || '0');
            const idB = parseInt(b.stall_id || b.id || '0');

            if (currentFilters.sortOrder === 'asc') {
                return idA - idB;
            } else {
                return idB - idA;
            }
        });

        return filteredStalls;
    }

    function applyFiltersAndDisplay() {
        const searchTerm = searchInput ? searchInput.value : '';
        let stallsToShow = allStalls;

        // Apply search filter first
        if (searchTerm.trim()) {
            stallsToShow = filterStalls(searchTerm);
        }

        // Apply other filters
        stallsToShow = applyFilters(stallsToShow);

        // Display results
        displayStalls(stallsToShow);
        updateActiveFilters();
    }

    function getUniqueLocations() {
        const locations = allStalls.map(stall =>
            (stall.stall_location || stall.location || 'N/A').trim()
        ).filter(location => location && location !== 'N/A');

        return [...new Set(locations)].sort();
    }

    function setupFilterPanel() {
        // Update the existing filter panel in HTML instead of creating a new one
        const filterPanel = document.getElementById('filterPanel');
        if (!filterPanel) return;

        // Replace the existing filter content with our custom filters
        const filterContent = filterPanel.querySelector('.filter-content');
        if (filterContent) {
            filterContent.innerHTML = `
                <div class="filter-header">
                    <h3>Filter Options</h3>
                    <button class="close-filter-btn" id="closeFilterBtn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
                            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
                <div class="filter-options">
                    <div class="filter-group">
                        <label for="sortOrder">Sort by ID:</label>
                        <select id="sortOrder" class="filter-select">
                            <option value="asc">Ascending (1, 2, 3...)</option>
                            <option value="desc">Descending (3, 2, 1...)</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="locationFilter">Filter by Location:</label>
                        <select id="locationFilter" class="filter-select">
                            <option value="all">All Locations</option>
                        </select>
                    </div>
                    <div class="filter-actions">
                        <button class="clear-filters-btn" id="clearFiltersBtn">Clear All Filters</button>
                        <button class="apply-filters-btn" id="applyFiltersBtn">Apply Filters</button>
                    </div>
                </div>
            `;
        }

        // Populate location options
        const locationSelect = document.getElementById('locationFilter');
        if (locationSelect) {
            const locations = getUniqueLocations();
            locationSelect.innerHTML = '<option value="all">All Locations</option>';
            locations.forEach(location => {
                const option = document.createElement('option');
                option.value = location;
                option.textContent = location;
                locationSelect.appendChild(option);
            });
        }

        // Setup event listeners
        setupFilterEventListeners();
    }

    function setupFilterEventListeners() {
        const filterPanel = document.getElementById('filterPanel');
        const closeFilterBtn = document.getElementById('closeFilterBtn');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        const applyFiltersBtn = document.getElementById('applyFiltersBtn');
        const sortOrder = document.getElementById('sortOrder');
        const locationFilter = document.getElementById('locationFilter');

        // Filter button click 
        if (filterBtn) {
            // Remove any existing listeners first
            filterBtn.replaceWith(filterBtn.cloneNode(true));
            const newFilterBtn = document.getElementById("filterBtn");

            newFilterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Filter button clicked!'); // Debug log

                if (filterPanel) {
                    console.log('Adding active class to filter panel'); // Debug log
                    filterPanel.classList.add('active');
                } else {
                    console.log('Filter panel not found!'); // Debug log
                }
            });
        }

        // Close filter panel
        if (closeFilterBtn) {
            closeFilterBtn.addEventListener('click', () => {
                console.log('Close filter button clicked!'); // Debug log
                filterPanel.classList.remove('active');
            });
        }

        // Apply filters
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                console.log('Apply filters clicked!'); // Debug log
                currentFilters.sortOrder = sortOrder.value;
                currentFilters.location = locationFilter.value;
                applyFiltersAndDisplay();
                filterPanel.classList.remove('active');
            });
        }

        // Clear all filters
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                console.log('Clear filters clicked!'); // Debug log
                currentFilters.sortOrder = 'asc';
                currentFilters.location = 'all';
                sortOrder.value = 'asc';
                locationFilter.value = 'all';
                applyFiltersAndDisplay();
            });
        }

        // Close filter panel when clicking outside
        filterPanel.addEventListener('click', (e) => {
            if (e.target === filterPanel) {
                filterPanel.classList.remove('active');
            }
        });
    }

    function updateActiveFilters() {
        let activeFiltersContainer = document.getElementById('activeFilters');
        if (!activeFiltersContainer) {
            // Create active filters container
            activeFiltersContainer = document.createElement('div');
            activeFiltersContainer.id = 'activeFilters';
            activeFiltersContainer.className = 'active-filters';

            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                const stallsGridContainer = document.getElementById('stallsGrid').parentNode;
                mainContent.insertBefore(activeFiltersContainer, stallsGridContainer);
            }
        }

        const activeFilters = [];

        if (currentFilters.sortOrder === 'desc') {
            activeFilters.push({ type: 'sort', label: 'Sort: Descending', value: 'sortOrder' });
        }

        if (currentFilters.location !== 'all') {
            activeFilters.push({ type: 'location', label: `Location: ${currentFilters.location}`, value: 'location' });
        }

        if (activeFilters.length > 0) {
            activeFiltersContainer.style.display = 'flex';
            activeFiltersContainer.innerHTML = `
                <div class="filter-tags">
                    ${activeFilters.map(filter => `
                        <span class="filter-tag">
                            ${filter.label}
                            <button onclick="removeFilter('${filter.value}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
                                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
                                </svg>
                            </button>
                        </span>
                    `).join('')}
                </div>
                <button class="clear-all-filters" onclick="clearAllFilters()">Clear All Filters</button>
            `;
        } else {
            activeFiltersContainer.style.display = 'none';
        }
    }

    // Global functions for filter removal
    window.removeFilter = function (filterType) {
        if (filterType === 'sortOrder') {
            currentFilters.sortOrder = 'asc';
        } else if (filterType === 'location') {
            currentFilters.location = 'all';
        }
        applyFiltersAndDisplay();
    };

    window.clearAllFilters = function () {
        currentFilters.sortOrder = 'asc';
        currentFilters.location = 'all';
        applyFiltersAndDisplay();
    };

    function handleSearch() {
        applyFiltersAndDisplay();

        // Show/hide clear button
        if (searchInput && searchInput.value.trim()) {
            if (clearSearch) clearSearch.style.display = 'flex';
        } else {
            if (clearSearch) clearSearch.style.display = 'none';
        }
    }

    // Search functionality
    if (searchInput) {
        // Real-time search as user types
        searchInput.addEventListener('input', handleSearch);

        // Handle Enter key
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
    }

    // Clear search functionality
    if (clearSearch) {
        clearSearch.addEventListener('click', function () {
            searchInput.value = '';
            clearSearch.style.display = 'none';
            applyFiltersAndDisplay();
            searchInput.focus(); // Keep focus on search input
        });
    }

    // Profile functionality
    if (profileBtn) {
        profileBtn.addEventListener('click', handleProfileClick);
    }

    function getCurrentUserId() {
        console.log('=== getCurrentUserId() called ===');

        // Extract Cognito user ID from authentication data
        const userAuthData = sessionStorage.getItem('userAuth');
        if (userAuthData) {
            try {
                const authData = JSON.parse(userAuthData);
                console.log('Parsed userAuth data:', authData);

                if (authData.AuthenticationResult) {
                    const authResult = authData.AuthenticationResult;

                    // Try to get user ID from AccessToken (JWT)
                    if (authResult.AccessToken) {
                        try {
                            const tokenParts = authResult.AccessToken.split('.');
                            if (tokenParts.length === 3) {
                                const payload = JSON.parse(atob(tokenParts[1]));
                                console.log('Decoded AccessToken payload:', payload);

                                // Cognito stores user ID in 'username' or 'sub' field
                                const cognitoUserId = payload.username || payload.sub || payload['cognito:username'];
                                if (cognitoUserId) {
                                    console.log('Found Cognito userId from AccessToken:', cognitoUserId);
                                    return cognitoUserId;
                                }
                            }
                        } catch (jwtError) {
                            console.error('Error decoding AccessToken:', jwtError);
                        }
                    }

                    // Fallback to IdToken
                    if (authResult.IdToken) {
                        try {
                            const tokenParts = authResult.IdToken.split('.');
                            if (tokenParts.length === 3) {
                                const payload = JSON.parse(atob(tokenParts[1]));
                                console.log('Decoded IdToken payload:', payload);

                                const cognitoUserId = payload['cognito:username'] || payload.username || payload.sub;
                                if (cognitoUserId) {
                                    console.log('Found Cognito userId from IdToken:', cognitoUserId);
                                    return cognitoUserId;
                                }
                            }
                        } catch (jwtError) {
                            console.error('Error decoding IdToken:', jwtError);
                        }
                    }
                }
            } catch (error) {
                console.error('Error parsing userAuth data:', error);
            }
        }

        console.log('No valid Cognito userId found');
        return null;
    }

    // New function to get user profile data from Cognito
    function getUserProfile() {
        const userAuthData = sessionStorage.getItem('userAuth');
        if (!userAuthData) {
            console.log('No user auth data found');
            return null;
        }

        try {
            const authData = JSON.parse(userAuthData);
            if (authData.AuthenticationResult && authData.AuthenticationResult.IdToken) {
                const tokenParts = authData.AuthenticationResult.IdToken.split('.');
                if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1]));
                    console.log('User profile from Cognito:', payload);

                    // Extract user profile information
                    return {
                        userId: payload['cognito:username'] || payload.username || payload.sub,
                        email: payload.email,
                        emailVerified: payload.email_verified,
                        fullName: payload.name || payload.given_name + ' ' + payload.family_name,
                        firstName: payload.given_name,
                        lastName: payload.family_name,
                        phone: payload.phone_number,
                        phoneVerified: payload.phone_number_verified,
                        createdAt: new Date(payload.auth_time * 1000).toISOString(),
                        // Add any other Cognito attributes you've configured
                    };
                }
            }
        } catch (error) {
            console.error('Error extracting user profile:', error);
        }

        return null;
    }

    // New function to get auth token for API calls
    function getAuthToken() {
        const userAuthData = sessionStorage.getItem('userAuth');
        if (userAuthData) {
            try {
                const authData = JSON.parse(userAuthData);
                return authData.AuthenticationResult?.AccessToken;
            } catch (error) {
                console.error('Error getting auth token:', error);
            }
        }
        return null;
    }

    // Updated handleProfileClick function
    function handleProfileClick() {
        // Check if user is logged in
        const userId = getCurrentUserId();

        if (!userId) {
            // User not logged in, redirect to login
            showMessage('Please log in to access your profile.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }

        // Get user profile data and store it for the profile page
        const userProfile = getUserProfile();
        if (userProfile) {
            sessionStorage.setItem('userProfile', JSON.stringify(userProfile));
            console.log('User profile data stored:', userProfile);
        }

        // User is logged in, navigate to profile page
        console.log('Navigating to profile page for user:', userId);

        // Add loading state to profile button
        profileBtn.classList.add('loading');
        profileBtn.innerHTML = `
            <div style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        `;

        // Navigate to profile page
        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 500);
    }

    // Enhanced setupProfileButtonStates function
    function setupProfileButtonStates() {
        if (!profileBtn) return;

        const userId = getCurrentUserId();
        const userProfile = getUserProfile();

        if (userId) {
            // User is logged in - show active state
            profileBtn.classList.add('authenticated');

            // Show user's name or email in tooltip if available
            if (userProfile && userProfile.email) {
                profileBtn.title = `View Profile (${userProfile.email})`;
            } else {
                profileBtn.title = 'View Profile';
            }

            // Add user indicator
            const userIndicator = document.createElement('div');
            userIndicator.className = 'user-indicator';
            userIndicator.style.cssText = `
                position: absolute;
                top: -2px;
                right: -2px;
                width: 8px;
                height: 8px;
                background: #10b981;
                border: 2px solid white;
                border-radius: 50%;
                z-index: 1;
            `;

            // Only add indicator if it doesn't exist
            if (!profileBtn.querySelector('.user-indicator')) {
                profileBtn.style.position = 'relative';
                profileBtn.appendChild(userIndicator);
            }
        } else {
            // User not logged in - show default state
            profileBtn.classList.remove('authenticated');
            profileBtn.title = 'Login to view profile';

            // Remove user indicator if exists
            const existingIndicator = profileBtn.querySelector('.user-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
        }
    }

    // Debug function for authentication state
    function debugAuthenticationState() {
        console.log('=== AUTHENTICATION DEBUG ===');
        console.log('localStorage.userId:', localStorage.getItem('userId'));
        console.log('sessionStorage.userId:', sessionStorage.getItem('userId'));
        console.log('localStorage.currentUser:', localStorage.getItem('currentUser'));
        console.log('sessionStorage.currentUser:', sessionStorage.getItem('currentUser'));
        console.log('localStorage.authToken:', localStorage.getItem('authToken'));
        console.log('sessionStorage.authToken:', sessionStorage.getItem('authToken'));

        // Show raw content of the actual storage keys
        console.log('--- RAW STORAGE CONTENT ---');
        console.log('localStorage.rememberUser (raw):', localStorage.getItem('rememberUser'));
        console.log('sessionStorage.userAuth (raw):', sessionStorage.getItem('userAuth'));
        console.log('sessionStorage.userSession (raw):', sessionStorage.getItem('userSession'));
        console.log('localStorage.cart (raw):', localStorage.getItem('cart'));

        console.log('All localStorage keys:', Object.keys(localStorage));
        console.log('All sessionStorage keys:', Object.keys(sessionStorage));
        console.log('==============================');
    }

    // Check authentication status
    function checkAuthenticationStatus() {
        debugAuthenticationState();

        const userId = getCurrentUserId();

        if (!userId) {
            console.log('User not authenticated');

        } else {
            console.log('User authenticated:', userId);
            setupProfileButtonStates();
        }
    }

    // Enhanced logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear all authentication data
            localStorage.removeItem('userId');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
            localStorage.removeItem('userProfile');
            sessionStorage.clear();

            // Show logout message
            showMessage('You have been logged out successfully.', 'success');

            // Redirect to login page after a short delay
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        }
    }

    // Initialize profile button states
    setupProfileButtonStates();
    checkAuthenticationStatus();

    // Load stalls on page load
    loadStallsFromDynamoDB();

    // Add cart functionality after your existing event listeners
    if (cartBtn) {
        cartBtn.addEventListener('click', handleCartClick);
    }

    // Cart navigation function
    function handleCartClick() {
        console.log('Cart button clicked');

        // Check if user is logged in
        const userId = getCurrentUserId();

        if (!userId) {
            // User not logged in, redirect to login
            showMessage('Please log in to view your cart.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }

        // User is logged in, navigate to cart page
        console.log('Navigating to cart page for user:', userId);

        // Add loading state to cart button
        cartBtn.classList.add('loading');
        const originalHTML = cartBtn.innerHTML;
        cartBtn.innerHTML = `
            <div style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        `;

        // Navigate to cart page
        setTimeout(() => {
            window.location.href = 'cart.html';
        }, 500);
    }

    // Optional cart count functionality
    async function updateCartCount() {
        const userId = getCurrentUserId();
        if (!userId) return;

        try {
            const cartId = `cart_${userId}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch(`https://3tdkq5ig1m.execute-api.us-east-1.amazonaws.com/cart/${cartId}/user/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                let items = [];

                if (Array.isArray(data)) {
                    items = data;
                } else if (data.items && Array.isArray(data.items)) {
                    items = data.items;
                } else if (data.cartItems && Array.isArray(data.cartItems)) {
                    items = data.cartItems;
                }

                const totalItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
                updateCartBadge(totalItems);
                console.log('âœ… Cart count updated successfully:', totalItems);
            } else if (response.status === 404) {
                console.log('â„¹ï¸ No cart found (new user) - showing 0 items');
                updateCartBadge(0);
            } else {
                console.log('âš ï¸ Cart API returned status:', response.status);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Cart count request timed out');
            } else if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                console.log('CORS issue with cart API - cart count disabled');
            } else {
                console.log('Cart count error:', error.message);
            }
            // Silently continue without showing error to user
        }
    }

    function updateCartBadge(count) {
        if (!cartBtn) return;

        // Remove existing badge
        const existingBadge = cartBtn.querySelector('.cart-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Add new badge if count > 0
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'cart-badge';
            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                background: #dc2626;
                color: white;
                font-size: 0.75rem;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 10px;
                min-width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1;
            `;

            cartBtn.style.position = 'relative';
            cartBtn.appendChild(badge);
        }
    }

    // Logout functionality
    function logout() {
        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to logout?');

        if (confirmed) {
            try {
                // Clear session storage

                // Cart navigation function
                function goToCart() {
                    console.log('Cart button clicked');

                    // Check if user is logged in
                    const userId = getCurrentUserId();

                    if (!userId) {
                        // User not logged in, redirect to login
                        showMessage('Please log in to view your cart.', 'error');
                        setTimeout(() => {
                            window.location.href = 'login.html';
                        }, 1500);
                        return;
                    }

                    // User is logged in, navigate to cart page
                    console.log('Navigating to cart page for user:', userId);

                    // Add loading state to cart button
                    const cartBtn = document.getElementById('cartBtn');
                    if (cartBtn) {
                        cartBtn.classList.add('loading');
                        const originalHTML = cartBtn.innerHTML;
                        cartBtn.innerHTML = `
                            <div style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        `;
                    }

                    // Navigate to cart page
                    setTimeout(() => {
                        window.location.href = 'cart.html';
                    }, 500);
                }

                // Make the function globally available
                window.goToCart = goToCart; sessionStorage.removeItem('userAuth');
                sessionStorage.removeItem('currentUser');

                // Clear local storage cart data
                const currentUser = getCurrentUser();
                if (currentUser) {
                    localStorage.removeItem(`cart_${currentUser.userId}`);
                }

                // Clear all localStorage items related to user session
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('cart_') || key.includes('user')) {
                        localStorage.removeItem(key);
                    }
                });

                // Show logout message
                showMessage('Logged out successfully', 'success');

                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);

            } catch (error) {
                console.error('Error during logout:', error);
                showMessage('Error during logout', 'error');

                // Force redirect even if there's an error
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        }
    }

    // Cart navigation function
    function goToCart() {
        console.log('Cart button clicked');

        // Check if user is logged in
        const userId = getCurrentUserId();

        if (!userId) {
            // User not logged in, redirect to login
            showMessage('Please log in to view your cart.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }

        // User is logged in, navigate to cart page
        console.log('Navigating to cart page for user:', userId);

        // Add loading state to cart button
        const cartBtn = document.getElementById('cartBtn');
        if (cartBtn) {
            cartBtn.classList.add('loading');
            const originalHTML = cartBtn.innerHTML;
            cartBtn.innerHTML = `
                <div style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            `;
        }

        // Navigate to cart page
        setTimeout(() => {
            window.location.href = 'cart.html';
        }, 500);
    }

    // Make the function globally available
    window.goToCart = goToCart;

    // Add message display function if not already present
    function showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('messageContainer');
        const messageContent = document.getElementById('messageContent');

        if (!messageContainer || !messageContent) {
            // Fallback to alert if message container doesn't exist
            alert(message);
            return;
        }

        // Set message content
        messageContent.textContent = message;

        // Set message type styling
        messageContainer.className = `message-container show ${type}`;
        messageContainer.style.display = 'block';

        // Add appropriate styling based on type
        if (type === 'success') {
            messageContainer.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            messageContainer.style.color = 'white';
        } else if (type === 'error') {
            messageContainer.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            messageContainer.style.color = 'white';
        } else {
            messageContainer.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
            messageContainer.style.color = 'white';
        }

        // Hide message after 3 seconds
        setTimeout(() => {
            messageContainer.style.display = 'none';
            messageContainer.classList.remove('show', type);
        }, 3000);
    }
    console.log('Homepage initialized successfully');
});