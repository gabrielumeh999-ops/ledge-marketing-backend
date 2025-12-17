const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Resend } = require('resend');
const moment = require('moment');
const crypto = require('crypto');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ===== CRITICAL: Serve built frontend files =====
const frontendPath = path.join(__dirname, '../dist');
app.use(express.static(frontendPath));

// Initialize Resend (if enabled)
const resend = process.env.EMAIL_ENABLED === 'true' ? new Resend(process.env.RESEND_API_KEY) : null;

// ===== PLANS CONFIGURATION (SOURCE OF TRUTH) =====
const PLANS = {
    'free': {
        name: 'Free Plan',
        price: 0,
        contact_limit: 25,
        marketing_emails: { monthly: 70, daily: 2 },
        transactional_emails: { monthly: 0, daily: 0, enabled: false },
        analytics_enabled: false,
        whop_plan_id: process.env.WHOP_PLAN_ID_FREE || 'FREE',
    },
    'starter': {
        name: 'Starter Plan',
        price: 9,
        contact_limit: 100,
        marketing_emails: { monthly: 300, daily: 10 },
        transactional_emails: { monthly: 200, daily: 6, enabled: true },
        analytics_enabled: false,
        whop_plan_id: process.env.WHOP_PLAN_ID_STARTER || 'https://whop.com/checkout/plan_S5f00AqapCeD7', // ← REPLACE
    },
    'growth': {
        name: 'Growth Plan',
        price: 19,
        contact_limit: 250,
        marketing_emails: { monthly: 750, daily: 25 },
        transactional_emails: { monthly: 500, daily: 16, enabled: true },
        analytics_enabled: false,
        whop_plan_id: process.env.WHOP_PLAN_ID_GROWTH || 'https://whop.com/checkout/plan_ENJBoGj2az1Ip', // ← REPLACE
    },
    'pro': {
        name: 'Pro Plan',
        price: 40,
        contact_limit: 400,
        marketing_emails: { monthly: 1200, daily: 40 },
        transactional_emails: { monthly: 1000, daily: 33, enabled: true },
        analytics_enabled: true,
        whop_plan_id: process.env.WHOP_PLAN_ID_PRO || 'https://whop.com/checkout/plan_j0MoNy7XTp7Nm', // ← REPLACE
    },
};

// ===== IN-MEMORY DATABASE (Replace with PostgreSQL later) =====
const usersDB = {};

const getUser = async (whopUserId) => {
    const defaultUser = {
        plan: 'free',
        contacts_count: 0,
        daily_marketing_sent: 0,
        monthly_marketing_sent: 0,
        daily_transactional_sent: 0,
        monthly_transactional_sent: 0,
        last_daily_reset: moment.utc().format('YYYY-MM-DD'),
        last_monthly_reset: moment.utc().format('YYYY-MM'),
        email: '',
        name: ''
    };
    return usersDB[whopUserId] || { ...defaultUser };
};

const updateUser = async (whopUserId, data) => {
    const existing = await getUser(whopUserId);
    usersDB[whopUserId] = { ...existing, ...data, whopUserId };
    console.log(`[DB] Updated user ${whopUserId}:`, data);
    return usersDB[whopUserId];
};

// ===== USAGE RESET LOGIC =====
const checkAndResetUsage = (user) => {
    const now = moment.utc();
    let updated = false;
    const updates = {};

    // Daily reset (00:00 UTC)
    const lastDaily = moment.utc(user.last_daily_reset, 'YYYY-MM-DD');
    if (now.isAfter(lastDaily, 'day')) {
        updates.daily_marketing_sent = 0;
        updates.daily_transactional_sent = 0;
        updates.last_daily_reset = now.format('YYYY-MM-DD');
        updated = true;
    }

    // Monthly reset (1st of month)
    const lastMonthly = moment.utc(user.last_monthly_reset, 'YYYY-MM');
    if (now.isAfter(lastMonthly, 'month')) {
        updates.monthly_marketing_sent = 0;
        updates.monthly_transactional_sent = 0;
        updates.last_monthly_reset = now.format('YYYY-MM');
        updated = true;
    }

    return { updated, updates };
};

// ===== HELPER: Get plan from Whop Plan ID =====
const getPlanFromWhopId = (whopPlanId) => {
    return Object.keys(PLANS).find(key => PLANS[key].whop_plan_id === whopPlanId) || 'free';
};

// ===== API ROUTES (UNCHANGED FROM YOUR ORIGINAL) =====

