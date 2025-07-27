document.addEventListener('DOMContentLoaded', () => {
    //Remove the template from the base URL
    const MENU_API_BASE_URL = 'https://onoknoex1f.execute-api.us-east-1.amazonaws.com/item';
    const FIXED_CATEGORIES = ['Appetizers', 'Entrees', 'Desserts', 'Sides', 'Drinks'];

    // DOM Elements
    const stallName = document.getElementById('stallName');
    const stallDescription = document.getElementById('stallDescription');
    const loadingContainer = document.getElementById('loadingContainer');
    const menuContainer = document.getElementById('menuContainer');
    const noResults = document.getElementById('noResults');
    const backBtn = document.getElementById('backBtn');
    const searchBtn = document.getElementById('searchBtn');
    const searchContainer = document.getElementById('searchContainer');
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    const cartBtn = document.getElementById('cartBtn');
    const cartCount = document.getElementById('cartCount');

    let stallData = null;
    let allMenuItems = [];
    let filteredMenuItems = [];
    let currentCategory = 'all';
    let currentSearchTerm = '';
    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    //Get item quantity in cart function
    function getItemQuantityInCart(itemId) {
        const cartItem = cart.find(item => (item.item_id || item.id) === itemId);
        return cartItem ? cartItem.quantity : 0;
    }

    // Category mapping function
    function mapToFixedCategory(itemCategory) {
        if (!itemCategory) return null;

        const category = itemCategory.toLowerCase().trim();

        // Direct matches
        const directMatch = FIXED_CATEGORIES.find(fixedCat =>
            fixedCat.toLowerCase() === category
        );
        if (directMatch) return directMatch;

        // Fuzzy matching
        if (category.includes('appetizer') || category.includes('starter') || category.includes('snack')) {
            return 'Appetizers';
        }
        if (category.includes('entree') || category.includes('main') || category.includes('rice') ||
            category.includes('noodle') || category.includes('chicken') || category.includes('beef') ||
            category.includes('pork') || category.includes('fish') || category.includes('seafood')) {
            return 'Entrees';
        }
        if (category.includes('dessert') || category.includes('sweet') || category.includes('cake') ||
            category.includes('ice cream') || category.includes('pudding')) {
            return 'Desserts';
        }
        if (category.includes('side') || category.includes('vegetable') || category.includes('soup') ||
            category.includes('salad')) {
            return 'Sides';
        }
        if (category.includes('drink') || category.includes('beverage') || category.includes('juice') ||
            category.includes('tea') || category.includes('coffee') || category.includes('soda')) {
            return 'Drinks';
        }

        return null;
    }

    // Get stall information
    function getStallInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        const stallId = urlParams.get('stallId');

        const storedStall = sessionStorage.getItem('selectedStall');
        if (storedStall) {
            stallData = JSON.parse(storedStall);
            updateStallDisplay();
        }

        return stallId;
    }

    // Update stall display
    function updateStallDisplay() {
        if (!stallData) return;

        const name = stallData.stall_name || stallData.name || 'Unknown Stall';
        const description = stallData.stall_description || stallData.description || 'No description available';

        if (stallName) stallName.textContent = name;
        if (stallDescription) stallDescription.textContent = description;
        document.title = `${name} - Menu | FoodCourt Hub`;
    }

    // Load menu items
    async function loadMenuItems() {
        const stallId = getStallInfo();

        if (!stallId) {
            showError('No stall selected. Please go back and select a stall.');
            return;
        }

        try {
            loadingContainer.style.display = 'flex';
            menuContainer.style.display = 'none';
            noResults.style.display = 'none';

            const apiUrl = `${MENU_API_BASE_URL}/${stallId}`;
            console.log('Fetching menu items from:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const responseData = await response.json();
            console.log('Menu API Response:', responseData);

            // Handle different response formats
            let menuItemsArray = [];
            if (responseData.success && Array.isArray(responseData.data)) {
                menuItemsArray = responseData.data;
            } else if (Array.isArray(responseData.Items)) {
                menuItemsArray = responseData.Items;
            } else if (Array.isArray(responseData)) {
                menuItemsArray = responseData;
            }

            allMenuItems = menuItemsArray;
            filteredMenuItems = [...allMenuItems];

            if (allMenuItems.length === 0) {
                showNoResults();
            } else {
                setupCategoryChips();
                applyFilters();
            }

        } catch (error) {
            console.error('Error loading menu items:', error);
            showError('Failed to load menu items. Please try again.');
        } finally {
            loadingContainer.style.display = 'none';
        }
    }

    // Setup category chips
    function setupCategoryChips() {
        let categoryFilter = document.querySelector('.category-filter');
        if (!categoryFilter) {
            categoryFilter = document.createElement('div');
            categoryFilter.className = 'category-filter';

            const mainContent = document.querySelector('.main-content');
            mainContent.insertBefore(categoryFilter, mainContent.firstChild);
        }

        // Count items per category
        const categoryCounts = {};
        let totalMappedItems = 0;

        FIXED_CATEGORIES.forEach(category => {
            categoryCounts[category] = 0;
        });

        allMenuItems.forEach(item => {
            const originalCategory = item.category || item.item_category;
            const mappedCategory = mapToFixedCategory(originalCategory);

            if (mappedCategory) {
                categoryCounts[mappedCategory]++;
                totalMappedItems++;
            }
        });

        categoryFilter.innerHTML = `
            <h2>Menu Categories</h2>
            <div class="category-chips">
                <button class="category-chip active" data-category="all">
                    All Items
                    <span class="count">${totalMappedItems}</span>
                </button>
                ${FIXED_CATEGORIES.map(category => `
                    <button class="category-chip" data-category="${category}">
                        ${category}
                        <span class="count">${categoryCounts[category]}</span>
                    </button>
                `).join('')}
            </div>
        `;

        // Add event listeners
        const chips = categoryFilter.querySelectorAll('.category-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentCategory = chip.getAttribute('data-category');
                applyFilters();
            });
        });
    }

    // Apply filters
    function applyFilters() {
        filteredMenuItems = allMenuItems.filter(item => {
            const originalCategory = item.category || item.item_category;
            const mappedCategory = mapToFixedCategory(originalCategory);
            const name = (item.item_name || item.name || '').toLowerCase();
            const description = (item.item_description || item.description || '').toLowerCase();

            // Category filter
            if (currentCategory !== 'all') {
                if (mappedCategory !== currentCategory) {
                    return false;
                }
            } else {
                if (!mappedCategory) {
                    return false;
                }
            }

            // Search filter
            if (currentSearchTerm) {
                const searchLower = currentSearchTerm.toLowerCase();
                if (!name.includes(searchLower) && !description.includes(searchLower)) {
                    return false;
                }
            }

            return true;
        });

        displayMenuItems(filteredMenuItems);
    }

    // Display menu items
    function displayMenuItems(items) {
        if (!items || items.length === 0) {
            showNoResults();
            return;
        }

        // Group items by categories
        const categories = {};
        FIXED_CATEGORIES.forEach(category => {
            categories[category] = [];
        });

        items.forEach(item => {
            const originalCategory = item.category || item.item_category;
            const mappedCategory = mapToFixedCategory(originalCategory);

            if (mappedCategory) {
                categories[mappedCategory].push(item);
            }
        });

        menuContainer.innerHTML = '';
        menuContainer.style.display = 'block';
        menuContainer.classList.add('show');
        noResults.style.display = 'none';

        if (currentCategory !== 'all') {
            const categoryItems = categories[currentCategory] || [];
            if (categoryItems.length > 0) {
                const categorySection = createCategorySection(currentCategory, categoryItems);
                menuContainer.appendChild(categorySection);
            }
        } else {
            FIXED_CATEGORIES.forEach(categoryName => {
                const categoryItems = categories[categoryName];
                if (categoryItems && categoryItems.length > 0) {
                    const categorySection = createCategorySection(categoryName, categoryItems);
                    menuContainer.appendChild(categorySection);
                }
            });
        }

        setupQuantityControls();
    }

    // Create category section
    function createCategorySection(categoryName, categoryItems) {
        const categorySection = document.createElement('div');
        categorySection.className = 'menu-category';

        categorySection.innerHTML = `
            <div class="category-header">
                <h3 class="category-title">${categoryName}</h3>
                <span class="category-count">${categoryItems.length} items</span>
            </div>
            <div class="category-items">
                ${categoryItems.map(item => createMenuItemHTML(item)).join('')}
            </div>
        `;

        return categorySection;
    }

    // Create menu item HTML
    function createMenuItemHTML(item) {
        const name = item.item_name || item.name || 'Unknown Item';
        const description = item.item_description || item.description || 'No description';
        const itemId = item.item_id || item.id || 'N/A';

        // Fixed price parsing for DynamoDB item_cost field
        let price = 0;
        const priceValue = item.item_cost || item.price || item.item_price;

        if (priceValue !== undefined && priceValue !== null) {
            if (typeof priceValue === 'string') {
                const cleanPrice = priceValue.replace(/[$,]/g, '');
                price = parseFloat(cleanPrice) || 0;
            } else if (typeof priceValue === 'number') {
                price = priceValue;
            }
        }

        const formattedPrice = price.toFixed(2);
        const image = item.item_image || item.image;
        const availability = item.availability || item.is_available !== false;
        const id = item.item_id || item.id || Math.random().toString(36).substr(2, 9);
        const currentQuantity = getItemQuantityInCart(id);

        return `
            <div class="menu-item ${!availability ? 'unavailable' : ''}" data-item-id="${id}">
                <div class="item-image">
                    ${image && image.trim() ?
                `<img src="${image.trim()}" alt="${name}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                         <div class="fallback-image" style="display: none;">
                             <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                 <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2"/>
                             </svg>
                         </div>`
                :
                `<div class="fallback-image">
                             <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                 <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2"/>
                             </svg>
                         </div>`
            }
                    <div class="item-price">$${formattedPrice}</div>
                    ${!availability ? '<div class="unavailable-badge">Out of Stock</div>' : ''}
                </div>
                <div class="item-info">
                    <div class="item-header">
                    <span class="item-id">ID: ${itemId}</span>
                        <h4 class="item-name">${name}</h4>
                    </div>
                    <p class="item-description">${description}</p>
                    <div class="item-actions">
                        <div class="quantity-controls" data-item-id="${id}" data-item='${JSON.stringify(item).replace(/'/g, '&apos;')}'>
                            <button class="quantity-btn minus" ${currentQuantity === 0 || !availability ? 'disabled' : ''}>-</button>
                            <span class="quantity">${currentQuantity}</span>
                            <button class="quantity-btn plus" ${!availability ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    //Setup quantity controls
    function setupQuantityControls() {
        const quantityControls = document.querySelectorAll('.quantity-controls');

        quantityControls.forEach(control => {
            const itemId = control.getAttribute('data-item-id');
            const minusBtn = control.querySelector('.minus');
            const plusBtn = control.querySelector('.plus');
            const quantitySpan = control.querySelector('.quantity');

            // Get item data from the data attribute
            const itemData = JSON.parse(control.getAttribute('data-item').replace(/&apos;/g, "'"));

            // Remove any existing event listeners to prevent duplicates
            const newMinusBtn = minusBtn.cloneNode(true);
            const newPlusBtn = plusBtn.cloneNode(true);
            minusBtn.parentNode.replaceChild(newMinusBtn, minusBtn);
            plusBtn.parentNode.replaceChild(newPlusBtn, plusBtn);

            // Add event listeners
            newMinusBtn.addEventListener('click', (e) => {
                e.preventDefault();
                decreaseQuantity(itemData, quantitySpan, newMinusBtn);
            });

            newPlusBtn.addEventListener('click', (e) => {
                e.preventDefault();
                increaseQuantity(itemData, quantitySpan, newMinusBtn);
            });
        });
    }

    //Increase quantity
    async function increaseQuantity(item, quantitySpan, minusBtn) {
        const itemId = item.item_id || item.id;
        console.log('Adding item to cart:', item);

        try {
            // Check if user is logged in
            const userId = getCurrentUserId();
            if (!userId) {
                showMessage('Please log in to add items to cart', 'error');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
                return;
            }

            // First update local cart for immediate UI feedback
            const existingItem = cart.find(cartItem => (cartItem.item_id || cartItem.id) === itemId);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({
                    ...item,
                    quantity: 1,
                    stall_id: stallData?.stall_id || stallData?.id,
                    stall_name: stallData?.stall_name || stallData?.name
                });
            }

            // Update UI immediately
            const newQuantity = getItemQuantityInCart(itemId);
            quantitySpan.textContent = newQuantity;
            minusBtn.disabled = false;
            updateCartDisplay();
            saveCart();
            showAddToCartSuccess(item.item_name || item.name);

            // Then sync with API
            try {
                await addItemToCartAPI(item);
                console.log('Item successfully synced with API');
            } catch (apiError) {
                console.log('API sync failed, item saved locally:', apiError);
                showMessage('Item added to cart (offline mode)', 'info');
            }

        } catch (error) {
            console.error('Error adding item to cart:', error);
            showMessage('Failed to add item to cart', 'error');

            // Revert local changes if there's an error
            const existingItem = cart.find(cartItem => (cartItem.item_id || cartItem.id) === itemId);
            if (existingItem) {
                existingItem.quantity -= 1;
                if (existingItem.quantity <= 0) {
                    const index = cart.findIndex(cartItem => (cartItem.item_id || cartItem.id) === itemId);
                    cart.splice(index, 1);
                }
            }

            // Update UI to reflect revert
            const revertedQuantity = getItemQuantityInCart(itemId);
            quantitySpan.textContent = revertedQuantity;
            minusBtn.disabled = revertedQuantity === 0;
            updateCartDisplay();
            saveCart();
        }
    }

    //Decrease quantity
    async function decreaseQuantity(item, quantitySpan, minusBtn) {
        const itemId = item.item_id || item.id;
        const existingItem = cart.find(cartItem => (cartItem.item_id || cartItem.id) === itemId);

        if (!existingItem || existingItem.quantity <= 0) {
            return;
        }

        try {
            // Update local cart first
            existingItem.quantity -= 1;

            if (existingItem.quantity === 0) {
                const index = cart.findIndex(cartItem => (cartItem.item_id || cartItem.id) === itemId);
                cart.splice(index, 1);
                minusBtn.disabled = true;
            }

            const newQuantity = getItemQuantityInCart(itemId);
            quantitySpan.textContent = newQuantity;
            updateCartDisplay();
            saveCart();

            // Sync with API using correct endpoints
            const userId = getCurrentUserId();
            if (userId) {
                try {
                    const API_BASE_URL = 'https://rxi8ak16b7.execute-api.us-east-1.amazonaws.com';
                    const numericUserId = hashStringToNumber(userId);
                    const cartId = numericUserId;

                    if (newQuantity === 0) {
                        // Remove item from API
                        const response = await fetch(`${API_BASE_URL}/cart/${cartId}/user/${numericUserId}/item/${itemId}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${getAuthToken()}`
                            }
                        });

                        if (response.ok) {
                            console.log('Item removed from API cart');
                        } else {
                            console.error('Failed to remove item from API cart:', response.status);
                        }
                    } else {
                        // Update quantity in API 
                        const response = await fetch(`${API_BASE_URL}/cart/${cartId}/user/${numericUserId}/item/${itemId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${getAuthToken()}`
                            },
                            body: JSON.stringify({
                                quantity: newQuantity
                            })
                        });

                        if (response.ok) {
                            console.log('âœ… Item quantity updated in API cart');
                        } else {
                            console.error('Failed to update item quantity in API cart:', response.status);
                        }
                    }

                    console.log('Cart quantity synced with API');
                } catch (apiError) {
                    console.log('API sync failed for quantity update:', apiError);
                }
            }

        } catch (error) {
            console.error('Error updating cart:', error);
            showMessage('Failed to update cart', 'error');
        }
    }

    //Update cart display
    function updateCartDisplay() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCount) {
            cartCount.textContent = totalItems;
            cartCount.classList.toggle('show', totalItems > 0);
        }
    }

    //Save cart to localStorage
    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    // Show success toast
    function showAddToCartSuccess(itemName) {
        const message = document.createElement('div');
        message.className = 'toast-message success';
        message.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2"/>
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>${itemName} added to cart!</span>
        `;

        document.body.appendChild(message);

        setTimeout(() => message.classList.add('show'), 100);
        setTimeout(() => {
            message.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(message)) {
                    document.body.removeChild(message);
                }
            }, 300);
        }, 2000);
    }

    // Show error
    function showError(message) {
        menuContainer.innerHTML = `
            <div class="error-message">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
                    <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
                </svg>
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="goBack()" class="back-btn">Go Back</button>
            </div>
        `;
        menuContainer.style.display = 'block';
        menuContainer.classList.add('show');
        loadingContainer.style.display = 'none';
    }

    // Show no results
    function showNoResults() {
        noResults.style.display = 'block';
        menuContainer.style.display = 'none';
        menuContainer.classList.remove('show');
    }

    // Setup search functionality
    function setupSearch() {
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const isVisible = searchContainer.style.display !== 'none';
                searchContainer.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) {
                    searchInput.focus();
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                currentSearchTerm = searchInput.value.trim();
                applyFilters();

                if (clearSearch) {
                    clearSearch.style.display = currentSearchTerm ? 'block' : 'none';
                }
            });
        }

        if (clearSearch) {
            clearSearch.addEventListener('click', () => {
                searchInput.value = '';
                currentSearchTerm = '';
                clearSearch.style.display = 'none';
                applyFilters();
            });
        }
    }

    // Add cart button functionality
    if (cartBtn) {
        cartBtn.addEventListener('click', handleCartClick);
    }

    function handleCartClick() {
        console.log('Cart button clicked from menu page');

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

    function getCurrentUserId() {
        try {
            const userAuthData = sessionStorage.getItem('userAuth');
            if (userAuthData) {
                const authData = JSON.parse(userAuthData);
                if (authData.AuthenticationResult?.AccessToken) {
                    const tokenParts = authData.AuthenticationResult.AccessToken.split('.');
                    if (tokenParts.length === 3) {
                        const payload = JSON.parse(atob(tokenParts[1]));
                        return payload.sub || payload['cognito:username'] || payload.username;
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting user ID:', error);
            return null;
        }
    }

    function getAuthToken() {
        try {
            const userAuthData = sessionStorage.getItem('userAuth');
            if (userAuthData) {
                const authData = JSON.parse(userAuthData);
                return authData.AuthenticationResult?.AccessToken || '';
            }
            return '';
        } catch (error) {
            console.error('Error getting auth token:', error);
            return '';
        }
    }

    async function addItemToCartAPI(item) {
        try {
            const API_BASE_URL = 'https://rxi8ak16b7.execute-api.us-east-1.amazonaws.com';
            const currentUser = getCurrentUserId();

            if (!currentUser) {
                throw new Error('User not logged in');
            }

            const numericUserId = hashStringToNumber(currentUser);
            const cartId = numericUserId;

            // Prepare item data for API 
            const itemData = {
                item_id: item.item_id || item.id,
                name: item.item_name || item.name,              // Lambda expects 'name'
                cost: item.item_cost || item.price || item.item_price,  // Lambda expects 'cost'
                description: item.item_description || item.description,  // Lambda expects 'description'
                image: item.item_image || item.image,           // Lambda expects 'image'
                category: item.category || item.item_category,
                quantity: 1
            };

            const apiUrl = `${API_BASE_URL}/cart/${cartId}/user/${numericUserId}`;
            console.log('Corrected API URL:', apiUrl);
            console.log('Request payload:', itemData);
            console.log('Auth token available:', !!getAuthToken());

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify(itemData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Cart API Error Response:', errorText);
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Cart API response:', result);
            return result;

        } catch (error) {
            console.error('Cart API error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
            throw error;
        }
    }

    // Add hash function for user ID conversion
    function hashStringToNumber(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    function showMessage(message, type = 'info') {
        // Create message container if it doesn't exist
        let messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'messageContainer';
            messageContainer.style.cssText = `
                position: fixed;
                top: 1rem;
                right: 1rem;
                z-index: 1000;
            `;
            document.body.appendChild(messageContainer);
        }

        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 1rem 1.5rem;
            margin-bottom: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            animation: slideIn 0.3s ease;
        `;

        if (type === 'success') {
            messageEl.style.borderColor = '#10b981';
            messageEl.style.background = '#f0fdf4';
            messageEl.style.color = '#065f46';
        } else if (type === 'error') {
            messageEl.style.borderColor = '#dc2626';
            messageEl.style.background = '#fef2f2';
            messageEl.style.color = '#991b1b';
        }

        messageContainer.appendChild(messageEl);

        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }

    // Back to homepage function
    function goBack() {
        console.log('Back button clicked - returning to homepage');

        // Add loading state to back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.classList.add('loading');
            backBtn.innerHTML = `
                <div style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            `;
        }

        // Navigate back to homepage
        setTimeout(() => {
            window.location.href = 'homepage.html';
        }, 300);
    }

    // Cart navigation function for menu page  
    function goToCart() {
        console.log('Cart button clicked from menu page');

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
            cartBtn.innerHTML = `
                <div style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            `;
        }

        // Navigate to cart page
        setTimeout(() => {
            window.location.href = 'cart.html';
        }, 500);
    }

    // Make functions globally available for onclick handlers
    window.goBack = goBack;
    window.goToCart = goToCart;

    // Add this test function to verify the fix
    async function testFixedCartEndpoint() {
        const userId = getCurrentUserId();
        const numericUserId = hashStringToNumber(userId);
        const API_BASE_URL = 'https://rxi8ak16b7.execute-api.us-east-1.amazonaws.com';

        const testItem = {
            item_id: 999,
            name: 'Test Item',
            cost: '$1.00',
            description: 'Test Description',
            image: 'test.jpg',
            category: 'Entrees',
            quantity: 1
        };

        const correctUrl = `${API_BASE_URL}/cart/${numericUserId}/user/${numericUserId}`;
        console.log('Testing CORRECTED endpoint:', correctUrl);

        try {
            const response = await fetch(correctUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify(testItem)
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (response.ok) {
                const data = await response.json();
                console.log('SUCCESS! API Response:', data);
            } else {
                const errorText = await response.text();
                console.log('Error Response:', errorText);
            }

        } catch (error) {
            console.error('Test Error:', error);
        }
    }

    // Make it globally available
    window.testFixedCartEndpoint = testFixedCartEndpoint;

    // Initialize
    function init() {
        cart = JSON.parse(localStorage.getItem('cart')) || [];
        updateCartDisplay();
        setupSearch();
        loadMenuItems();
    }



    init();
});