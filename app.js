// Smart Agriculture IoT Dashboard
// v7 — Supabase Real-Time WebSocket (wss://) + REST API History
// Uses sensor_logs table with feed_name schema

class AgricultureDashboard {
    constructor() {
        this.connected = false;
        this.startTime = null;
        this.messageCount = 0;
        this.statusCheckInterval = null;
        this.uptimeInterval = null;
        this.supabaseSubscription = null;

        // Load configuration
        if (typeof config === 'undefined') {
            console.error('[Dashboard] Config not loaded!');
            alert('Configuration error: config.js not loaded.');
            return;
        }

        this.SUPABASE_URL = config.getSupabaseUrl();
        this.SUPABASE_ANON_KEY = config.getSupabaseAnonKey();
        this.SENSOR_NODES = config.SENSOR_NODES;

        if (this.SUPABASE_URL && this.SUPABASE_ANON_KEY) {
            try {
                this.supabase = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
                    realtime: { params: { eventsPerSecond: 10 } }
                });
                console.log('[Supabase] Client initialized');
            } catch (err) {
                console.error('[Supabase] Failed to initialize:', err.message);
                alert('Error: Supabase initialization failed.');
                return;
            }
        } else {
            console.error('[Supabase] Configuration missing');
            alert('Error: Supabase configuration missing.');
            return;
        }

        this.initElements();
        this.bindEvents();
        
        // Initialize sensor nodes (from config)
        this.nodes = this.SENSOR_NODES.map(n => ({
            ...n,
            temp: '--',
            hum: '--',
            timestamp: null,
            status: 'silent'
        }));

        this.loadSavedNodeData();
        this.initTheme();
        this.renderTable();
        
        // Start Supabase real-time subscription (WebSocket on port 443)
        this.startSupabaseSubscription();
    }

    // ── DOM REFS ──────────────────────────────────────────────────────────────
    initElements() {
        this.dashPage        = document.getElementById('dashboard-page');
        this.disconnectBtn   = document.getElementById('disconnect-btn');
        this.refreshBtn      = document.getElementById('refresh-btn');
        this.themeToggle     = document.getElementById('theme-toggle');
        this.themeIcon       = document.getElementById('theme-icon');

        this.connLed         = document.getElementById('conn-led');
        this.connText        = document.getElementById('conn-text');

        this.tableBody       = document.getElementById('sensor-table-body');
        this.activeCount     = document.getElementById('active-count');

        this.kpiTempVal      = document.getElementById('kpi-temp-val');
        this.kpiTempMeta     = document.getElementById('kpi-temp-meta');
        this.kpiHumVal       = document.getElementById('kpi-hum-val');
        this.kpiHumMeta      = document.getElementById('kpi-hum-meta');

        this.logContent      = document.getElementById('mqtt-log-content');
        this.clearLogBtn     = document.getElementById('clear-log');

        this.historyContent  = document.getElementById('history-content');
        this.loadHistoryBtn  = document.getElementById('load-history-btn');

        this.activeFeeds     = document.getElementById('active-feeds');
        this.messagesPerHour = document.getElementById('messages-per-hour');
        this.uptimeEl        = document.getElementById('uptime');
    }

    // ── EVENTS ────────────────────────────────────────────────────────────────
    bindEvents() {
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.refreshBtn.addEventListener('click', () => this.reconnect());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
        this.loadHistoryBtn.addEventListener('click', () => this.loadHistory());
    }

    // ── NODE DATA PERSISTENCE ─────────────────────────────────────────────────
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

    resetNodeData() {
        this.nodes.forEach(n => {
            n.temp = '--';
            n.hum = '--';
            n.timestamp = null;
            n.status = 'silent';
        });
        this.saveNodeData();
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

    // ── SUPABASE REAL-TIME SUBSCRIPTION (WebSocket wss:// on Port 443) ────────
    startSupabaseSubscription() {
        console.log('[Supabase] Establishing secure WebSocket (wss://) on Port 443...');
        this.addSystemLog('Connecting to Supabase real-time...');
        
        this.supabaseSubscription = this.supabase
            .channel('sensor_logs_changes')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'sensor_logs'
            }, (payload) => {
                this.handleSupabaseInsert(payload.new);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    this.connected = true;
                    this.startTime = new Date();
                    this.messageCount = 0;
                    this.startStatusCheck();
                    this.startUptimeClock();
                    this.updateStats();
                    console.log('[Supabase] ✓ Connected via wss:// on Port 443');
                    this.addSystemLog('✓ Connected via secure WebSocket (wss://) on Port 443');
                    this.updateConnectionStatus();
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('[Supabase] Subscription error');
                    this.addSystemLog('✗ WebSocket subscription error');
                    this.connected = false;
                    this.updateConnectionStatus();
                } else if (status === 'TIMED_OUT') {
                    console.error('[Supabase] WebSocket connection timed out');
                    this.addSystemLog('✗ WebSocket connection timed out');
                    this.connected = false;
                    this.updateConnectionStatus();
                } else if (status === 'CLOSED') {
                    this.connected = false;
                    console.log('[Supabase] WebSocket connection closed');
                    this.updateConnectionStatus();
                }
            });
    }

    // ── RECONNECT ─────────────────────────────────────────────────────────────
    reconnect() {
        this.addSystemLog('Attempting to reconnect...');
        
        if (this.supabaseSubscription) {
            try {
                this.supabase.removeChannel(this.supabaseSubscription);
            } catch (_) {}
        }
        
        clearInterval(this.statusCheckInterval);
        clearInterval(this.uptimeInterval);
        this.statusCheckInterval = null;
        this.uptimeInterval = null;
        this.connected = false;
        
        this.updateConnectionStatus();
        this.startSupabaseSubscription();
    }

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    disconnect() {
        if (this.supabaseSubscription) {
            try {
                this.supabase.removeChannel(this.supabaseSubscription);
            } catch (_) {}
            this.supabaseSubscription = null;
        }
        
        this.connected = false;
        this.addSystemLog('Disconnected from Supabase');
        clearInterval(this.statusCheckInterval);
        clearInterval(this.uptimeInterval);
        this.statusCheckInterval = null;
        this.uptimeInterval = null;

        this.updateConnectionStatus();
        this.resetNodeData();
        this.renderTable();
    }

    // ── PARSE FEED NAME ────────────────────────────────────────────────────────
    // Feed name format: "VLM-01-temperature" or "VLM-01-humidity"
    parseFeedName(feedName) {
        const parts = feedName.split('-');
        const nodeId = parts.slice(0, 2).join('-'); // "VLM-01"
        const type = parts.slice(2).join('-');      // "temperature" or "humidity"
        return { nodeId, type };
    }

    // ── HANDLE NEW READINGS FROM SENSOR_LOGS ──────────────────────────────────
    handleSupabaseInsert(reading) {
        this.messageCount++;

        const { nodeId, type } = this.parseFeedName(reading.feed_name);
        const value = reading.value;
        const createdAt = new Date(reading.created_at);

        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        if (type === 'temperature') {
            node.temp = value.toFixed(1);
        } else if (type === 'humidity') {
            node.hum = value.toFixed(1);
        }
        node.timestamp = createdAt;

        this.updateNodeStatus(node);
        this.renderTable();
        this.addLogEntry(reading.feed_name, value);
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
        // Temperature KPI
        const nodesWithTemp = this.nodes.filter(n => n.temp !== '--');
        let tempVals = nodesWithTemp.map(n => parseFloat(n.temp));
        let tempDisplay = '--';
        if (tempVals.length > 0) {
            const avgTemp = tempVals.reduce((s, v) => s + v, 0) / tempVals.length;
            const tempMin = Math.min(...tempVals).toFixed(1);
            const tempMax = Math.max(...tempVals).toFixed(1);
            if (!this.prevAvgTemp) this.prevAvgTemp = avgTemp;
            const tempTrend = avgTemp > this.prevAvgTemp ? '↑' : avgTemp < this.prevAvgTemp ? '↓' : '→';
            this.prevAvgTemp = avgTemp;
            tempDisplay = `${avgTemp.toFixed(1)}<span>°C</span> <span class="kpi-trend">${tempTrend}</span>`;
        } else {
            tempDisplay = `--<span>°C</span>`;
        }
        this.kpiTempVal.innerHTML = tempDisplay;

        // Humidity KPI
        const nodesWithHum = this.nodes.filter(n => n.hum !== '--');
        let humVals = nodesWithHum.map(n => parseFloat(n.hum));
        let humDisplay = '--';
        if (humVals.length > 0) {
            const avgHum = humVals.reduce((s, v) => s + v, 0) / humVals.length;
            if (!this.prevAvgHum) this.prevAvgHum = avgHum;
            const humTrend = avgHum > this.prevAvgHum ? '↑' : avgHum < this.prevAvgHum ? '↓' : '→';
            this.prevAvgHum = avgHum;
            humDisplay = `${avgHum.toFixed(1)}<span>%</span> <span class="kpi-trend">${humTrend}</span>`;
        } else {
            humDisplay = `--<span>%</span>`;
        }
        this.kpiHumVal.innerHTML = humDisplay;

        // Meta
        const activeNodes = this.nodes.filter(n => n.status === 'transmitting');
        const total = this.nodes.length;
        const active = activeNodes.length;
        let metaText = '';
        if (active > 0) {
            const lastUpdate = Math.max(...this.nodes.map(n => n.timestamp ? n.timestamp.getTime() : 0));
            if (lastUpdate > 0) {
                const date = new Date(lastUpdate);
                metaText = `<span class="kpi-badge active-badge">${active} of ${total} nodes active</span> <span class="kpi-update">Last: ${date.toLocaleTimeString()}</span>`;
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
    addLogEntry(feedName, value) {
        const empty = this.logContent.querySelector('.log-empty');
        if (empty) empty.remove();

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const { type } = this.parseFeedName(feedName);
        const unit = type === 'temperature' ? '°C' : '%';

        entry.innerHTML = `
            <span class="log-ts">[${new Date().toLocaleTimeString()}]</span>
            <span class="log-feed">${feedName}</span>
            <span class="log-val">${value.toFixed(1)}${unit}</span>
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

    // ── LOAD HISTORY VIA REST API ─────────────────────────────────────────────
    async loadHistory() {
        this.loadHistoryBtn.disabled = true;
        this.loadHistoryBtn.textContent = 'Loading…';

        try {
            // Use Supabase REST API to fetch historical logs
            const response = await fetch(
                `${this.SUPABASE_URL}/rest/v1/sensor_logs?order=created_at.desc&limit=100`,
                {
                    headers: {
                        'apikey': this.SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            this.historyContent.innerHTML = '';

            if (data.length === 0) {
                this.historyContent.innerHTML = '<div class="log-empty">No historical data found.</div>';
                return;
            }

            data.forEach(log => {
                const entry = document.createElement('div');
                entry.className = 'history-entry';
                const timestamp = new Date(log.created_at).toLocaleString();
                entry.innerHTML = `
                    <span class="history-ts">[${timestamp}]</span>
                    <span class="history-feed">${log.feed_name}</span>
                    <span class="history-value">${log.value}</span>
                `;
                this.historyContent.appendChild(entry);
            });

        } catch (err) {
            console.error('Error loading history:', err);
            this.historyContent.innerHTML = `<div class="log-empty">Error: ${err.message}</div>`;
        } finally {
            this.loadHistoryBtn.disabled = false;
            this.loadHistoryBtn.textContent = 'Load from Supabase';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AgricultureDashboard();
});
