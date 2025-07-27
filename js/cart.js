// Configuration
const API_BASE_URL = 'https://rxi8ak16b7.execute-api.us-east-1.amazonaws.com';

// Global variables
let cartItems = [];
let currentUser = null;
let currentCartId = null;

// DOM Elements
let loadingState, emptyCart, cartContent, cartItemsList, itemCount;
let subtotalEl, shippingEl, taxEl, totalEl;
let checkoutBtn, clearCartBtn;
let messageContainer, confirmModal;

// Initialize the cart page
document.addEventListener('DOMContentLoaded', () => {
    initializeCartPage();
});

async function initializeCartPage() {
    console.log('=== Initializing Cart Page ===');

    // Get DOM elements
    getDOMElements();

    // Setup event listeners
    setupEventListeners();

    // Load current user
    await loadCurrentUser();

    // Load cart items with fallback
    await loadCartItems();
}

function getDOMElements() {
    loadingState = document.getElementById('loadingState');
    emptyCart = document.getElementById('emptyCart');
    cartContent = document.getElementById('cartContent');
    cartItemsList = document.getElementById('cartItemsList');
    itemCount = document.querySelector('.item-count');

    subtotalEl = document.getElementById('subtotal');
    shippingEl = document.getElementById('shipping');
    taxEl = document.getElementById('tax');
    totalEl = document.getElementById('total');

    checkoutBtn = document.getElementById('checkoutBtn');
    clearCartBtn = document.getElementById('clearCart');

    messageContainer = document.getElementById('messageContainer');
    confirmModal = document.getElementById('confirmModal');
}

function setupEventListeners() {
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', handleClearCart);
    }

    // Modal event listeners
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    if (confirmYes) confirmYes.addEventListener('click', handleConfirmYes);
    if (confirmNo) confirmNo.addEventListener('click', hideConfirmModal);

    // Close modal when clicking outside
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                hideConfirmModal();
            }
        });
    }
}

