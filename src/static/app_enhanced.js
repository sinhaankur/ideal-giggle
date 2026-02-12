// Building Management AI - Enhanced Application
// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// State management
const appState = {
    user: null,
    chatSessionId: null,
    isAuthenticated: false
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Check if user is already logged in
    await checkAuth();
    
    // Initialize all components
    initializeNavigation();
    initializePredictionForm();
    initializeModelStatus();
    initializeChat();
    initializeAuth();
    
    // Load dashboard data if authenticated
    if (appState.isAuthenticated) {
        loadDashboardData();
    } else {
        // Show login modal
        showAuthModal('login');
    }
}

// Authentication Functions
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            appState.user = data;
            appState.isAuthenticated = true;
            updateUIForAuth();
        }
    } catch (error) {
        console.log('Not authenticated');
    }
}

function initializeAuth() {
    const authForm = document.getElementById('auth-form');
    const authSwitchLink = document.getElementById('auth-switch-link');
    
    authForm.addEventListener('submit', handleAuthSubmit);
    authSwitchLink.addEventListener('click', toggleAuthMode);
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const isRegister = document.getElementById('email-group').style.display !== 'none';
    
    const data = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    if (isRegister) {
        data.email = formData.get('email');
    }
    
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            appState.user = result.user;
            appState.isAuthenticated = true;
            updateUIForAuth();
            hideAuthModal();
            showNotification(isRegister ? 'Account created successfully!' : 'Welcome back!', 'success');
            loadDashboardData();
        } else {
            showNotification(result.error || 'Authentication failed', 'error');
        }
    } catch (error) {
        showNotification('Network error. Please try again.', 'error');
    }
}

function toggleAuthMode() {
    const emailGroup = document.getElementById('email-group');
    const title = document.getElementById('auth-modal-title');
    const subtitle = document.getElementById('auth-modal-subtitle');
    const btnText = document.getElementById('auth-btn-text');
    const switchText = document.getElementById('auth-switch-text');
    const switchLink = document.getElementById('auth-switch-link');
    
    if (emailGroup.style.display === 'none') {
        // Switch to register
        emailGroup.style.display = 'block';
        title.textContent = 'Register';
        subtitle.textContent = 'Create your Building AI account';
        btnText.textContent = 'Register';
        switchText.textContent = 'Already have an account?';
        switchLink.textContent = 'Login';
    } else {
        // Switch to login
        emailGroup.style.display = 'none';
        title.textContent = 'Login';
        subtitle.textContent = 'Access your Building AI dashboard';
        btnText.textContent = 'Login';
        switchText.textContent = "Don't have an account?";
        switchLink.textContent = 'Register';
    }
}

function showAuthModal(mode = 'login') {
    const modal = document.getElementById('auth-modal');
    modal.classList.remove('hidden');
    
    if (mode === 'register') {
        toggleAuthMode();
    }
}

function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.add('hidden');
}

function updateUIForAuth() {
    if (appState.user) {
        const userProfile = document.querySelector('.user-profile span');
        if (userProfile) {
            userProfile.textContent = appState.user.username;
        }
    }
}

// Navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const pageName = item.dataset.page;
            showPage(pageName);
        });
    });
}

function showPage(pageName) {
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => page.classList.add('hidden'));
    
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    if (pageName === 'models') {
        loadModelStatus();
    } else if (pageName === 'chat' && appState.isAuthenticated) {
        focusChatInput();
    } else if (pageName === 'users' && appState.isAuthenticated) {
        loadUsers();
    }
}

// Dashboard Data
async function loadDashboardData() {
    try {
        updateStats();
        await loadModelStatus();
        
        // Check AI health
        const healthResponse = await fetch(`${API_BASE_URL}/ai/health`);
        const health = await healthResponse.json();
        
        if (health.status === 'healthy') {
            showNotification('AI services connected', 'success');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateStats() {
    const stats = {
        energy: '1,234 kWh',
        occupancy: '78%',
        temperature: '22.5°C',
        alerts: '3'
    };
    
    const energyValue = document.getElementById('energy-value');
    const occupancyValue = document.getElementById('occupancy-value');
    const tempValue = document.getElementById('temp-value');
    const alertsValue = document.getElementById('alerts-value');
    
    if (energyValue) energyValue.textContent = stats.energy;
    if (occupancyValue) occupancyValue.textContent = stats.occupancy;
    if (tempValue) tempValue.textContent = stats.temperature;
    if (alertsValue) alertsValue.textContent = stats.alerts;
}

// AI Chat Functionality
function initializeChat() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    
    if (!chatInput || !sendBtn) return;
    
    sendBtn.addEventListener('click', sendChatMessage);
    
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
        
        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });
}

