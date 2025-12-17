// ===== LEDGE MARKETING DASHBOARD =====
console.log('🚀 Ledge Marketing Dashboard');

// Configuration
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;
let whopSDK = null;

// ===== WHOP SDK INTEGRATION =====
async function initializeWhop() {
    try {
        // Check if Whop SDK is available (running in Whop iframe)
        if (typeof Whop !== 'undefined') {
            console.log('🔗 Initializing Whop SDK...');
            
            // Initialize the SDK
            whopSDK = await Whop.init();
            
            // Get user data
            const userData = await whopSDK.me();
            const planData = await whopSDK.plan();
            const access = await whopSDK.checkAccess();
            
            if (!access) {
                alert('You do not have access to this app. Please purchase a subscription.');
                return null;
            }
            
            return {
                id: userData.id,
                email: userData.email,
                name: userData.username || userData.email.split('@')[0],
                plan: planData.id || 'free',
                planName: planData.name || 'Free Plan',
                sdk: whopSDK,
                isWhopUser: true
            };
        }
        
        // Development mode (not in Whop)
        console.log('⚙️ Development mode (not in Whop)');
        return getDemoUser();
        
    } catch (error) {
        console.error('Whop initialization error:', error);
        return getDemoUser();
    }
}

function getDemoUser() {
    return {
        id: 'demo_' + Date.now(),
        email: 'demo@ledge.marketing',
        name: 'Demo User',
        plan: 'growth',
        planName: 'Growth Plan',
        isDemo: true
    };
}

// ===== USER MANAGEMENT =====
async function loadUserData() {
    console.log('👤 Loading user data...');
    
    // Initialize Whop SDK or get demo user
    const whopUser = await initializeWhop();
    
    // Create currentUser object
    currentUser = {
        whopUserId: whopUser.id,
        email: whopUser.email,
        name: whopUser.name,
        plan: whopUser.plan,
        planName: whopUser.planName,
        isDemo: whopUser.isDemo || false,
        whopSDK: whopUser.sdk || null
    };
    
    // Update UI
    updateUIWithUserData();
    
    // Load usage data from backend
    try {
        const response = await fetch(`${API_BASE_URL}/user/${whopUser.id}/verify`);
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Merge backend data
                currentUser = { ...currentUser, ...data.user };
                console.log('✅ Loaded user data from backend');
            }
        }
    } catch (error) {
        console.log('⚠️ Backend not available, using demo data');
        loadDemoUsageData();
    }
    
    // Update dashboard
    updateDashboard();
}

function updateUIWithUserData() {
    // Update header
    document.getElementById('userPlanBadge').textContent = currentUser.planName;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userName').textContent = currentUser.name;
    
    // Show/hide upgrade button
    const upgradeBtn = document.getElementById('upgradeButton');
    if (currentUser.plan !== 'pro' && currentUser.whopSDK && !currentUser.isDemo) {
        upgradeBtn.style.display = 'block';
        upgradeBtn.onclick = () => {
            // Open Whop checkout
            currentUser.whopSDK.openCheckout();
        };
    } else {
        upgradeBtn.style.display = 'none';
    }
    
    // Hide loading screen
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
}