// 1. Verify user and get usage data
app.get('/api/user/:whopUserId/verify', async (req, res) => {
    const { whopUserId } = req.params;

    try {
        let user = await getUser(whopUserId);
        
        // Apply resets if needed
        const { updated, updates } = checkAndResetUsage(user);
        if (updated) {
            user = await updateUser(whopUserId, updates);
        }

        const plan = PLANS[user.plan] || PLANS.free;

        const response = {
            success: true,
            user: {
                whopUserId,
                plan: user.plan,
                planName: plan.name,
                email: user.email || '',
                name: user.name || '',
                
                // Usage
                contacts_count: user.contacts_count || 0,
                daily_marketing_sent: user.daily_marketing_sent || 0,
                monthly_marketing_sent: user.monthly_marketing_sent || 0,
                daily_transactional_sent: user.daily_transactional_sent || 0,
                monthly_transactional_sent: user.monthly_transactional_sent || 0,
                
                // Limits
                contact_limit: plan.contact_limit,
                marketing_limit_monthly: plan.marketing_emails.monthly,
                marketing_limit_daily: plan.marketing_emails.daily,
                transactional_limit_monthly: plan.transactional_emails.monthly,
                transactional_limit_daily: plan.transactional_emails.daily,
                transactional_enabled: plan.transactional_emails.enabled,
                analytics_enabled: plan.analytics_enabled
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Verify user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// 2. Send email with plan enforcement
app.post('/api/send-email', async (req, res) => {
    const { whopUserId, campaignName, subject, html, to, type } = req.body;
    const emailType = type === 'transactional' ? 'transactional' : 'marketing';
    const recipients = Array.isArray(to) ? to : [to];
    const emailCount = recipients.length;

    // Validation
    if (!whopUserId || !campaignName || !subject || !html || !recipients.length || !type) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields' 
        });
    }

    try {
        let user = await getUser(whopUserId);
        
        // Apply resets
        const { updated, updates } = checkAndResetUsage(user);
        if (updated) {
            user = await updateUser(whopUserId, updates);
        }

        const plan = PLANS[user.plan] || PLANS.free;

        // ===== ENFORCE PLAN LIMITS =====
        
        // 1. Contact limit
        if (user.contacts_count + emailCount > plan.contact_limit) {
            return res.status(403).json({
                success: false,
                message: `Contact limit exceeded. You have ${user.contacts_count}/${plan.contact_limit} contacts.`
            });
        }

        // 2. Transactional access check
        if (emailType === 'transactional' && !plan.transactional_emails.enabled) {
            return res.status(403).json({
                success: false,
                message: 'Transactional emails not available on your plan.'
            });
        }

        // 3. Daily limit check
        const dailyKey = `daily_${emailType}_sent`;
        const dailyLimit = plan[`${emailType}_emails`].daily;
        if (user[dailyKey] + emailCount > dailyLimit) {
            return res.status(403).json({
                success: false,
                message: `Daily ${emailType} email limit exceeded: ${user[dailyKey]}/${dailyLimit}`
            });
        }

        // 4. Monthly limit check
        const monthlyKey = `monthly_${emailType}_sent`;
        const monthlyLimit = plan[`${emailType}_emails`].monthly;
        if (user[monthlyKey] + emailCount > monthlyLimit) {
            return res.status(403).json({
                success: false,
                message: `Monthly ${emailType} email limit exceeded: ${user[monthlyKey]}/${monthlyLimit}`
            });
        }

        // ===== SEND EMAIL =====
        let sendResult = null;
        
        if (process.env.EMAIL_ENABLED === 'true' && resend) {
            try {
                sendResult = await resend.emails.send({
                    from: 'Ledge Marketing <no-reply@send.ledgemarketing.xyz>',
                    to: recipients,
                    subject: subject,
                    html: html,
                    tags: [
                        { name: 'campaign', value: campaignName },
                        { name: 'plan', value: user.plan },
                        { name: 'type', value: emailType }
                    ]
                });
                console.log(`✅ Email sent via Resend: ${sendResult.id}`);
            } catch (emailError) {
                console.error('Resend error:', emailError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send email through Resend',
                    error: emailError.message
                });
            }
        } else {
            // Demo mode
            console.log(`[DEMO] Would send ${emailType} email to ${emailCount} recipients`);
            sendResult = { id: 'demo_' + Date.now(), demo: true };
        }

        // ===== UPDATE USAGE =====
        const usageUpdates = {
            [dailyKey]: (user[dailyKey] || 0) + emailCount,
            [monthlyKey]: (user[monthlyKey] || 0) + emailCount,
            contacts_count: (user.contacts_count || 0) + emailCount
        };

        await updateUser(whopUserId, usageUpdates);

        // ===== RESPONSE =====
        res.json({
            success: true,
            message: `Email sent to ${emailCount} recipient(s)`,
            emailId: sendResult.id,
            demo: !resend,
            usage: {
                daily: usageUpdates[dailyKey],
                monthly: usageUpdates[monthlyKey],
                contacts: usageUpdates.contacts_count
            }
        });

    } catch (error) {
        console.error('Send email error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error sending email' 
        });
    }
});