async function sendChatMessage() {
    if (!appState.isAuthenticated) {
        showNotification('Please login to use AI chat', 'warning');
        showAuthModal('login');
        return;
    }
    
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Add user message to chat
    addMessageToChat('user', message);
    
    // Show loading indicator
    const loadingId = addLoadingMessage();
    
    // Disable send button
    const sendBtn = document.getElementById('chat-send-btn');
    sendBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                message: message,
                session_id: appState.chatSessionId
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update session ID
            if (data.session_id) {
                appState.chatSessionId = data.session_id;
            }
            
            // Remove loading and add AI response
            removeLoadingMessage(loadingId);
            addMessageToChat('assistant', data.response);
        } else {
            removeLoadingMessage(loadingId);
            showNotification('Failed to get AI response', 'error');
        }
    } catch (error) {
        removeLoadingMessage(loadingId);
        showNotification('Network error. Please check AI service connection.', 'error');
        addMessageToChat('assistant', "Sorry, I'm having trouble connecting right now. Please make sure the AI service (Ollama) is running on port 11434.");
    } finally {
        sendBtn.disabled = false;
        focusChatInput();
    }
}

function addMessageToChat(role, content) {
    const messagesContainer = document.getElementById('chat-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${role}`;
    avatar.innerHTML = role === 'user' 
        ? '<i class="fas fa-user"></i>' 
        : '<i class="fas fa-robot"></i>';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('p');
    messageText.textContent = content;
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = new Date().toLocaleTimeString();
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageTime);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addLoadingMessage() {
    const messagesContainer = document.getElementById('chat-messages');
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-loading';
    loadingDiv.id = 'loading-' + Date.now();
    loadingDiv.innerHTML = `
        <div class="message-avatar assistant">
            <i class="fas fa-robot"></i>
        </div>
        <div class="chat-loading-dots">
            <div class="chat-loading-dot"></div>
            <div class="chat-loading-dot"></div>
            <div class="chat-loading-dot"></div>
        </div>
    `;
    
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return loadingDiv.id;
}

function removeLoadingMessage(loadingId) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function focusChatInput() {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.focus();
    }
}

// Prediction Form
function initializePredictionForm() {
    const form = document.getElementById('prediction-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!appState.isAuthenticated) {
            showNotification('Please login to make predictions', 'warning');
            showAuthModal('login');
            return;
        }
        
        const formData = new FormData(form);
        const data = {
            temperature: parseFloat(formData.get('temperature')),
            occupancy: parseInt(formData.get('occupancy')),
            time: formData.get('time'),
            day: formData.get('day')
        };
        
        await submitPrediction(data);
    });
}

async function submitPrediction(data) {
    try:
        showNotification('Generating prediction...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        displayPredictionResult(result);
        showNotification('Prediction generated successfully!', 'success');
    } catch (error) {
        console.error('Prediction error:', error);
        showNotification('Error generating prediction', 'error');
    }
}

function displayPredictionResult(result) {
    const resultDiv = document.getElementById('prediction-result');
    const outputDiv = document.getElementById('prediction-output');
    
    let html = `<p><strong>Prediction:</strong> ${result.prediction || result}</p>`;
    
    if (result.confidence) {
        html += `<p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(1)}%</p>`;
    }
    
    if (result.timestamp) {
        html += `<p><strong>Generated:</strong> ${new Date(result.timestamp).toLocaleString()}</p>`;
    }
    
    outputDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
}

// Model Status
function initializeModelStatus() {
    const refreshButton = document.getElementById('refresh-models');
    
    if (refreshButton) {
        refreshButton.addEventListener('click', loadModelStatus);
    }

    // Load once on page entry
    loadModelStatus();
    loadAIEngineStatus();
}