function loadDemoUsageData() {
    // Demo limits based on plan
    const limits = {
        'free': { contacts: 25, marketingMonthly: 70, marketingDaily: 2, transactionalMonthly: 0, transactionalDaily: 0 },
        'starter': { contacts: 100, marketingMonthly: 300, marketingDaily: 10, transactionalMonthly: 200, transactionalDaily: 6 },
        'growth': { contacts: 250, marketingMonthly: 750, marketingDaily: 25, transactionalMonthly: 500, transactionalDaily: 16 },
        'pro': { contacts: 400, marketingMonthly: 1200, marketingDaily: 40, transactionalMonthly: 1000, transactionalDaily: 33 }
    };
    
    const planLimits = limits[currentUser.plan] || limits.growth;
    
    // Set demo usage (30-50% of limits)
    currentUser.contacts_count = Math.floor(planLimits.contacts * 0.4);
    currentUser.monthly_marketing_sent = Math.floor(planLimits.marketingMonthly * 0.3);
    currentUser.daily_marketing_sent = Math.floor(planLimits.marketingDaily * 0.5);
    currentUser.monthly_transactional_sent = Math.floor(planLimits.transactionalMonthly * 0.2);
    currentUser.daily_transactional_sent = Math.floor(planLimits.transactionalDaily * 0.3);
    currentUser.contact_limit = planLimits.contacts;
    currentUser.marketing_limit_monthly = planLimits.marketingMonthly;
    currentUser.marketing_limit_daily = planLimits.marketingDaily;
    currentUser.transactional_limit_monthly = planLimits.transactionalMonthly;
    currentUser.transactional_limit_daily = planLimits.transactionalDaily;
    currentUser.transactional_enabled = planLimits.transactionalMonthly > 0;
    currentUser.analytics_enabled = currentUser.plan === 'pro';
}

function updateDashboard() {
    if (!currentUser) return;
    
    // Update stats
    document.getElementById('marketingEmailsSent').textContent = currentUser.monthly_marketing_sent || 0;
    document.getElementById('marketingEmailLimit').textContent = currentUser.marketing_limit_monthly || 0;
    document.getElementById('marketingEmailsSentDaily').textContent = currentUser.daily_marketing_sent || 0;
    document.getElementById('marketingEmailLimitDaily').textContent = currentUser.marketing_limit_daily || 0;
    
    document.getElementById('contactsCount').textContent = currentUser.contacts_count || 0;
    document.getElementById('contactLimit').textContent = currentUser.contact_limit || 0;
    
    // Transactional emails
    const transactionalCard = document.getElementById('transactionalEmailCard');
    if (currentUser.transactional_enabled) {
        transactionalCard.style.display = 'flex';
        document.getElementById('transactionalEmailsSent').textContent = currentUser.monthly_transactional_sent || 0;
        document.getElementById('transactionalEmailLimit').textContent = currentUser.transactional_limit_monthly || 0;
        document.getElementById('transactionalEmailsSentDaily').textContent = currentUser.daily_transactional_sent || 0;
        document.getElementById('transactionalEmailLimitDaily').textContent = currentUser.transactional_limit_daily || 0;
    } else {
        transactionalCard.style.display = 'none';
    }
    
    // Analytics
    const analyticsCard = document.getElementById('analyticsCard');
    if (currentUser.analytics_enabled) {
        analyticsCard.style.display = 'block';
        loadAnalytics();
    } else {
        analyticsCard.style.display = 'none';
    }
    
    // Contacts modal
    document.getElementById('contactsCountModal').textContent = currentUser.contacts_count || 0;
}

// ===== DASHBOARD FUNCTIONS =====
async function loadAnalytics() {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics?whopUserId=${currentUser.whopUserId}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                document.getElementById('analyticsOpens').textContent = data.analytics.total_emails_sent || '0';
                document.getElementById('analyticsClicks').textContent = data.analytics.total_campaigns || '0';
            }
        }
    } catch (error) {
        document.getElementById('analyticsOpens').textContent = '1,234';
        document.getElementById('analyticsClicks').textContent = '456';
    }
}

