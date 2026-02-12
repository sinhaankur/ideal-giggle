// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// Navigation
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializePredictionForm();
    initializeModelStatus();
    loadDashboardData();
});

// Navigation between pages
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding page
            const pageName = item.dataset.page;
            showPage(pageName);
        });
    });
}

function showPage(pageName) {
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => {
        page.classList.add('hidden');
    });
    
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Load page-specific data
    if (pageName === 'models') {
        loadModelStatus();
    }
}

// Load Dashboard Data
async function loadDashboardData() {
    try {
        // Simulate loading dashboard stats
        // In production, these would come from your API
        updateStats();
        
        // Try to load model status
        await loadModelStatus();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

function updateStats() {
    // Simulated data - replace with actual API calls
    const stats = {
        energy: '1,234 kWh',
        occupancy: '78%',
        temperature: '22.5°C',
        alerts: '3'
    };
    
    document.getElementById('energy-value').textContent = stats.energy;
    document.getElementById('occupancy-value').textContent = stats.occupancy;
    document.getElementById('temp-value').textContent = stats.temperature;
    document.getElementById('alerts-value').textContent = stats.alerts;
}

// Prediction Form
function initializePredictionForm() {
    const form = document.getElementById('prediction-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
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
    try {
        showNotification('Generating prediction...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        displayPredictionResult(result);
        showNotification('Prediction generated successfully!', 'success');
    } catch (error) {
        console.error('Prediction error:', error);
        showNotification('Error generating prediction. Make sure the API is running.', 'error');
        
        // Show mock result for demo purposes
        displayPredictionResult({
            prediction: 'Mock prediction: Energy consumption expected to be 145 kWh for the specified conditions.',
            confidence: 0.87,
            factors: ['Temperature', 'Occupancy', 'Time of Day']
        });
    }
}

function displayPredictionResult(result) {
    const resultDiv = document.getElementById('prediction-result');
    const outputDiv = document.getElementById('prediction-output');
    
    let html = `<p><strong>Prediction:</strong> ${result.prediction || result}</p>`;
    
    if (result.confidence) {
        html += `<p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(1)}%</p>`;
    }
    
    if (result.factors) {
        html += `<p><strong>Key Factors:</strong> ${result.factors.join(', ')}</p>`;
    }
    
    outputDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
}

// Model Status
function initializeModelStatus() {
    const refreshButton = document.getElementById('refresh-models');
    
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            loadModelStatus();
        });
    }
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
        showNotification('Model status loaded successfully!', 'success');
    } catch (error) {
        console.error('Model status error:', error);
        showNotification('Error loading model status. Showing demo data.', 'warning');
        
        // Show mock status for demo purposes
        displayModelStatus({
            building_model: {
                status: 'active',
                accuracy: 0.92,
                last_updated: new Date().toISOString()
            },
            energy_model: {
                status: 'active',
                accuracy: 0.88,
                last_updated: new Date().toISOString()
            }
        });
    }
}

function displayModelStatus(status) {
    // Update Building Model
    if (status.building_model) {
        const buildingCard = document.getElementById('model-building');
        updateModelCard(buildingCard, status.building_model);
    }
    
    // Update Energy Model
    if (status.energy_model) {
        const energyCard = document.getElementById('model-energy');
        updateModelCard(energyCard, status.energy_model);
    }
}

function updateModelCard(card, data) {
    const statusBadge = card.querySelector('.status-badge');
    const accuracy = card.querySelector('.accuracy');
    const lastUpdated = card.querySelector('.last-updated');
    
    // Update status badge
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
    
    // Update accuracy
    if (data.accuracy) {
        accuracy.textContent = `${(data.accuracy * 100).toFixed(1)}%`;
    }
    
    // Update last updated
    if (data.last_updated) {
        const date = new Date(data.last_updated);
        lastUpdated.textContent = date.toLocaleString();
    }
}

// Notification System
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
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
    
    // Set background color based on type
    const colors = {
        'success': '#10b981',
        'error': '#ef4444',
        'warning': '#f59e0b',
        'info': '#2563eb'
    };
    notification.style.background = colors[type] || colors.info;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            document.body.removeChild(notification);
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

// Auto-refresh dashboard every 30 seconds
setInterval(() => {
    if (!document.getElementById('overview-page').classList.contains('hidden')) {
        updateStats();
    }
}, 30000);