async function loadCurrentUser() {
    try {
        const userId = getCurrentUserId();
        if (!userId) {
            showMessage('Please log in to view your cart', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        currentUser = { userId };

        // Convert UUID to numeric format for API compatibility
        const numericUserId = hashStringToNumber(userId);
        const numericCartId = numericUserId; // Use same number for cart_id

        currentCartId = numericCartId;

        console.log('âœ… Current user loaded:', currentUser);
        console.log('ðŸ”¢ Numeric User ID:', numericUserId);
        console.log('ðŸ›’ Cart ID:', currentCartId);

    } catch (error) {
        console.error('âŒ Error loading current user:', error);
        showMessage('Error loading user information', 'error');
    }
}

// Helper Functions
function hashStringToNumber(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
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

// Cart Loading Functions
async function loadCartItems() {
    try {
        showLoading(true);

        if (!currentCartId || !currentUser?.userId) {
            throw new Error('Cart ID or User ID not available');
        }

        const numericUserId = hashStringToNumber(currentUser.userId);
        console.log(`ðŸ”„ Loading cart items for cart: ${currentCartId}, user: ${numericUserId}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${API_BASE_URL}/cart/${currentCartId}/user/${numericUserId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('ðŸ“¡ Load cart response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('âœ… Cart data received:', data);

            if (Array.isArray(data)) {
                cartItems = data;
            } else if (data.items && Array.isArray(data.items)) {
                cartItems = data.items;
            } else if (data.cartItems && Array.isArray(data.cartItems)) {
                cartItems = data.cartItems;
            } else if (data.data && Array.isArray(data.data)) {
                cartItems = data.data;
            } else {
                cartItems = [];
            }

            console.log('Processed cart items:', cartItems);

        } else if (response.status === 404) {
            // Cart doesn't exist yet - this is normal for new users
            console.log('Cart not found (404) - showing empty cart');
            cartItems = [];
        } else {
            const errorText = await response.text();
            throw new Error(`Failed to load cart: ${response.status} - ${errorText}`);
        }

        displayCart();

    } catch (error) {
        console.error('Error loading cart items:', error);
        cartItems = [];
        displayCart();

        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            showMessage('Cannot connect to cart service. Using offline mode.', 'info');
        } else {
            showMessage(`Error: ${error.message}`, 'error');
        }
    } finally {
        showLoading(false);
    }
}

// API Functions
async function updateItemQuantity(itemId, newQuantity) {
    try {
        console.log(`Updating item ${itemId} quantity to ${newQuantity}`);

        if (!currentCartId || !currentUser?.userId) {
            throw new Error('Cart ID or User ID not available');
        }

        const numericUserId = hashStringToNumber(currentUser.userId);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_BASE_URL}/cart/${currentCartId}/user/${numericUserId}/item/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                quantity: newQuantity
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('Update quantity response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update quantity: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Update quantity result:', result);

        await loadCartItems();
        return result;

    } catch (error) {
        console.error('Error updating item quantity:', error);
        throw error;
    }
}

async function removeItemFromCart(itemId) {
    try {
        console.log(`Removing item ${itemId} from cart`);

        if (!currentCartId || !currentUser?.userId) {
            throw new Error('Cart ID or User ID not available');
        }

        const numericUserId = hashStringToNumber(currentUser.userId);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_BASE_URL}/cart/${currentCartId}/user/${numericUserId}/item/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('ðŸ“¡ Remove item response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to remove item: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Remove item result:', result);

        await loadCartItems();
        return result;

    } catch (error) {
        console.error('Error removing item from cart:', error);
        throw error;
    }
}

async function addItemToCart(itemData) {
    try {
        console.log('ðŸ›’ Adding item to cart:', itemData);

        if (!currentCartId || !currentUser?.userId) {
            // If user not loaded yet, try to load them
            await loadCurrentUser();
            if (!currentCartId || !currentUser?.userId) {
                throw new Error('Cart ID or User ID not available');
            }
        }

        const numericUserId = hashStringToNumber(currentUser.userId);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // POST /cart/{cart_id}/user/{user_id}/item
        const response = await fetch(`${API_BASE_URL}/cart/${currentCartId}/user/${numericUserId}/item`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                item_id: itemData.item_id || itemData.id,
                item_name: itemData.item_name || itemData.name,
                item_cost: itemData.item_cost || itemData.cost || itemData.price,
                item_description: itemData.item_description || itemData.description,
                item_image: itemData.item_image || itemData.image,
                quantity: itemData.quantity || 1,
                stall_id: itemData.stall_id,
                category: itemData.category
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('ðŸ“¡ Add to cart response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to add item to cart: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('âœ… Item added to cart successfully:', result);

        // Reload cart to show new item
        await loadCartItems();

        return result;

    } catch (error) {
        console.error('âŒ Error adding item to cart:', error);

        // Fallback: Add to local cart if API fails
        console.log('ðŸ”„ Adding item locally as fallback');

        const newItem = {
            item_id: itemData.item_id || itemData.id,
            item_name: itemData.item_name || itemData.name,
            item_cost: itemData.item_cost || itemData.cost || itemData.price,
            item_description: itemData.item_description || itemData.description,
            item_image: itemData.item_image || itemData.image,
            quantity: itemData.quantity || 1,
            stall_id: itemData.stall_id,
            category: itemData.category,
            user_id: hashStringToNumber(currentUser.userId),
            cart_id: currentCartId
        };

        // Check if item already exists in cart
        const existingItemIndex = cartItems.findIndex(item =>
            (item.item_id || item.id) == newItem.item_id
        );

        if (existingItemIndex !== -1) {
            // Update quantity if item exists
            cartItems[existingItemIndex].quantity =
                parseInt(cartItems[existingItemIndex].quantity || 0) + parseInt(newItem.quantity);
        } else {
            // Add new item to cart
            cartItems.push(newItem);
        }

        saveCartToCache();
        displayCart();

        throw error; // Re-throw so calling code knows it failed
    }
}

// User Action Functions
async function updateQuantity(itemId, newQuantity) {
    try {
        const quantity = parseInt(newQuantity);

        if (isNaN(quantity) || quantity < 0) {
            showMessage('Invalid quantity', 'error');
            return;
        }

        if (quantity === 0) {
            await removeItem(itemId);
            return;
        }

        console.log(`ðŸ”„ Updating quantity for item ${itemId} to ${quantity}`);

        try {
            await updateItemQuantity(itemId, quantity);
            showMessage('Quantity updated successfully', 'success');
        } catch (apiError) {
            console.log('API unavailable, updating locally:', apiError.message);

            const itemIndex = cartItems.findIndex(item =>
                (item.item_id || item.itemId || item.id) == itemId
            );

            if (itemIndex !== -1) {
                cartItems[itemIndex].quantity = quantity;
                saveCartToCache();
                renderCartItems();
                updateCartSummary();
                showMessage('Quantity updated (offline mode)', 'info');
            } else {
                throw new Error('Item not found in cart');
            }
        }

    } catch (error) {
        console.error('Error updating quantity:', error);
        showMessage('Failed to update quantity', 'error');
        await loadCartItems();
    }
}

async function removeItem(itemId) {
    try {
        console.log(`ðŸ—‘ï¸ Removing item ${itemId} from cart`);

        try {
            await removeItemFromCart(itemId);
            showMessage('Item removed from cart', 'success');
        } catch (apiError) {
            console.log('API unavailable, removing locally:', apiError.message);

            const itemIndex = cartItems.findIndex(item =>
                (item.item_id || item.itemId || item.id) == itemId
            );

            if (itemIndex !== -1) {
                cartItems.splice(itemIndex, 1);
                saveCartToCache();
                displayCart();
                showMessage('Item removed (offline mode)', 'info');
            } else {
                throw new Error('Item not found in cart');
            }
        }

    } catch (error) {
        console.error('Error removing item:', error);
        showMessage('Failed to remove item', 'error');
        await loadCartItems();
    }
}

// Display Functions
function displayCart() {
    saveCartToCache();

    if (cartItems.length === 0) {
        showEmptyCart();
        return;
    }

    showCartContent();
    renderCartItems();
    updateCartSummary();
}

function renderCartItems() {
    if (!cartItemsList) {
        console.error('âŒ cartItemsList element not found!');
        return;
    }

    console.log('ðŸŽ¨ Rendering cart items:', cartItems.length, 'items');
    cartItemsList.innerHTML = '';

    if (cartItems.length === 0) {
        console.log('ðŸ“­ No items to render');
        return;
    }

    cartItems.forEach((item, index) => {
        console.log(`ðŸ—ï¸ Creating element for item ${index}:`, item);
        try {
            const cartItemEl = createCartItemElement(item, index);
            cartItemsList.appendChild(cartItemEl);
            console.log(`âœ… Successfully added item ${index} to DOM`);
        } catch (error) {
            console.error(`âŒ Error creating element for item ${index}:`, error);
        }
    });

    console.log('ðŸŽ¨ Finished rendering, DOM children count:', cartItemsList.children.length);
}

function createCartItemElement(item, index) {
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';

    const itemId = item.item_id || item.itemId || item.id;
    const itemName = item.item_name || item.name || item.title || 'Unknown Item';

    // Fix cost parsing - handle string prices with $ symbol
    let itemCost = 0;
    const costFields = ['item_cost', 'cost', 'price', 'item_price'];

    for (const field of costFields) {
        if (item[field] !== undefined && item[field] !== null && item[field] !== '') {
            let costValue = item[field];

            if (typeof costValue === 'string') {
                costValue = costValue.replace(/[$,\s]/g, '');
            }

            const parsedCost = parseFloat(costValue);
            if (!isNaN(parsedCost)) {
                itemCost = parsedCost;
                console.log(`ðŸ’° Parsed ${field}: "${item[field]}" â†’ ${itemCost}`);
                break;
            }
        }
    }

    let itemPicture = item.item_image || item.picture || item.image || item.imageUrl;
    if (!itemPicture || itemPicture === 'null' || itemPicture === '') {
        itemPicture = 'data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%23666" text-anchor="middle" dy="4"%3ENo Image%3C/text%3E%3C/svg%3E';
    }

    const itemQuantity = parseInt(item.quantity || 1);
    const description = item.item_description || item.description || '';

    itemEl.innerHTML = `
        <img src="${itemPicture}" alt="${itemName}" class="item-image" onerror="this.style.display='none';">
        
        <div class="item-details">
            <div class="item-name">${itemName}</div>
            <div class="item-id">ID: ${itemId}</div>
            <div class="item-description">${description}</div>
        </div>
        
        <div class="item-quantity">
            <button class="quantity-btn" onclick="updateQuantity('${itemId}', ${itemQuantity - 1})" ${itemQuantity <= 1 ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            <input type="number" class="quantity-input" value="${itemQuantity}" min="1" max="99" onchange="updateQuantity('${itemId}', this.value)">
            <button class="quantity-btn" onclick="updateQuantity('${itemId}', ${itemQuantity + 1})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
        
        <div class="item-price">
            <div class="price-current">$${(itemCost * itemQuantity).toFixed(2)}</div>
            ${item.original_price && parseFloat(item.original_price) > itemCost ? `<div class="price-original">$${(parseFloat(item.original_price) * itemQuantity).toFixed(2)}</div>` : ''}
        </div>
        
        <div class="item-actions">
            <button class="remove-item" onclick="removeItem('${itemId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Remove
            </button>
        </div>
    `;

    return itemEl;
}

function showLoading(show) {
    if (loadingState) loadingState.style.display = show ? 'block' : 'none';
    if (emptyCart) emptyCart.style.display = 'none';
    if (cartContent) cartContent.style.display = 'none';
}

function showEmptyCart() {
    if (loadingState) loadingState.style.display = 'none';
    if (emptyCart) emptyCart.style.display = 'block';
    if (cartContent) cartContent.style.display = 'none';
    if (itemCount) itemCount.textContent = 'No items in cart';
}

function showCartContent() {
    console.log('ðŸŽ¯ Showing cart content...');

    if (loadingState) {
        loadingState.style.display = 'none';
        console.log('Hidden loading state');
    }
    if (emptyCart) {
        emptyCart.style.display = 'none';
        console.log('Hidden empty cart');
    }
    if (cartContent) {
        cartContent.style.display = 'block';
        cartContent.style.visibility = 'visible';
        cartContent.style.opacity = '1';
        console.log('Shown cart content');
    }
    if (cartItemsList) {
        cartItemsList.style.display = 'block';
        cartItemsList.style.visibility = 'visible';
        cartItemsList.style.opacity = '1';
        console.log('Shown cart items list');
    }

    const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    if (itemCount) {
        itemCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''} in cart`;
        console.log('Updated item count:', totalItems);
    }
}

function updateCartSummary() {
    const subtotal = cartItems.reduce((sum, item) => {
        let cost = 0;
        const costFields = ['item_cost', 'cost', 'price', 'item_price'];

        for (const field of costFields) {
            if (item[field] !== undefined && item[field] !== null && item[field] !== '') {
                let costValue = item[field];

                if (typeof costValue === 'string') {
                    costValue = costValue.replace(/[$,\s]/g, '');
                }

                const parsedCost = parseFloat(costValue);
                if (!isNaN(parsedCost)) {
                    cost = parsedCost;
                    break;
                }
            }
        }

        const quantity = parseInt(item.quantity || 1);
        return sum + (cost * quantity);
    }, 0);

    const shipping = subtotal > 50 ? 0 : 5.00;
    const taxRate = 0.08;
    const tax = subtotal * taxRate;
    const total = subtotal + shipping + tax;

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (shippingEl) {
        shippingEl.textContent = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
    }
    if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    console.log('ðŸ’° Cart summary updated:', {
        subtotal: subtotal.toFixed(2),
        shipping: shipping.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2)
    });
}

// Utility Functions
function saveCartToCache() {
    try {
        if (currentUser?.userId) {
            localStorage.setItem(`cart_${currentUser.userId}`, JSON.stringify(cartItems));
            console.log('Cart saved to cache');
        }
    } catch (error) {
        console.error('Error saving cart to cache:', error);
    }
}

function showMessage(message, type = 'info') {
    if (!messageContainer) return;

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
    } else if (type === 'info') {
        messageEl.style.borderColor = '#3b82f6';
        messageEl.style.background = '#eff6ff';
        messageEl.style.color = '#1e40af';
    }

    messageContainer.appendChild(messageEl);

    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 3000);
}

// Event Handlers
function handleCheckout() {
    if (cartItems.length === 0) {
        showMessage('Your cart is empty', 'error');
        return;
    }

    showConfirmModal(
        'Proceed to checkout? This will redirect you to the payment page.',
        () => {
            showMessage('Redirecting to checkout...', 'success');
            setTimeout(() => {
                alert('Checkout functionality would be implemented here');
            }, 1500);
        }
    );
}

async function handleClearCart() {
    if (cartItems.length === 0) {
        showMessage('Your cart is already empty', 'error');
        return;
    }

    showConfirmModal(
        'Clear all items from your cart? This action cannot be undone.',
        async () => {
            try {
                cartItems = [];
                saveCartToCache();
                displayCart();
                showMessage('Cart cleared', 'success');
            } catch (error) {
                console.error('Error clearing cart:', error);
                showMessage('Failed to clear cart', 'error');
            }
        }
    );
}

// Modal Functions
function showConfirmModal(message, onConfirm) {
    if (!confirmModal) return;

    const messageEl = document.getElementById('confirmMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }

    window.pendingConfirmCallback = onConfirm;
    confirmModal.style.display = 'flex';
}

function hideConfirmModal() {
    if (confirmModal) {
        confirmModal.style.display = 'none';
    }
    window.pendingConfirmCallback = null;
}

function handleConfirmYes() {
    if (window.pendingConfirmCallback) {
        window.pendingConfirmCallback();
    }
    hideConfirmModal();
}

// Make functions globally available for onclick handlers
window.updateQuantity = updateQuantity;
window.removeItem = removeItem;
window.updateItemQuantity = updateItemQuantity;
window.removeItemFromCart = removeItemFromCart;
window.hashStringToNumber = hashStringToNumber;
window.getCurrentUserId = getCurrentUserId;

console.log('Cart page initialized with CORS fallback support');

// Update your increaseQuantity function with cart.js compatible format
async function increaseQuantity(item, quantitySpan, minusBtn) {
    const itemId = item.item_id || item.id;
    console.log('ðŸ›’ Adding item to cart:', item);

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

        const numericUserId = hashStringToNumber(userId);

        // First update local cart for immediate UI feedback
        const existingItem = cart.find(cartItem => (cartItem.item_id || cartItem.id) === itemId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            // Format item for cart.js compatibility
            const cartItem = {
                item_id: itemId,
                item_name: item.item_name || item.name,
                item_cost: item.item_cost || item.price || item.item_price,
                item_description: item.item_description || item.description,
                item_image: item.item_image || item.image,
                quantity: 1,
                stall_id: stallData?.stall_id || stallData?.id,
                stall_name: stallData?.stall_name || stallData?.name,
                category: item.category || item.item_category,
                user_id: numericUserId,
                cart_id: numericUserId
            };
            cart.push(cartItem);
        }

        // Update UI immediately
        const newQuantity = getItemQuantityInCart(itemId);
        quantitySpan.textContent = newQuantity;
        minusBtn.disabled = false;
        updateCartDisplay();

        // Save to both general cart and user-specific cart
        localStorage.setItem('cart', JSON.stringify(cart));
        localStorage.setItem(`cart_${userId}`, JSON.stringify(cart));

        showAddToCartSuccess(item.item_name || item.name);
        showMessage('Item added to cart', 'success');

    } catch (error) {
        console.error('âŒ Error adding item to cart:', error);
        showMessage('Failed to add item to cart', 'error');
    }
}
