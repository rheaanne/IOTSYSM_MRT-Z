// Smart Agriculture IoT Dashboard
// v4 — Added Temperature & Humidity KPI cards

class AgricultureDashboard {
    constructor() {
        this.client = null;
        this.username = '';
        this.aioKey = '';
        this.connected = false;
        this.startTime = null;
        this.messageCount = 0;
        this.statusCheckInterval = null;
        this.uptimeInterval = null;
        this.isReconnecting = false;

        this.nodes = [
            {
                id: 'arduino-villamor',
                location: 'Villamor',
                tempFeed: 'villamor-temp',
                humFeed: 'villamor-hum',
                temp: '--', hum: '--',
                timestamp: null, status: 'silent'
            },
            {
                id: 'arduino-afpovai',
                location: 'AFP/OVAI',
                tempFeed: 'afpovai-temp',
                humFeed: 'afpovai-hum',
                temp: '--', hum: '--',
                timestamp: null, status: 'silent'
            },
            {
                id: 'arduino-san-lorenzo',
                location: 'San Lorenzo',
                tempFeed: 'san-lorenzo-temp',
                humFeed: 'san-lorenzo-hum',
                temp: '--', hum: '--',
                timestamp: null, status: 'silent'
            },
            {
                id: 'arduino-better-living',
                location: 'Better Living',
                tempFeed: 'better-living-temp',
                humFeed: 'better-living-hum',
                temp: '--', hum: '--',
                timestamp: null, status: 'silent'
            },
        ];

        this.initElements();
        this.bindEvents();
        this.loadSavedCredentials();
        this.loadSavedNodeData();
        this.initTheme();
        this.renderTable();
        this.autoConnectIfPossible();
    }

    // ── DOM REFS ──────────────────────────────────────────────────────────────
    initElements() {
        // Login
        this.loginPage       = document.getElementById('login-page');
        this.loginForm       = document.getElementById('login-form');
        this.usernameInput   = document.getElementById('username');
        this.aioKeyInput     = document.getElementById('aio-key');
        this.loginError      = document.getElementById('login-error');
        this.errorText       = document.getElementById('error-text');
        this.connectBtn      = document.getElementById('connect-btn');

        // Dashboard
        this.dashPage        = document.getElementById('dashboard-page');
        this.disconnectBtn   = document.getElementById('disconnect-btn');
        this.refreshBtn      = document.getElementById('refresh-btn');
        this.refreshIcon     = document.getElementById('refresh-icon');
        this.themeToggle     = document.getElementById('theme-toggle');
        this.themeIcon       = document.getElementById('theme-icon');

        // Status
        this.connLed         = document.getElementById('conn-led');
        this.connText        = document.getElementById('conn-text');

        // Table
        this.tableBody       = document.getElementById('sensor-table-body');
        this.activeCount     = document.getElementById('active-count');

        // KPI Cards
        this.kpiTempVal      = document.getElementById('kpi-temp-val');
        this.kpiTempMeta     = document.getElementById('kpi-temp-meta');
        this.kpiHumVal       = document.getElementById('kpi-hum-val');
        this.kpiHumMeta      = document.getElementById('kpi-hum-meta');

        // Log
        this.logContent      = document.getElementById('mqtt-log-content');
        this.clearLogBtn     = document.getElementById('clear-log');

        // Stats
        this.activeFeeds     = document.getElementById('active-feeds');
        this.messagesPerHour = document.getElementById('messages-per-hour');
        this.uptimeEl        = document.getElementById('uptime');
    }

