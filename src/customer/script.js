// DOM elements cache
const elements = {
    cartList: document.getElementById('customer-cart-list'),
    totalDisplay: document.getElementById('customer-total'),
    emptyMessage: document.getElementById('empty-message')
};

/**
 * Receives synchronized data from the main process and renders the screen
 * @param {object} cartData - Object containing { items, total }
 */
function renderScreen(cartData) {
    const items = cartData.items || [];
    const total = cartData.total || 0;
    
    // Clear old list, keeping the header
    const list = elements.cartList;
    while (list.children.length > 1) {
        list.removeChild(list.lastChild);
    }
    
    if (items.length === 0) {
        // Logic for creating the empty message
        elements.emptyMessage = document.createElement('li');
        elements.emptyMessage.id = 'empty-message';
        elements.emptyMessage.textContent = 'Please start ordering';
        list.appendChild(elements.emptyMessage);
    } else {
        items.forEach(item => {
            const itemTotal = item.price * item.count;
            
            const li = document.createElement('li');
            li.className = 'customer-item';
            
            // --- Safe construction replacing li.innerHTML ---
            
            // 1. Product name and options container
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            // Insert product name
            nameSpan.textContent = item.name + ' '; 
            
            // 2. Options/Specifications
            if (item.options && item.options.length > 0) {
                const optionsSpan = document.createElement('span');
                optionsSpan.className = 'item-options';
                // Safe: using textContent to insert options text
                optionsSpan.textContent = `(${item.options.join(', ')})`;
                nameSpan.appendChild(optionsSpan);
            }
            li.appendChild(nameSpan);
            
            // 3. Quantity
            const countSpan = document.createElement('span');
            countSpan.className = 'center';
            countSpan.textContent = `x${item.count}`;
            li.appendChild(countSpan);
            
            // 4. Unit Price
            const priceSpan = document.createElement('span');
            priceSpan.className = 'center';
            priceSpan.textContent = (item.price / 100).toFixed(2);
            li.appendChild(priceSpan);
            
            // 5. Subtotal
            const totalSpan = document.createElement('span');
            totalSpan.className = 'center';
            totalSpan.textContent = (itemTotal / 100).toFixed(2);
            li.appendChild(totalSpan);

            // --- End of safe construction ---
            
            list.appendChild(li);
        });
    }

    // Update total amount display (Extra large font)
    elements.totalDisplay.textContent = `¥ ${(total / 100).toFixed(2)}`;
}

// --- Initialization ---
function init() {
    // Listen for synchronization messages from the main process
    window.api.onCartSync(renderScreen);
}

document.addEventListener('DOMContentLoaded', init);