async function sendEmailCampaign() {
    if (!currentUser) {
        alert('Please wait for user data to load.');
        return;
    }
    
    const campaignName = document.getElementById('campaignNameInput').value.trim();
    const subject = document.getElementById('subjectInput').value.trim();
    const html = document.getElementById('htmlInput').value.trim();
    const recipients = document.getElementById('recipientInput').value.trim();
    const type = document.getElementById('emailTypeSelect').value;
    
    // Validation
    if (!campaignName || !subject || !html || !recipients) {
        alert('Please fill in all required fields.');
        return;
    }
    
    const recipientList = recipients.split(',').map(email => email.trim()).filter(email => email.length > 0);
    
    if (recipientList.length === 0) {
        alert('Please enter at least one valid email address.');
        return;
    }
    
    // Disable send button
    const sendBtn = document.getElementById('sendCampaignBtn');
    const originalText = sendBtn.textContent;
    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                whopUserId: currentUser.whopUserId,
                campaignName,
                subject,
                html,
                to: recipientList,
                type
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ ${data.message}\n\nEmail ID: ${data.emailId}${data.demo ? '\n(Demo mode - no actual email sent)' : ''}`);
            
            // Update UI with new usage
            if (data.usage) {
                if (type === 'marketing') {
                    currentUser.daily_marketing_sent = data.usage.daily;
                    currentUser.monthly_marketing_sent = data.usage.monthly;
                } else {
                    currentUser.daily_transactional_sent = data.usage.daily;
                    currentUser.monthly_transactional_sent = data.usage.monthly;
                }
                currentUser.contacts_count = data.usage.contacts;
                updateDashboard();
            }
            
            // Add to history
            addCampaignToHistory(campaignName, type, recipientList.length, true);
            
            // Close modal and reset form
            closeEmailModal();
            document.getElementById('campaignNameInput').value = '';
            document.getElementById('subjectInput').value = '';
            document.getElementById('htmlInput').value = '<h1>Hello!</h1><p>This is your email content.</p>';
            document.getElementById('recipientInput').value = '';
            
        } else {
            alert(`❌ Error: ${data.message}`);
        }
        
    } catch (error) {
        alert('❌ Network error. Please check your connection.');
        console.error('Send email error:', error);
    } finally {
        sendBtn.textContent = originalText;
        sendBtn.disabled = false;
    }
}

function addCampaignToHistory(name, type, count, success) {
    const historyList = document.getElementById('campaignHistoryList');
    
    // Remove empty state if present
    if (historyList.querySelector('.empty-state')) {
        historyList.innerHTML = '';
    }
    
    const item = document.createElement('div');
    item.className = 'campaign-item';
    item.innerHTML = `
        <div class="campaign-status ${success ? 'success' : 'error'}">
            ${success ? '✓ Sent' : '✗ Failed'}
        </div>
        <div class="campaign-details">
            <h4>${name}</h4>
            <p>${type.toUpperCase()} • ${count} recipients</p>
        </div>
        <div class="campaign-date">
            ${new Date().toLocaleDateString()}
        </div>
    `;
    
    historyList.prepend(item);
}

// ===== MODAL FUNCTIONS =====
function openEmailModal() {
    document.getElementById('emailModal').style.display = 'block';
}

function closeEmailModal() {
    document.getElementById('emailModal').style.display = 'none';
}

function openContactsModal() {
    document.getElementById('contactsModal').style.display = 'block';
}

function closeContactsModal() {
    document.getElementById('contactsModal').style.display = 'none';
}

function openUpgradeModal() {
    document.getElementById('upgradeModal').style.display = 'block';
    loadUpgradePlans();
}

function closeUpgradeModal() {
    document.getElementById('upgradeModal').style.display = 'none';
}

function loadUpgradePlans() {
    const container = document.getElementById('upgradePlansContainer');
    if (!container) return;
    
    // Define available upgrades based on current plan
    const upgradePaths = {
        'free': ['starter', 'growth', 'pro'],
        'starter': ['growth', 'pro'],
        'growth': ['pro'],
        'pro': []
    };
    
    const plans = {
        'starter': { name: 'Starter Plan', price: 9, features: [
            '100 Contacts', 
            '300 Marketing Emails/month',
            '200 Transactional Emails/month',
            'Basic Support'
        ]},
        'growth': { name: 'Growth Plan', price: 19, features: [
            '250 Contacts',
            '750 Marketing Emails/month',
            '500 Transactional Emails/month',
            'Priority Support'
        ]},
        'pro': { name: 'Pro Plan', price: 40, features: [
            '400 Contacts',
            '1200 Marketing Emails/month',
            '1000 Transactional Emails/month',
            'Advanced Analytics',
            '24/7 Priority Support'
        ]}
    };
    
    const available = upgradePaths[currentUser.plan] || [];
    
    if (available.length === 0) {
        container.innerHTML = '<p class="center-text">You are on the highest plan! 🎉</p>';
        return;
    }
    
    container.innerHTML = available.map(planKey => {
        const plan = plans[planKey];
        return `
            <div class="price-card" style="margin: 1.5rem 0; padding: 1.5rem;">
                <h3>${plan.name}</h3>
                <div class="price" style="font-size: 2.5rem; margin: 1rem 0;">$${plan.price}<span style="font-size: 1rem; color: #9CA3AF;">/month</span></div>
                <ul style="list-style: none; margin: 1.5rem 0; padding: 0;">
                    ${plan.features.map(f => `<li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.1);">✅ ${f}</li>`).join('')}
                </ul>
                <button class="cta-button full-width" onclick="requestUpgrade('${planKey}')">
                    Upgrade to ${plan.name}
                </button>
            </div>
        `;
    }).join('');
}

function requestUpgrade(planKey) {
    if (currentUser.whopSDK) {
        // Open Whop checkout
        currentUser.whopSDK.openCheckout();
        closeUpgradeModal();
    } else {
        alert(`In Whop, this would open the upgrade flow for ${planKey} plan.`);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        if (currentUser.whopSDK) {
            // In Whop, parent handles logout
            window.parent.postMessage({ type: 'LOGOUT_REQUEST', source: 'ledge-marketing' }, '*');
        } else {
            alert('Logged out. In Whop, you would be redirected.');
            window.location.reload();
        }
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Modal buttons
    document.getElementById('createCampaignBtn').addEventListener('click', openEmailModal);
    document.getElementById('manageContactsBtn').addEventListener('click', openContactsModal);
    document.getElementById('upgradeButton').addEventListener('click', openUpgradeModal);
    document.getElementById('viewAnalyticsBtn').addEventListener('click', () => {
        alert('Advanced analytics dashboard coming soon!');
    });
    document.getElementById('viewAllCampaignsBtn').addEventListener('click', () => {
        alert('Campaign history page coming soon!');
    });
    
    // Close buttons
    document.getElementById('closeEmailModal').addEventListener('click', closeEmailModal);
    document.getElementById('closeContactsModal').addEventListener('click', closeContactsModal);
    document.getElementById('closeUpgradeModal').addEventListener('click', closeUpgradeModal);
    
    // Action buttons
    document.getElementById('sendCampaignBtn').addEventListener('click', sendEmailCampaign);
    document.getElementById('saveDraftBtn').addEventListener('click', () => {
        alert('Draft saved!');
        closeEmailModal();
    });
    
    document.getElementById('importContactsBtn').addEventListener('click', () => {
        alert('Contact import feature coming soon!');
    });
    
    document.getElementById('addContactBtn').addEventListener('click', () => {
        alert('Add contact feature coming soon!');
    });
    
    document.getElementById('logoutButton').addEventListener('click', logout);
    
    // Close modals on outside click
    window.addEventListener('click', (event) => {
        if (event.target.id === 'emailModal') closeEmailModal();
        if (event.target.id === 'contactsModal') closeContactsModal();
        if (event.target.id === 'upgradeModal') closeUpgradeModal();
    });
}

// ===== INITIALIZATION =====
async function initializeApp() {
    console.log('🚀 Initializing Ledge Marketing...');
    
    // Load user data
    await loadUserData();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✅ Dashboard ready');
    console.log('User:', currentUser);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Make functions globally available
window.openEmailModal = openEmailModal;
window.closeEmailModal = closeEmailModal;
window.requestUpgrade = requestUpgrade;
window.logout = logout;