// Configuration (Hardcoded for this standalone app)
const CONFIG = {
    apiKey: "2717959d3a7246469c32fc7851f0e6dc",
    geminiApiKey: "AIzaSyBlBFZ7pHZUOCd7MPVnKRGqdTnMtDH0KIY",
    coins: ["BTC", "BDX", "ETH"],
    currency: "INR",
    refreshInterval: 60000 // 60 seconds
};

// UI Elements
const marketList = document.getElementById('market-list');
const fngStatus = document.getElementById('fng-status');
const fngCircle = document.getElementById('fng-circle');
const priceBitcoiva = document.getElementById('price-bitcoiva');
const priceKucoin = document.getElementById('price-kucoin');
const lastSyncLabel = document.getElementById('last-sync');
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

/**
 * Fetch and Render Market Data
 */
async function updateMarketData() {
    try {
        // 1. Fetch CMC Data (Using a proxy for local browser compatibility)
        const coinsStr = CONFIG.coins.join(',');
        const cmcUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${coinsStr}&convert=${CONFIG.currency}`;
        
        // We use allorigins as a simple proxy to avoid CORS blocks in the browser
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(cmcUrl)}&headers=${JSON.stringify({"X-CMC_PRO_API_KEY": CONFIG.apiKey})}`);
        const result = await response.json();
        
        if (!result.contents) throw new Error("Proxy error");
        const data = JSON.parse(result.contents).data;

        marketList.innerHTML = '';
        CONFIG.coins.forEach(symbol => {
            const coin = data[symbol];
            if (coin) {
                const quote = coin.quote[CONFIG.currency];
                const price = quote.price;
                const change = quote.percent_change_24h;
                
                const row = document.createElement('div');
                row.className = 'coin-row';
                row.innerHTML = `
                    <div class="coin-info">
                        <span class="coin-symbol">${symbol}</span>
                        <span class="coin-change ${change >= 0 ? 'change-up' : 'change-down'}">
                            ${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%
                        </span>
                    </div>
                    <span class="coin-price">₹${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                `;
                marketList.appendChild(row);
            }
        });

        // 2. Fetch Fear & Greed
        const fngRes = await fetch('https://api.alternative.me/fng/?limit=1');
        const fngData = await fngRes.json();
        const fng = fngData.data[0];
        fngStatus.innerText = `${fng.value} (${fng.value_classification})`;
        
        const val = parseInt(fng.value);
        if (val >= 75) fngCircle.style.background = '#00ff87';
        else if (val >= 50) fngCircle.style.background = '#a2ff00';
        else if (val >= 25) fngCircle.style.background = '#ff9d00';
        else fngCircle.style.background = '#ff4b2b';

        // 3. Bitcoiva
        const bitRes = await fetch('https://api.bitcoiva.com/endPoint2/BDX_INR');
        const bitData = await bitRes.json();
        const bPrice = bitData.message.BDX_INR.last;
        priceBitcoiva.innerText = `₹${bPrice}`;

        // 4. KuCoin Proxy
        const kuRes = await fetch('https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=BDX-USDT');
        const kuData = await kuRes.json();
        const bdxUsdt = parseFloat(kuData.data.price);
        
        let inrRate = 89.5; // fallback
        if (data.BTC) {
            // Estimate INR rate from BTC/INR and BTC/USD
            // We'd need BTC/USD for most accurate rate, but we can assume a rate or fetch it.
            // Simplified: use a fixed rate or derived from config if available.
            inrRate = 90.0; 
        }
        
        const bdxInr = (bdxUsdt * inrRate).toFixed(2);
        priceKucoin.innerText = `₹${parseFloat(bdxInr).toLocaleString()}`;

        lastSyncLabel.innerText = new Date().toLocaleTimeString();
    } catch (error) {
        console.error("Sync Error:", error);
    }
}

/**
 * AI Chatbot Logic
 */
async function askAI() {
    const query = chatInput.value.trim();
    if (!query) return;

    appendMessage('user', query);
    chatInput.value = '';
    
    const loadingMsg = appendMessage('ai', 'Thinking...');

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${CONFIG.geminiApiKey}`;
        const body = {
            contents: [{
                parts: [{ text: `You are a Beldex expert. Answer specifically and concisely: ${query}` }]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await response.json();
        const aiText = result.candidates[0].content.parts[0].text;
        
        loadingMsg.innerText = aiText;
    } catch (error) {
        loadingMsg.innerText = "Error connecting to AI. Please check your key.";
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `message ${role}-message`;
    msg.innerText = text;
    chatHistory.appendChild(msg);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return msg;
}

// Events
sendBtn.onclick = askAI;
chatInput.onkeydown = (e) => { if (e.key === 'Enter') askAI(); };

// Init
updateMarketData();
setInterval(updateMarketData, CONFIG.refreshInterval);
