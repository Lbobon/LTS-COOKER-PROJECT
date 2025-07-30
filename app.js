document.addEventListener("DOMContentLoaded", async () => {
    const arrowBtn = document.querySelector('.arrow-btn');
    const input = document.querySelector('.input-area input');
    const chatHistory = document.getElementById('chat-history');
    const scanBtn = document.getElementById('scanBtn');
    const body = document.body;
    const container = document.querySelector('.container');
    
    // Barcode scanner elements
    const scannerOverlay = document.getElementById('barcode-scanner-overlay');
    const closeScanner = document.getElementById('closeScanner');
    const scanIngredientBtn = document.getElementById('scanIngredientBtn');
    const testBarcodeBtn = document.getElementById('testBarcodeBtn');
    const stopScanBtn = document.getElementById('stopScan');
    const cameraContainer = document.getElementById('cameraContainer');
    const scannerControls = document.getElementById('scannerControls');
    const scanStatus = document.getElementById('scanStatus');
    const scanResult = document.getElementById('scanResult');
    const productName = document.getElementById('productName');
    const barcodeNumber = document.getElementById('barcodeNumber');
    const scannedIngredientsList = document.getElementById('scannedIngredientsList');
    const clearIngredientsBtn = document.getElementById('clearIngredients');
    const video = document.getElementById('scanner');
    const canvas = document.getElementById('scannerCanvas');
    
    // Dark mode toggle functionality
    let isDarkMode = false;
    let isScanning = false;
    let scannedIngredients = [];
    let barcodeWorker = null;
    let scanningInterval = null;
    let stream = null;

    scanBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        
        if (isDarkMode) {
            body.classList.add('dark-mode');
            container.classList.add('dark-mode');
            scanBtn.textContent = 'Exit Scan';
            // Show barcode scanner overlay
            scannerOverlay.classList.add('active');
            updateIngredientsDisplay();
        } else {
            body.classList.remove('dark-mode');
            container.classList.remove('dark-mode');
            scanBtn.textContent = 'Scan';
            // Hide barcode scanner overlay
            scannerOverlay.classList.remove('active');
            stopBarcodeScanning();
        }
    });

    // Close scanner overlay
    closeScanner.addEventListener('click', () => {
        scannerOverlay.classList.remove('active');
        stopBarcodeScanning();
    });

    // Barcode scanning functionality
    scanIngredientBtn.addEventListener('click', startBarcodeScanning);
    testBarcodeBtn.addEventListener('click', testBarcodeMode);
    stopScanBtn.addEventListener('click', stopBarcodeScanning);
    clearIngredientsBtn.addEventListener('click', clearAllIngredients);

    async function startBarcodeScanning() {
        try {
            updateScanStatus('Starting camera...');
            scanIngredientBtn.disabled = true;
            cameraContainer.style.display = 'block';
            scannerControls.style.display = 'block';
            
            // Initialize the barcode scanner worker
            if (!barcodeWorker) {
                barcodeWorker = new Worker('barcode-worker.js');
                
                barcodeWorker.onmessage = (event) => {
                    if (event.data.type === 'workerReady') {
                        // The worker is ready, we can now start the camera and scanning process.
                        console.log('Barcode worker is ready.');
                    } else if (event.data.type === 'scanResult' && event.data.result.length > 0) {
                        console.log('Barcode detected by worker:', event.data.result[0]);
                        onBarcodeDetected(event.data.result[0]);
                    } else if (event.data.type === 'scanError' || event.data.type === 'workerError') {
                        console.error('Error from Worker:', event.data.message);
                    }
                };

                barcodeWorker.onerror = (error) => {
                    console.error('Unhandled worker error:', error);
                };
            }
            
            // Get video stream
            stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            video.srcObject = stream;
            await video.play();
            
            isScanning = true;
            updateScanStatus('Scanning... Position barcode in the viewfinder.');
            stopScanBtn.disabled = false;
            
            // Start continuous scanning
            startContinuousScanning();
            
        } catch (error) {
            console.error('Error starting barcode scanner:', error);
            updateScanStatus('Failed to start camera. Please check permissions.');
            resetScannerUI();
        }
    }

    function startContinuousScanning() {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        scanningInterval = setInterval(() => {
            if (!isScanning || !video.videoWidth || !video.videoHeight) return;

            // Adjust canvas size to match video dimensions
            if (canvas.width !== video.videoWidth) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
            
            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Get image data for scanning
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Send the image data to the worker to be scanned
            if (barcodeWorker) {
                barcodeWorker.postMessage({ type: 'scanImage', imageData });
            }

        }, 200); // Scan every 200ms
    }

    function stopBarcodeScanning() {
        isScanning = false;
        
        // Clear scanning interval
        if (scanningInterval) {
            clearInterval(scanningInterval);
            scanningInterval = null;
        }
        
        // Stop video stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        
        // Terminate the worker to save resources
        if (barcodeWorker) {
            barcodeWorker.terminate();
            barcodeWorker = null;
        }
        
        resetScannerUI();
    }

    function resetScannerUI() {
        updateScanStatus('Ready to scan ingredients. Click "Scan Ingredient" to start.');
        scanIngredientBtn.disabled = false;
        stopScanBtn.disabled = true;
        cameraContainer.style.display = 'none';
        scannerControls.style.display = 'none';
        scanResult.style.display = 'none';
    }

    async function onBarcodeDetected(code) {
        console.log('Barcode detected:', code);
        
        // Stop scanning to prevent multiple detections
        stopBarcodeScanning();
        
        updateScanStatus('Barcode detected! Looking up product...');
        
        try {
            console.log('Sending UPC lookup request for:', code);
            
            const response = await fetch('http://localhost:5001/api/barcode-lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ upc: code })
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Lookup response:', data);
            
            let ingredientName;
            if (data.success && data.product_name && data.product_name !== 'N/A') {
                ingredientName = data.product_name;
                console.log('Product found:', ingredientName);
            } else {
                ingredientName = data.fallback_name || `Unknown Product (${code})`;
                console.log('Using fallback name:', ingredientName);
            }
            
            // Automatically add to ingredients list
            addToScannedIngredients(ingredientName, code);
            showScanSuccess(ingredientName, code);
            
        } catch (error) {
            console.error('Product lookup error:', error);
            const fallbackName = `Product ${code}`;
            addToScannedIngredients(fallbackName, code);
            showScanSuccess(fallbackName, code);
        }
    }

    function testBarcodeMode() {
        // Use a test barcode for demo purposes - Coca Cola barcode
        const testUPC = '049000028911'; // Coca Cola 12oz can
        console.log('Test mode: Simulating barcode detection with:', testUPC);
        updateScanStatus('Test mode: Looking up sample product...');
        
        onBarcodeDetected(testUPC);
    }

    function addToScannedIngredients(name, barcode) {
        // Check if ingredient already exists
        const exists = scannedIngredients.some(item => item.barcode === barcode);
        if (exists) {
            updateScanStatus('Ingredient already scanned!');
            return;
        }
        
        scannedIngredients.push({
            name: name,
            barcode: barcode,
            timestamp: new Date().toISOString()
        });
        
        updateIngredientsDisplay();
    }

    function removeScannedIngredient(barcode) {
        scannedIngredients = scannedIngredients.filter(item => item.barcode !== barcode);
        updateIngredientsDisplay();
    }

    function clearAllIngredients() {
        scannedIngredients = [];
        updateIngredientsDisplay();
        updateScanStatus('All ingredients cleared. Ready to scan new ones.');
    }

    function updateIngredientsDisplay() {
        if (scannedIngredients.length === 0) {
            scannedIngredientsList.innerHTML = '<p class="empty-list">No ingredients scanned yet</p>';
            clearIngredientsBtn.disabled = true;
        } else {
            const ingredientsHTML = scannedIngredients.map(ingredient => `
                <div class="ingredient-item">
                    <div class="ingredient-name">${ingredient.name}</div>
                    <div class="ingredient-barcode">${ingredient.barcode}</div>
                    <button class="remove-ingredient" onclick="removeScannedIngredient('${ingredient.barcode}')">×</button>
                </div>
            `).join('');
            
            scannedIngredientsList.innerHTML = ingredientsHTML;
            clearIngredientsBtn.disabled = false;
        }
    }

    function showScanSuccess(name, barcode) {
        productName.textContent = name;
        barcodeNumber.textContent = `Barcode: ${barcode}`;
        scanResult.style.display = 'block';
        updateScanStatus('✅ Ingredient added to your list!');
        
        // Hide success message after 3 seconds
        setTimeout(() => {
            scanResult.style.display = 'none';
            updateScanStatus('Ready to scan ingredients. Click "Scan Ingredient" to start.');
        }, 3000);
    }

    function updateScanStatus(message) {
        scanStatus.textContent = message;
    }

    // Make removeScannedIngredient globally accessible
    window.removeScannedIngredient = removeScannedIngredient;
    
    input.placeholder = "Ask me anything...";
    input.disabled = false;
    
    // Initialize general shopping list UI
    initializeGeneralShoppingList();
    
    function appendMessage(sender, message, dishName = null) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        
        // Use innerHTML to correctly render newlines from the AI
        messageElement.innerHTML = message.replace(/\n/g, '<br>');

        if (sender === 'ai' && message === 'Thinking...') {
            messageElement.classList.add('thinking');
        }
        
        chatHistory.appendChild(messageElement);
        
        if (sender === 'ai' && message !== 'Thinking...' && dishName && !message.includes('?')) {
            addShoppingListButton(messageElement, message, dishName);
        }
        
        setTimeout(() => {
            chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
        }, 50);
        
        return messageElement;
    }
    
    function addShoppingListButton(messageElement, ingredients, dishName) {
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('shopping-list-container');
        
        const button = document.createElement('button');
        button.classList.add('shopping-list-btn');
        button.innerHTML = `🛒 Generate Shopping List for "${dishName}"`;
        button.onclick = () => generateShoppingList(ingredients, dishName, buttonContainer);
        
        buttonContainer.appendChild(button);
        messageElement.appendChild(buttonContainer);
    }
    
    // Global variables
    let currentShoppingListData = null;
    let generalShoppingList = [];
    let generalShoppingListTotal = 0;

    async function generateShoppingList(ingredients, dishName, buttonContainer) {
        const button = buttonContainer.querySelector('.shopping-list-btn');
        const originalText = button.innerHTML;
        button.innerHTML = '🔄 Generating...';
        button.disabled = true;
        
        try {
            const response = await fetch('http://localhost:5001/api/shopping-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredients, dish_name: dishName }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            
            // Store the shopping list data globally
            currentShoppingListData = data;
            
            // Replace the generate button with a "View My Cart" button
            showViewCartButton(buttonContainer, data);

        } catch (error) {
            console.error("Error generating shopping list:", error);
            button.innerHTML = '❌ Error';
            button.style.backgroundColor = '#d32f2f';
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
                button.style.backgroundColor = '';
            }, 3000);
        }
    }

    function showViewCartButton(buttonContainer, data) {
        buttonContainer.innerHTML = `
            <div class="cart-summary">
                <div class="cart-info">
                    🛒 Cart ready: ${data.matched_ingredients} items found for "${data.dish_name}"
                </div>
                <button class="view-cart-btn" onclick="openFullScreenCart()">
                    📋 View My Cart
                </button>
            </div>
        `;
    }

    window.openFullScreenCart = function() {
        if (currentShoppingListData) {
            displayFullScreenShoppingList(currentShoppingListData);
        }
    }

    function initializeGeneralShoppingList() {
        const inputArea = document.querySelector('.input-area');
        const shoppingCartCircle = document.createElement('div');
        shoppingCartCircle.id = 'shopping-cart-circle';
        shoppingCartCircle.innerHTML = `
            <div class="cart-icon" onclick="toggleCartDropdown()">
                🛒
                <span class="cart-count" id="cart-count">0</span>
            </div>
            <div class="cart-dropdown" id="cart-dropdown">
                <div class="cart-header">
                    <span>Shopping Cart</span>
                    <span class="cart-total" id="cart-total">$0.00</span>
                </div>
                <div class="cart-items" id="cart-items">
                    <div class="empty-cart">Add items to start shopping!</div>
                </div>
                <button class="clear-cart-btn" onclick="clearGeneralShoppingList()" style="display: none;">
                    Clear All
                </button>
            </div>
        `;
        inputArea.appendChild(shoppingCartCircle);
    }

    function addToGeneralShoppingList(product) {
        // Check if item already exists
        const existingIndex = generalShoppingList.findIndex(item => item.id === product.id);
        
        if (existingIndex > -1) {
            // Increase quantity
            generalShoppingList[existingIndex].quantity += 1;
        } else {
            // Add new item
            generalShoppingList.push({
                ...product,
                quantity: 1,
                addedAt: Date.now()
            });
        }
        
        updateGeneralShoppingListUI();
        showAddedAnimation();
    }

    function removeFromGeneralShoppingList(productId) {
        generalShoppingList = generalShoppingList.filter(item => item.id !== productId);
        updateGeneralShoppingListUI();
    }

    function updateQuantity(productId, change) {
        const itemIndex = generalShoppingList.findIndex(item => item.id === productId);
        if (itemIndex > -1) {
            generalShoppingList[itemIndex].quantity += change;
            if (generalShoppingList[itemIndex].quantity <= 0) {
                removeFromGeneralShoppingList(productId);
            } else {
                updateGeneralShoppingListUI();
            }
        }
    }

    function updateGeneralShoppingListUI() {
        const itemsContainer = document.getElementById('cart-items');
        const totalElement = document.getElementById('cart-total');
        const countElement = document.getElementById('cart-count');
        const clearBtn = document.querySelector('.clear-cart-btn');
        
        const totalItems = generalShoppingList.reduce((sum, item) => sum + item.quantity, 0);
        countElement.textContent = totalItems;
        countElement.style.display = totalItems > 0 ? 'flex' : 'none';
        
        if (generalShoppingList.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-cart">Add items to start shopping!</div>';
            totalElement.textContent = '$0.00';
            clearBtn.style.display = 'none';
            generalShoppingListTotal = 0;
            return;
        }

        let total = 0;
        let html = '';
        
        generalShoppingList.forEach(item => {
            const price = parseFloat(item.price.replace('$', '').replace(',', ''));
            const itemTotal = price * item.quantity;
            total += itemTotal;
            
            html += `
                <div class="cart-item" data-id="${item.id}">
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-price">$${price.toFixed(2)} × ${item.quantity}</div>
                    </div>
                    <div class="item-controls">
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                        <button class="remove-btn" onclick="removeFromGeneralShoppingList('${item.id}')">×</button>
                    </div>
                </div>
            `;
        });

        itemsContainer.innerHTML = html;
        totalElement.textContent = `$${total.toFixed(2)}`;
        clearBtn.style.display = 'block';
        generalShoppingListTotal = total;
    }

    function showAddedAnimation() {
        const cartIcon = document.querySelector('.cart-icon');
        cartIcon.classList.add('item-added');
        setTimeout(() => cartIcon.classList.remove('item-added'), 600);
    }

    window.toggleCartDropdown = function() {
        const dropdown = document.getElementById('cart-dropdown');
        dropdown.classList.toggle('show');
        
        // Close dropdown when clicking outside
        if (dropdown.classList.contains('show')) {
            setTimeout(() => {
                document.addEventListener('click', closeDropdownOnClickOutside);
            }, 100);
        } else {
            document.removeEventListener('click', closeDropdownOnClickOutside);
        }
    }

    function closeDropdownOnClickOutside(event) {
        const cartCircle = document.getElementById('shopping-cart-circle');
        const dropdown = document.getElementById('cart-dropdown');
        
        if (!cartCircle.contains(event.target)) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeDropdownOnClickOutside);
        }
    }

    window.clearGeneralShoppingList = function() {
        if (confirm('Are you sure you want to clear your shopping list?')) {
            generalShoppingList = [];
            updateGeneralShoppingListUI();
        }
    }

    window.addToGeneralShoppingList = addToGeneralShoppingList;
    window.updateQuantity = updateQuantity;
    window.removeFromGeneralShoppingList = removeFromGeneralShoppingList;
    
    function displayFullScreenShoppingList(data) {
        // Create full-screen overlay
        const overlay = document.createElement('div');
        overlay.classList.add('shopping-list-display');
        
        let html = `
            <button class="close-shopping-list" onclick="this.parentElement.remove()">×</button>
            <div class="shopping-list-header">
                <h3>🛒 Shopping List for "${data.dish_name}"</h3>
                <p>Found matches for ${data.matched_ingredients} of ${data.total_ingredients} ingredients.</p>
            </div>`;
        
        if (data.question) {
            html += `<p class="ai-question">${data.question}</p>`;
        } else {
            if (data.shopping_list && data.shopping_list.length > 0) {
                html += '<div class="ingredients-grid">';
                data.shopping_list.forEach(item => {
                    html += `<div class="ingredient-box">
                                 <h4 class="ingredient-name">${item.ingredient}</h4>`;
                    item.products.forEach((p, i) => {
                        const availabilityClass = p.availability.toLowerCase().includes('sale') ? 'limited-stock' : 
                            (p.availability.toLowerCase().includes('stock') ? 'in-stock' : 'out-of-stock');
                        
                        html += `<div class="product-item ${i === 0 ? 'best-match' : ''}">
                                     <div class="product-info">
                                         <div class="product-header">
                                             <div class="product-name">${p.name}</div>
                                             <button class="add-to-cart-btn" onclick="addToGeneralShoppingList(${JSON.stringify(p).replace(/"/g, '&quot;')})">
                                                 <span class="plus-icon">+</span>
                                             </button>
                                         </div>
                                         ${p.brand ? `<div class="product-brand">${p.brand}</div>` : ''}
                                         <div class="product-details">
                                             <span class="product-price">${p.price}</span>
                                             <span class="product-availability ${availabilityClass}">${p.availability}</span>
                                             ${p.promotion ? `<span class="product-promotion">${p.promotion}</span>` : ''}
                                         </div>
                                         ${p.product_url ? `<a href="${p.product_url}" target="_blank" class="product-link">View on Walmart</a>` : ''}
                                     </div>
                                 </div>`;
                    });
                    html += `</div>`;
                });
                html += '</div>';
            }
            if (data.unmatched_ingredients && data.unmatched_ingredients.length > 0) {
                html += `<div class="unmatched-ingredients">
                             <h4>⚠️ Items to find manually:</h4>
                             <ul>${data.unmatched_ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
                         </div>`;
            }
        }
        
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
    }

    async function getAIResponse() {
        const prompt = input.value.trim();
        if (!prompt) return;

        arrowBtn.disabled = true;
        input.disabled = true;
        appendMessage('user', prompt);
        
            input.value = '';
        
        const thinkingMessageElement = appendMessage('ai', 'Thinking...');

        try {
            // Prepare request body based on mode
            const requestBody = {
                prompt,
                model: "gemma:2b"
            };
            
            // In dark mode, include scanned ingredients and use recipe mode
            if (isDarkMode) {
                requestBody.mode = 'recipe';
                requestBody.scanned_ingredients = scannedIngredients.map(item => item.name);
            } else {
                requestBody.mode = 'normal';
            }
            
            const response = await fetch('http://localhost:5001/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const aiResponse = data.response;
            const dishName = data.dish_name;
            
            thinkingMessageElement.style.opacity = '0';
            setTimeout(() => {
                thinkingMessageElement.innerHTML = aiResponse.replace(/\n/g, '<br>');
                thinkingMessageElement.style.opacity = '1';
                
                // Only show shopping list button in normal mode
                if (!isDarkMode && !aiResponse.includes('?')) {
                    addShoppingListButton(thinkingMessageElement, aiResponse, dishName);
                }
                
                // In dark mode, if a recipe was generated, show scanned ingredients used
                if (isDarkMode && scannedIngredients.length > 0) {
                    showUsedIngredientsInfo(thinkingMessageElement);
                }
            }, 300);

        } catch (error) {
            console.error("Error fetching AI response:", error);
            thinkingMessageElement.innerHTML = "Error: Could not connect to the backend. Is it running?";
            thinkingMessageElement.style.color = '#d32f2f';
        } finally {
            input.disabled = false;
            arrowBtn.disabled = false;
            input.focus();
        }
    }

    function showUsedIngredientsInfo(messageElement) {
        const ingredientsInfo = document.createElement('div');
        ingredientsInfo.classList.add('used-ingredients-info');
        ingredientsInfo.innerHTML = `
            <div class="ingredients-used">
                <h4>🥘 Recipe created using your scanned ingredients:</h4>
                <div class="ingredients-list">
                    ${scannedIngredients.map(item => `<span class="ingredient-tag">${item.name}</span>`).join('')}
                </div>
            </div>
        `;
        messageElement.appendChild(ingredientsInfo);
    }

    arrowBtn.addEventListener('click', getAIResponse);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !input.disabled) {
            getAIResponse();
        }
    });

    // Remove complex animations and styles not directly related to core functionality
    const style = document.createElement('style');
    style.textContent = `
        .shopping-list-container { margin-top: 15px; padding-top: 10px; border-top: 1px solid #e0e0e0; }
        .shopping-list-btn { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3); }
        .shopping-list-btn:hover:not(:disabled) { background: linear-gradient(135deg, #45a049, #3d8b40); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4); }
        .shopping-list-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .cart-summary { background: #f0f4c3; border: 1px solid #d4b106; border-radius: 12px; padding: 15px; margin-top: 10px; }
        .cart-info { color: #5d4037; font-size: 14px; margin-bottom: 10px; font-weight: 500; }
        .view-cart-btn { background: linear-gradient(135deg, #8d6e63, #6d4c41); color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(141, 110, 99, 0.3); width: 100%; }
        .view-cart-btn:hover { background: linear-gradient(135deg, #6d4c41, #5d4037); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(141, 110, 99, 0.4); }
        .shopping-list-display { 
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
            background: linear-gradient(135deg, #8b6f47, #a0835c); 
            padding: 20px; box-sizing: border-box; z-index: 1000; 
            overflow-y: auto; 
        }
        .shopping-list-header { 
            background: rgba(255,255,255,0.95); 
            border-radius: 12px; padding: 20px; margin-bottom: 20px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        }
        .shopping-list-header h3 { margin: 0 0 8px 0; color: #5d4037; font-size: 24px; font-weight: 700; }
        .shopping-list-header p { margin: 0 0 10px 0; color: #8d6e63; font-size: 16px; }
        .close-shopping-list { 
            position: absolute; top: 20px; right: 30px; 
            background: #d32f2f; color: white; border: none; 
            width: 40px; height: 40px; border-radius: 50%; 
            font-size: 24px; cursor: pointer; font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .close-shopping-list:hover { background: #b71c1c; }
        .ingredients-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
            margin-top: 20px; 
        }
        .ingredient-box { 
            background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,245,240,0.95)); 
            border-radius: 16px; border: 1px solid rgba(215, 204, 200, 0.3);
            padding: 24px; margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1); 
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
        }
        .ingredient-box:hover { 
            transform: translateY(-6px) scale(1.02); 
            box-shadow: 0 16px 48px rgba(0,0,0,0.15); 
            border-color: rgba(161, 136, 127, 0.5);
        }
        .ingredient-name { 
            margin: 0 0 20px 0; color: #5d4037; 
            font-size: 20px; font-weight: 800; 
            border-bottom: 3px solid #d7ccc8; 
            padding-bottom: 12px; 
            text-transform: capitalize;
            letter-spacing: 0.5px;
        }
        .product-item { 
            padding: 18px; margin-bottom: 14px; 
            border: 1px solid #e8e8e8; border-radius: 12px; 
            background: linear-gradient(135deg, #ffffff, #fafafa); 
            transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative; overflow: hidden;
        }
        .product-item::before {
            content: ''; position: absolute; top: 0; left: -100%; 
            width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(141, 110, 99, 0.1), transparent);
            transition: left 0.6s ease;
        }
        .product-item:hover::before { left: 100%; }
        .product-item:hover { 
            background: linear-gradient(135deg, #fafafa, #f5f5f5); 
            border-color: #8d6e63; 
            transform: translateY(-3px) translateX(2px); 
            box-shadow: 0 12px 30px rgba(141, 110, 99, 0.15);
        }
        .product-item.best-match { 
            background: linear-gradient(135deg, #e8f5e8, #f1f8e9); 
            border: 2px solid #4CAF50; 
            box-shadow: 0 6px 20px rgba(76, 175, 80, 0.2);
        }
        .product-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 10px;
        }
        .product-info { width: 100%; }
        .product-name { 
            font-weight: 700; color: #2c2c2c; font-size: 16px; 
            line-height: 1.4; margin: 0; flex: 1; 
            padding-right: 12px;
        }
        .product-brand { 
            font-size: 13px; color: #6d4c41; font-weight: 600; 
            margin-bottom: 8px; opacity: 0.85;
        }
        .product-details { 
            display: flex; flex-wrap: wrap; gap: 10px; 
            align-items: center; margin-bottom: 12px; 
        }
        .product-price { 
            font-size: 16px; font-weight: 800; color: #2e7d32; 
            background: linear-gradient(135deg, #e8f5e8, #c8e6c8);
            padding: 6px 12px; border-radius: 20px;
            box-shadow: 0 2px 8px rgba(46, 125, 50, 0.2);
        }
        .product-availability { 
            font-size: 11px; padding: 4px 10px; border-radius: 16px; 
            font-weight: 600; transition: all 0.2s ease;
        }
        .product-availability.in-stock { 
            background: linear-gradient(135deg, #c8e6c9, #a5d6a7); 
            color: #1b5e20; 
        }
        .product-availability.sale { 
            background: linear-gradient(135deg, #fff3e0, #ffe0b2); 
            color: #e65100; 
            animation: pulseGlow 2s infinite;
        }
        @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 2px 8px rgba(230, 81, 0, 0.2); }
            50% { box-shadow: 0 4px 16px rgba(230, 81, 0, 0.4); }
        }
        .product-availability.out-of-stock { 
            background: linear-gradient(135deg, #ffcdd2, #ef9a9a); 
            color: #c62828; 
        }
        .product-promotion { 
            font-size: 11px; 
            background: linear-gradient(135deg, #ff8f00, #f57c00); 
            color: white; padding: 4px 10px; border-radius: 16px; 
            font-weight: 700; box-shadow: 0 2px 8px rgba(255, 143, 0, 0.3);
        }
        .product-link { 
            color: #6d4c41; text-decoration: none; font-size: 13px; 
            font-weight: 600; transition: all 0.3s ease;
            border-bottom: 1px solid transparent;
        }
        .product-link:hover { 
            color: #5d4037; border-bottom-color: #5d4037; 
            transform: translateY(-1px);
        }
        .product-link:hover { text-decoration: underline; color: #6d4c41; }
        .unmatched-ingredients { 
            background: rgba(255,255,255,0.95); border: 1px solid #d7ccc8; 
            border-radius: 12px; padding: 20px; margin-top: 20px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        }
        .unmatched-ingredients h4 { margin: 0 0 12px 0; color: #5d4037; font-size: 16px; font-weight: 700; }
        .unmatched-ingredients ul { margin: 0; padding-left: 20px; color: #6d4c41; font-weight: 500; }
        .unmatched-ingredients li { margin-bottom: 6px; font-size: 14px; }
        .ai-question { font-style: italic; color: #6d4c41; font-size: 16px; text-align: center; padding: 20px; }
        
        /* Shopping Cart Circle */
        #shopping-cart-circle {
            position: relative; margin-left: 15px;
        }
        .cart-icon {
            width: 50px; height: 50px; background: linear-gradient(135deg, #8d6e63, #6d4c41);
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            cursor: pointer; position: relative; font-size: 20px;
            box-shadow: 0 4px 15px rgba(141, 110, 99, 0.3);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .cart-icon:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 6px 20px rgba(141, 110, 99, 0.4);
        }
        .cart-icon.item-added {
            animation: cartBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        @keyframes cartBounce {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); box-shadow: 0 8px 25px rgba(76, 175, 80, 0.5); }
            100% { transform: scale(1); }
        }
        .cart-count {
            position: absolute; top: -8px; right: -8px;
            background: linear-gradient(135deg, #ff5722, #d84315);
            color: white; border-radius: 50%; width: 20px; height: 20px;
            display: none; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700;
            animation: countPulse 0.3s ease-out;
        }
        @keyframes countPulse {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
        .cart-dropdown {
            position: absolute; bottom: 60px; right: 0; width: 280px;
            background: white; border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            opacity: 0; visibility: hidden; transform: translateY(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 1000; max-height: 400px;
            border: 1px solid #e0e0e0;
        }
        .cart-dropdown.show {
            opacity: 1; visibility: visible; transform: translateY(0);
        }
        .cart-header {
            background: linear-gradient(135deg, #8d6e63, #6d4c41);
            color: white; padding: 12px 15px; border-radius: 12px 12px 0 0;
            display: flex; justify-content: space-between; align-items: center;
            font-size: 14px; font-weight: 600;
        }
        .cart-total { font-size: 16px; font-weight: 700; }
        .cart-items {
            max-height: 250px; overflow-y: auto; padding: 8px;
        }
        .empty-cart {
            text-align: center; color: #8d6e63; padding: 20px;
            font-style: italic; font-size: 13px;
        }
        .cart-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px; margin-bottom: 6px; background: #fafafa;
            border: 1px solid #f0f0f0; border-radius: 6px;
            transition: all 0.2s ease;
        }
        .cart-item:hover { background: #f5f5f5; }
        .item-info { flex: 1; margin-right: 8px; }
        .item-name { font-size: 12px; font-weight: 600; color: #3e2723; line-height: 1.2; }
        .item-price { font-size: 11px; color: #6d4c41; margin-top: 2px; }
        .item-controls {
            display: flex; align-items: center; gap: 4px;
        }
        .qty-btn {
            width: 20px; height: 20px; border: 1px solid #8d6e63;
            background: white; border-radius: 3px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: bold; color: #5d4037;
            transition: all 0.2s ease;
        }
        .qty-btn:hover { background: #8d6e63; color: white; }
        .remove-btn {
            width: 20px; height: 20px; border: 1px solid #d32f2f;
            background: white; border-radius: 3px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; font-weight: bold; color: #d32f2f;
            transition: all 0.2s ease;
        }
        .remove-btn:hover { background: #d32f2f; color: white; }
        .clear-cart-btn {
            width: calc(100% - 16px); padding: 8px; margin: 8px;
            background: linear-gradient(135deg, #d32f2f, #b71c1c);
            color: white; border: none; border-radius: 6px;
            cursor: pointer; font-weight: 600; font-size: 12px;
            transition: all 0.2s ease;
        }
        .clear-cart-btn:hover { background: linear-gradient(135deg, #b71c1c, #8b0000); }
        
        /* Add to Cart Button */
        .add-to-cart-btn {
            width: 36px; height: 36px; border: none;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            border-radius: 50%; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
            box-shadow: 0 4px 16px rgba(76, 175, 80, 0.3);
            flex-shrink: 0;
        }
        .add-to-cart-btn:hover {
            transform: scale(1.15) rotate(90deg); 
            background: linear-gradient(135deg, #45a049, #3d8b40);
            box-shadow: 0 8px 24px rgba(76, 175, 80, 0.5);
        }
        .add-to-cart-btn:active {
            transform: scale(0.95); 
            transition: all 0.1s ease;
        }
        .plus-icon { 
            color: white; font-size: 20px; font-weight: 900; 
            transition: all 0.3s ease;
        }
        .ingredient-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px 12px; margin-bottom: 8px; background: #f0f0f0;
            border-radius: 8px; border: 1px solid #e0e0e0;
            transition: all 0.2s ease;
        }
        .ingredient-item:hover { background: #e8e8e8; }
        .ingredient-name {
            font-size: 14px; font-weight: 600; color: #333;
            flex: 1; overflow: hidden; text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ingredient-barcode {
            font-size: 12px; color: #666; margin-left: 10px;
        }
        .remove-ingredient {
            width: 24px; height: 24px; border: none;
            background: #ff4444; color: white; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; font-weight: bold; cursor: pointer;
            transition: all 0.2s ease;
        }
        .remove-ingredient:hover { background: #cc0000; }
        .empty-list {
            text-align: center; color: #888; padding: 20px;
            font-style: italic; font-size: 14px;
        }
    `;
    document.head.appendChild(style);
});