    // ── EVENTS ────────────────────────────────────────────────────────────────
    bindEvents() {
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.connect();
        });

        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.refreshBtn.addEventListener('click', () => this.reconnect());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
    }

    // ── CREDENTIALS ───────────────────────────────────────────────────────────
    loadSavedCredentials() {
        const savedUser = localStorage.getItem('adafruit_username');
        const savedKey  = localStorage.getItem('adafruit_aiokey');
        if (savedUser) this.usernameInput.value = savedUser;
        if (savedKey)  this.aioKeyInput.value   = savedKey;
    }

    loadSavedNodeData() {
        const savedData = localStorage.getItem('node_data');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.nodes.forEach(node => {
                    const savedNode = data.find(n => n.id === node.id);
                    if (savedNode) {
                        node.temp = savedNode.temp;
                        node.hum = savedNode.hum;
                        node.timestamp = savedNode.timestamp ? new Date(savedNode.timestamp) : null;
                        this.updateNodeStatus(node);
                    }
                });
            } catch (e) {
                console.error('Failed to load saved node data:', e);
            }
        }
    }

    saveNodeData() {
        const data = this.nodes.map(node => ({
            id: node.id,
            temp: node.temp,
            hum: node.hum,
            timestamp: node.timestamp ? node.timestamp.toISOString() : null
        }));
        localStorage.setItem('node_data', JSON.stringify(data));
    }

    saveCredentials() {
        localStorage.setItem('adafruit_username', this.username);
        localStorage.setItem('adafruit_aiokey',   this.aioKey);
    }

    autoConnectIfPossible() {
        const savedUser = localStorage.getItem('adafruit_username');
        const savedKey  = localStorage.getItem('adafruit_aiokey');
        if (savedUser && savedKey) {
            this.username = savedUser;
            this.aioKey   = savedKey;
            this.connect();
        }
    }

    // ── THEME ─────────────────────────────────────────────────────────────────
    initTheme() {
        const saved = localStorage.getItem('theme') || 'dark';
        document.body.setAttribute('data-theme', saved);
        this.updateThemeIcon(saved);
    }

    toggleTheme() {
        const curr = document.body.getAttribute('data-theme');
        const next = curr === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        this.updateThemeIcon(next);
    }

    updateThemeIcon(theme) {
        if (theme === 'dark') {
            this.themeIcon.innerHTML = `<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`;
        } else {
            this.themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
        }
    }

    // ── CONNECT (from login) ──────────────────────────────────────────────────
    connect() {
        this.username = this.usernameInput.value.trim();
        this.aioKey   = this.aioKeyInput.value.trim();

        if (!this.username || !this.aioKey) {
            this.showError('Please enter both username and AIO key.');
            return;
        }

        if (!this.aioKey.startsWith('aio_')) {
            this.showError('Invalid AIO key. It should start with "aio_".');
            return;
        }

        this.hideError();
        this.setConnectBtn('connecting');

        try {
            this.attemptConnection(false);
        } catch (err) {
            this.handleConnectionError(err.message);
        }
    }

    // ── RECONNECT (stay on dashboard) ─────────────────────────────────────────
    reconnect() {
        if (this.isReconnecting) return;

        if (this.client) {
            try { this.client.end(true); } catch (_) {}
            this.client = null;
        }
        clearInterval(this.statusCheckInterval);
        clearInterval(this.uptimeInterval);
        this.statusCheckInterval = null;
        this.uptimeInterval = null;
        this.connected = false;

        this.setRefreshBtn('reconnecting');
        this.updateConnectionStatus();
        this.addSystemLog('Reconnecting to feeds…');

        try {
            this.attemptConnection(true);
        } catch (err) {
            this.setRefreshBtn('idle');
            this.addSystemLog(`Reconnect failed: ${err.message}`);
        }
    }

    // ── ATTEMPT CONNECTION ────────────────────────────────────────────────────
    attemptConnection(isReconnect) {
        this.isReconnecting = isReconnect;

        const clientId  = `dashboard_${Math.random().toString(16).substr(2, 8)}`;
        const brokerUrl = 'wss://io.adafruit.com/mqtt';

        const client = mqtt.connect(brokerUrl, {
            clientId,
            username:        this.username,
            password:        this.aioKey,
            protocolId:      'MQTT',
            protocolVersion: 4,
            clean:           true,
            keepalive:       60,
            reconnectPeriod: 0,
            connectTimeout:  10000,
        });

        let resolved = false;

        const fail = (reason) => {
            if (resolved) return;
            resolved = true;
            try { client.end(true); } catch (_) {}
            this.isReconnecting = false;

            if (isReconnect) {
                this.setRefreshBtn('idle');
                this.addSystemLog(`Reconnect failed: ${reason}`);
            } else {
                this.handleConnectionError(reason);
            }
        };

        client.on('connect', (connack) => {
            if (resolved) return;

            if (connack.returnCode !== 0) {
                const reasons = { 4: 'Wrong username or password.', 5: 'Not authorized.' };
                fail(reasons[connack.returnCode] || `Connection refused (code ${connack.returnCode}).`);
                return;
            }

            resolved = true;
            this.client = client;
            this.isReconnecting = false;
            this.onConnected(client, isReconnect);
        });

        client.on('error', (err) => fail(err.message));
        client.on('close', () => {
            if (!resolved) fail('Connection closed before authentication completed.');
        });

        setTimeout(() => fail('Connection timed out after 10 seconds.'), 10000);
    }

    // ── ON CONNECTED ──────────────────────────────────────────────────────────
    onConnected(client, isReconnect) {
        client.on('message', (topic, message) => this.handleMessage(topic, message));
        client.on('error',   (err) => {
            this.connected = false;
            this.updateConnectionStatus();
            console.error('MQTT error:', err.message);
        });
        client.on('close',   () => { this.connected = false; this.updateConnectionStatus(); });
        client.on('offline', () => { this.connected = false; this.updateConnectionStatus(); });

        this.connected    = true;
        this.startTime    = new Date();
        this.messageCount = 0;

        this.saveCredentials();
        this.setRefreshBtn('idle');
        this.updateConnectionStatus();

        if (!isReconnect) {
            this.showDashboard();
        } else {
            this.addSystemLog('Reconnected successfully. Data preserved.');
        }

        this.subscribeToAllFeeds();
        this.startStatusCheck();
        this.startUptimeClock();
        this.updateStats();
    }

    // ── DISCONNECT (go to login) ───────────────────────────────────────────────
    disconnect() {
        if (this.client) {
            try { this.client.end(); } catch (_) {}
            this.client = null;
        }
        this.connected = false;
        clearInterval(this.statusCheckInterval);
        clearInterval(this.uptimeInterval);
        this.statusCheckInterval = null;
        this.uptimeInterval      = null;

        this.updateConnectionStatus();
        this.showLogin();
        this.setConnectBtn('idle');
    }

    // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
    subscribeToAllFeeds() {
        this.nodes.forEach(node => {
            const tempTopic = `${this.username}/feeds/${node.tempFeed}`;
            const humTopic  = `${this.username}/feeds/${node.humFeed}`;

            this.client.subscribe(tempTopic, (err) => {
                if (err) console.error(`Subscribe error: ${tempTopic}`, err);
                else console.log(`Subscribed to: ${tempTopic}`);
            });
            this.client.subscribe(humTopic, (err) => {
                if (err) console.error(`Subscribe error: ${humTopic}`, err);
                else console.log(`Subscribed to: ${humTopic}`);
            });
        });
    }

    // ── RESET NODE DATA ───────────────────────────────────────────────────────
    resetNodeData() {
        this.nodes.forEach(node => {
            node.temp      = '--';
            node.hum       = '--';
            node.timestamp = null;
            node.status    = 'silent';
        });
    }

    // ── MESSAGE HANDLER ───────────────────────────────────────────────────────
    handleMessage(topic, message) {
        const raw   = message.toString().trim();
        console.log(`[MQTT] Received: ${topic} = ${raw}`);
        const value = parseFloat(raw);
        if (isNaN(value)) {
            console.warn(`[MQTT] Invalid value: ${raw}`);
            return;
        }

        this.messageCount++;

        const parts    = topic.split('/');
        const feedName = parts[parts.length - 1];
        const node     = this.nodes.find(n => n.tempFeed === feedName || n.humFeed === feedName);
        if (!node) return;

        const isTemp = feedName === node.tempFeed;

        if (isTemp) {
            node.temp = value.toFixed(1);
        } else {
            node.hum = value.toFixed(1);
        }
        node.timestamp = new Date();

        this.updateNodeStatus(node);
        this.renderTable();
        this.addLogEntry(feedName, value, isTemp);
        this.updateStats();
        this.saveNodeData();
    }

    // ── NODE STATUS ───────────────────────────────────────────────────────────
    updateNodeStatus(node) {
        const age = node.timestamp ? Date.now() - node.timestamp.getTime() : Infinity;
        node.status = age < 30000 ? 'transmitting' : 'silent';
    }

    startStatusCheck() {
        this.statusCheckInterval = setInterval(() => {
            this.nodes.forEach(n => this.updateNodeStatus(n));
            this.renderTable();
            this.updateStats();
        }, 10000);
    }

    // ── CONNECTION STATUS ─────────────────────────────────────────────────────
    updateConnectionStatus() {
        if (this.connected) {
            this.connLed.classList.add('on');
            this.connText.textContent = 'Connected';
        } else {
            this.connLed.classList.remove('on');
            this.connText.textContent = 'Disconnected';
        }
    }

    // ── KPI CARDS ─────────────────────────────────────────────────────────────
    renderKpiCards() {
        // --- Temperature KPI ---
        const nodesWithTemp = this.nodes.filter(n => n.temp !== '--');
        let tempVals = nodesWithTemp.map(n => parseFloat(n.temp));
        let tempDisplay = '--';
        let tempMin = '--', tempMax = '--', tempLast = '--', tempTrend = '';
        if (tempVals.length > 0) {
            const avgTemp = tempVals.reduce((s, v) => s + v, 0) / tempVals.length;
            tempMin = Math.min(...tempVals).toFixed(1);
            tempMax = Math.max(...tempVals).toFixed(1);
            tempLast = nodesWithTemp[nodesWithTemp.length - 1].temp;
            // Trend: compare last two averages
            if (!this.prevAvgTemp) this.prevAvgTemp = avgTemp;
            if (avgTemp > this.prevAvgTemp) tempTrend = '↑';
            else if (avgTemp < this.prevAvgTemp) tempTrend = '↓';
            else tempTrend = '→';
            this.prevAvgTemp = avgTemp;
            tempDisplay = `${avgTemp.toFixed(1)}<span>°C</span> <span class="kpi-trend">${tempTrend}</span>`;
        } else {
            tempDisplay = `--<span>°C</span>`;
        }
        this.kpiTempVal.innerHTML = tempDisplay;

        // --- Humidity KPI ---
        const nodesWithHum = this.nodes.filter(n => n.hum !== '--');
        let humVals = nodesWithHum.map(n => parseFloat(n.hum));
        let humDisplay = '--';
        let humMin = '--', humMax = '--', humLast = '--', humTrend = '';
        if (humVals.length > 0) {
            const avgHum = humVals.reduce((s, v) => s + v, 0) / humVals.length;
            humMin = Math.min(...humVals).toFixed(1);
            humMax = Math.max(...humVals).toFixed(1);
            humLast = nodesWithHum[nodesWithHum.length - 1].hum;
            // Trend: compare last two averages
            if (!this.prevAvgHum) this.prevAvgHum = avgHum;
            if (avgHum > this.prevAvgHum) humTrend = '↑';
            else if (avgHum < this.prevAvgHum) humTrend = '↓';
            else humTrend = '→';
            this.prevAvgHum = avgHum;
            humDisplay = `${avgHum.toFixed(1)}<span>%</span> <span class="kpi-trend">${humTrend}</span>`;
        } else {
            humDisplay = `--<span>%</span>`;
        }
        this.kpiHumVal.innerHTML = humDisplay;

        // --- Meta/Badge ---
        const activeNodes = this.nodes.filter(n => n.status === 'transmitting');
        const total = this.nodes.length;
        const active = activeNodes.length;
        let metaText = '';
        if (active > 0) {
            // Show last update time if available
            const lastUpdate = Math.max(...this.nodes.map(n => n.timestamp ? n.timestamp.getTime() : 0));
            if (lastUpdate > 0) {
                const date = new Date(lastUpdate);
                metaText = `<span class="kpi-badge active-badge">${active} of ${total} nodes active</span> <span class="kpi-update">Last update: ${date.toLocaleTimeString()}</span>`;
            } else {
                metaText = `<span class="kpi-badge active-badge">${active} of ${total} nodes active</span>`;
            }
        } else {
            metaText = `<span class="kpi-badge silent-badge">No active nodes</span>`;
        }
        this.kpiTempMeta.innerHTML = metaText;
        this.kpiHumMeta.innerHTML = metaText;
    }

    // ── TABLE ─────────────────────────────────────────────────────────────────
    renderTable() {
        this.renderKpiCards();
        this.tableBody.innerHTML = '';

        this.nodes.forEach(node => {
            const row = document.createElement('tr');

            const timeStr  = node.timestamp ? node.timestamp.toLocaleTimeString() : '--';
            const tempDisp = node.temp === '--' ? '--' : `${node.temp}°C`;
            const humDisp  = node.hum  === '--' ? '--' : `${node.hum}%`;

            row.innerHTML = `
                <td><span class="sensor-id">${node.id}</span></td>
                <td>${node.location}</td>
                <td><span class="temp-val">${tempDisp}</span></td>
                <td><span class="hum-val">${humDisp}</span></td>
                <td>
                    <span class="status-badge ${node.status}">
                        <span class="status-dot"></span>
                        ${node.status === 'transmitting' ? 'Transmitting' : 'Silent'}
                    </span>
                </td>
                <td><span class="time-val">${timeStr}</span></td>
            `;

            this.tableBody.appendChild(row);
        });

        const activeNum = this.nodes.filter(n => n.status === 'transmitting').length;
        this.activeCount.textContent = `${activeNum} Active`;
    }

    // ── LOG ───────────────────────────────────────────────────────────────────
    addLogEntry(feedName, value, isTemp) {
        const empty = this.logContent.querySelector('.log-empty');
        if (empty) empty.remove();

        const entry = document.createElement('div');
        entry.className = `log-entry ${isTemp ? 'temp' : 'hum'}`;

        const unit = isTemp ? '°C' : '%';
        entry.innerHTML = `
            <span class="log-ts">[${new Date().toLocaleTimeString()}]</span>
            <span class="log-feed">${feedName}</span>
            <span class="log-val">${value}${unit}</span>
        `;

        this.logContent.appendChild(entry);
        this.logContent.scrollTop = this.logContent.scrollHeight;

        while (this.logContent.children.length > 100) {
            this.logContent.removeChild(this.logContent.firstChild);
        }
    }

    addSystemLog(msg) {
        const empty = this.logContent.querySelector('.log-empty');
        if (empty) empty.remove();

        const entry = document.createElement('div');
        entry.className = 'log-entry system';
        entry.innerHTML = `
            <span class="log-ts">[${new Date().toLocaleTimeString()}]</span>
            <span class="log-sys">${msg}</span>
        `;

        this.logContent.appendChild(entry);
        this.logContent.scrollTop = this.logContent.scrollHeight;
    }

    clearLog() {
        this.logContent.innerHTML = '<div class="log-empty">Log cleared.</div>';
    }

    // ── STATS ─────────────────────────────────────────────────────────────────
    updateStats() {
        if (!this.startTime) return;

        const activeNum = this.nodes.filter(n => n.status === 'transmitting').length;
        this.activeFeeds.textContent = activeNum;

        const elapsedHours = (Date.now() - this.startTime.getTime()) / 3600000;
        const mph = elapsedHours > 0 ? Math.round(this.messageCount / elapsedHours) : 0;
        this.messagesPerHour.textContent = mph;
    }

    startUptimeClock() {
        this.uptimeInterval = setInterval(() => {
            if (!this.startTime) return;
            const ms = Date.now() - this.startTime.getTime();
            const h  = Math.floor(ms / 3600000);
            const m  = Math.floor((ms % 3600000) / 60000);
            const s  = Math.floor((ms % 60000) / 1000);
            this.uptimeEl.textContent =
                `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }, 1000);
    }

    // ── BUTTON STATES ─────────────────────────────────────────────────────────
    setConnectBtn(state) {
        const btnText = this.connectBtn.querySelector('.btn-text');
        if (state === 'connecting') {
            btnText.textContent = 'Connecting…';
            this.connectBtn.disabled = true;
        } else {
            btnText.textContent = 'Connect to Network';
            this.connectBtn.disabled = false;
        }
    }

    setRefreshBtn(state) {
        if (state === 'reconnecting') {
            this.refreshBtn.disabled = true;
            this.refreshBtn.classList.add('spinning');
            this.refreshBtn.querySelector('.refresh-label').textContent = 'Reconnecting…';
        } else {
            this.refreshBtn.disabled = false;
            this.refreshBtn.classList.remove('spinning');
            this.refreshBtn.querySelector('.refresh-label').textContent = 'Reconnect';
        }
    }

    // ── ERROR DISPLAY ─────────────────────────────────────────────────────────
    showError(msg) {
        this.errorText.textContent = msg;
        this.loginError.classList.remove('hidden');
    }

    hideError() {
        this.loginError.classList.add('hidden');
    }

    handleConnectionError(msg) {
        this.showError(msg);
        this.setConnectBtn('idle');
    }

    // ── PAGE SWITCHING ────────────────────────────────────────────────────────
    showDashboard() {
        this.loginPage.classList.add('hidden');
        this.dashPage.classList.remove('hidden');
    }

    showLogin() {
        this.dashPage.classList.add('hidden');
        this.loginPage.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AgricultureDashboard();
});