async function loadModelStatus() {
    try {
        showNotification('Loading model status...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/model-status`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const status = await response.json();
        displayModelStatus(status);
        showNotification('Model status loaded!', 'success');
    } catch (error) {
        console.error('Model status error:', error);
        showNotification('Error loading model status', 'warning');
    }
}

// Ollama / AI Engine Status
async function loadAIEngineStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/status`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayAIEngineStatus(data);
    } catch (error) {
        console.error('AI engine status error:', error);
        displayAIEngineStatus({ success: false });
    }
}

function displayAIEngineStatus(data) {
    const providerEl = document.getElementById('ai-engine-provider');
    const statusEl = document.getElementById('ai-engine-status');
    const modelsEl = document.getElementById('ai-engine-models');
    const noteEl = document.getElementById('ai-engine-note');

    if (!providerEl || !statusEl || !modelsEl) return;

    if (!data || data.error) {
        providerEl.textContent = 'Unknown';
        statusEl.textContent = 'Error';
        statusEl.style.color = '#b91c1c';
        modelsEl.textContent = '--';
        if (noteEl) noteEl.textContent = data && data.error ? data.error : 'Unable to reach AI status endpoint.';
        return;
    }

    const provider = data.ai_client ? data.ai_client.provider : 'ollama';
    const ollama = data.ollama || {};

    providerEl.textContent = `${provider} (on-device)`;

    if (ollama.status === 'running') {
        statusEl.textContent = 'Online';
        statusEl.style.color = '#065f46';
    } else if (ollama.status === 'unavailable') {
        statusEl.textContent = 'Unavailable';
        statusEl.style.color = '#b91c1c';
    } else {
        statusEl.textContent = ollama.status || 'Unknown';
        statusEl.style.color = '#92400e';
    }

    if (Array.isArray(ollama.models) && ollama.models.length > 0) {
        modelsEl.textContent = ollama.models.join(', ');
    } else {
        modelsEl.textContent = 'No models reported';
    }

    if (noteEl) {
        noteEl.textContent = data.note || 'All AI processing happens locally on this device.';
    }
}

function displayModelStatus(status) {
    if (status.building_model) {
        const buildingCard = document.getElementById('model-building');
        if (buildingCard) updateModelCard(buildingCard, status.building_model);
    }
    
    if (status.energy_model) {
        const energyCard = document.getElementById('model-energy');
        if (energyCard) updateModelCard(energyCard, status.energy_model);
    }
}

function updateModelCard(card, data) {
    const statusBadge = card.querySelector('.status-badge');
    const accuracy = card.querySelector('.accuracy');
    const lastUpdated = card.querySelector('.last-updated');
    
    if (statusBadge) {
        statusBadge.className = 'status-badge';
        if (data.status === 'active') {
            statusBadge.classList.add('active');
            statusBadge.textContent = 'Active';
        } else if (data.status === 'inactive') {
            statusBadge.classList.add('inactive');
            statusBadge.textContent = 'Inactive';
        } else {
            statusBadge.classList.add('loading');
            statusBadge.textContent = 'Loading';
        }
    }
    
    if (accuracy && data.accuracy) {
        accuracy.textContent = `${(data.accuracy * 100).toFixed(1)}%`;
    }
    
    if (lastUpdated && data.last_updated) {
        const date = new Date(data.last_updated);
        lastUpdated.textContent = date.toLocaleString();
    }
}

// Load Users (Admin)
async function loadUsers() {
    const loadingEl = document.getElementById('users-loading');
    const errorEl = document.getElementById('users-error');
    const contentEl = document.getElementById('users-content');
    const errorMessage = document.getElementById('users-error-message');
    
    // Show loading
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    contentEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load users: ${response.status}`);
        }
        
        const data = await response.json();
        displayUsers(data.users);
        
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    } catch (error) {
        console.error('Error loading users:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorMessage.textContent = error.message;
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #6b7280;">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e5e7eb';
        
        const statusBadge = user.is_active ? 
            '<span style="background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 12px; font-size: 0.875rem; font-weight: 500;">Active</span>' :
            '<span style="background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 12px; font-size: 0.875rem; font-weight: 500;">Inactive</span>';
        
        const roleBadge = user.role === 'admin' ?
            '<span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 0.875rem; font-weight: 500;">Admin</span>' :
            '<span style="background: #e5e7eb; color: #374151; padding: 4px 12px; border-radius: 12px; font-size: 0.875rem; font-weight: 500;">User</span>';
        
        const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
        const lastLoginDate = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';
        
        row.innerHTML = `
            <td style="padding: 12px; color: #111827;">${user.id}</td>
            <td style="padding: 12px; color: #111827; font-weight: 500;">${user.username}</td>
            <td style="padding: 12px; color: #6b7280;">${user.email}</td>
            <td style="padding: 12px;">${roleBadge}</td>
            <td style="padding: 12px;">${statusBadge}</td>
            <td style="padding: 12px; color: #6b7280;">${createdDate}</td>
            <td style="padding: 12px; color: #6b7280;">${lastLoginDate}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '1rem 1.5rem',
        borderRadius: '0.5rem',
        color: 'white',
        fontWeight: '500',
        zIndex: '9999',
        animation: 'slideIn 0.3s ease-out',
        maxWidth: '400px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
    });
    
    const colors = {
        'success': '#10b981',
        'error': '#ef4444',
        'warning': '#f59e0b',
        'info': '#2563eb'
    };
    notification.style.background = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Auto-refresh dashboard
setInterval(() => {
    const overviewPage = document.getElementById('overview-page');
    if (overviewPage && !overviewPage.classList.contains('hidden') && appState.isAuthenticated) {
        updateStats();
    }
}, 30000);