// 3. Get analytics (Pro plan only)
app.get('/api/analytics', async (req, res) => {
    const { whopUserId } = req.query;

    if (!whopUserId) {
        return res.status(400).json({ 
            success: false, 
            message: 'User ID required' 
        });
    }

    try {
        const user = await getUser(whopUserId);
        const plan = PLANS[user.plan] || PLANS.free;

        // Check if user has analytics access
        if (!plan.analytics_enabled) {
            return res.status(403).json({
                success: false,
                message: 'Analytics requires Pro plan'
            });
        }

        // Demo analytics data (replace with real data later)
        const analytics = {
            total_campaigns: 12,
            total_emails_sent: user.monthly_marketing_sent + user.monthly_transactional_sent,
            open_rate: '24.5%',
            click_rate: '3.2%',
            top_performing: 'Welcome Series',
            recent_activity: [
                { date: '2024-01-15', action: 'Campaign sent', count: 150 },
                { date: '2024-01-10', action: 'Campaign sent', count: 89 },
                { date: '2024-01-05', action: 'Campaign sent', count: 203 }
            ]
        };

        res.json({
            success: true,
            analytics,
            plan: plan.name
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching analytics' 
        });
    }
});

// 4. Update user profile
app.post('/api/user/update', async (req, res) => {
    const { whopUserId, email, name } = req.body;

    if (!whopUserId) {
        return res.status(400).json({ 
            success: false, 
            message: 'User ID required' 
        });
    }

    try {
        const updates = {};
        if (email) updates.email = email;
        if (name) updates.name = name;

        await updateUser(whopUserId, updates);

        res.json({
            success: true,
            message: 'Profile updated'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error updating profile' 
        });
    }
});

// ===== WHOP WEBHOOK HANDLER =====
app.post('/api/webhooks/whop', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['whop-signature'];
    const body = req.body.toString('utf8');
    const secret = process.env.WHOP_WEBHOOK_SECRET;

    // Verify signature in production
    if (process.env.NODE_ENV === 'production' && secret) {
        if (!signature) {
            return res.status(401).json({ 
                success: false, 
                message: 'Missing signature' 
            });
        }

        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(body);
        const calculatedSignature = hmac.digest('hex');

        if (calculatedSignature !== signature) {
            console.warn('Invalid webhook signature');
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid signature' 
            });
        }
    }

    let event;
    try {
        event = JSON.parse(body);
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid JSON' 
        });
    }

    console.log(`📩 Whop webhook received: ${event.type}`);

    try {
        const { type, data } = event;

        switch (type) {
            case 'membership.activated':
            case 'invoice.paid':
                // User purchased or renewed
                const whopPlanId = data.plan_id;
                const planKey = getPlanFromWhopId(whopPlanId);
                const userId = data.user_id;

                await updateUser(userId, {
                    plan: planKey,
                    // Reset usage for new plan
                    daily_marketing_sent: 0,
                    monthly_marketing_sent: 0,
                    daily_transactional_sent: 0,
                    monthly_transactional_sent: 0,
                    contacts_count: 0,
                    last_daily_reset: moment.utc().format('YYYY-MM-DD'),
                    last_monthly_reset: moment.utc().format('YYYY-MM'),
                    email: data.user_email || '',
                    name: data.user_username || ''
                });

                console.log(`✅ User ${userId} activated plan: ${planKey}`);
                break;

            case 'membership.deactivated':
            case 'invoice.past_due':
                // User canceled or payment failed
                const deactivatedUserId = data.user_id;
                await updateUser(deactivatedUserId, { 
                    plan: 'free',
                    // Keep their data but restrict to free limits
                });
                console.log(`⚠️ User ${deactivatedUserId} downgraded to free`);
                break;

            case 'payment.succeeded':
                console.log(`💰 Payment succeeded for user: ${data.user_id}`);
                break;

            case 'payment.failed':
                console.warn(`❌ Payment failed for user: ${data.user_id}`);
                break;

            default:
                console.log(`ℹ️ Unhandled webhook type: ${type}`);
        }

        res.json({ 
            success: true, 
            message: 'Webhook processed' 
        });

    } catch (error) {
        console.error('Webhook processing error:', error);
        // Still return 200 so Whop doesn't retry
        res.json({ 
            success: false, 
            message: 'Webhook processing failed',
            error: error.message 
        });
    }
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Ledge Marketing API'
    });
});

// ===== CRITICAL: Serve frontend at all necessary routes =====
// This handles client-side routing for React
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        // API routes that don't exist return 404
        res.status(404).json({ success: false, message: 'API endpoint not found' });
    } else {
        // All non-API routes serve the React app
        res.sendFile(path.join(frontendPath, 'index.html'));
    }
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`🚀 Ledge Marketing backend running on port ${PORT}`);
    console.log(`📧 Dashboard: http://localhost:${PORT}`);
    console.log(`📁 Serving frontend from: ${frontendPath}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✉️ Email sending: ${process.env.EMAIL_ENABLED === 'true' ? 'ENABLED' : 'DISABLED (demo mode)'}`);
    console.log(`✅ App ready for Whop installation`);
});