const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const moment = require('moment');
const crypto = require('crypto');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ===== ENVIRONMENT VALIDATION =====
console.log('🔧 Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- PORT:', PORT);
console.log('- EMAIL_ENABLED:', process.env.EMAIL_ENABLED);
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('- RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing');

// Initialize Resend only if enabled and key exists
let resend = null;
let Resend = null;

if (process.env.EMAIL_ENABLED === 'true') {
    if (!process.env.RESEND_API_KEY) {
        console.warn('⚠️  EMAIL_ENABLED is true but RESEND_API_KEY is missing. Running in demo mode.');
    } else {
        try {
            Resend = require('resend').Resend;
            resend = new Resend(process.env.RESEND_API_KEY);
            console.log('✅ Resend initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Resend:', error.message);
            console.log('📧 Falling back to demo mode');
        }
    }
} else {
    console.log('📧 Email sending disabled (demo mode)');
}

// ===== CORS CONFIGURATION =====
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
    'https://ledge-marketing-frontend.onrender.com',
    'https://whop.com',
    'https://app.whop.com'
].filter(Boolean);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            console.warn('⚠️  CORS blocked origin:', origin);
            callback(null, true); // Allow in production for Whop iframe
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'whop-signature']
}));

app.use(express.json());

// Handle preflight requests
app.options('*', cors());

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
        whop_plan_id: process.env.WHOP_PLAN_ID_STARTER || 'plan_starter',
    },
    'growth': {
        name: 'Growth Plan',
        price: 19,
        contact_limit: 250,
        marketing_emails: { monthly: 750, daily: 25 },
        transactional_emails: { monthly: 500, daily: 16, enabled: true },
        analytics_enabled: false,
        whop_plan_id: process.env.WHOP_PLAN_ID_GROWTH || 'plan_growth',
    },
    'pro': {
        name: 'Pro Plan',
        price: 40,
        contact_limit: 400,
        marketing_emails: { monthly: 1200, daily: 40 },
        transactional_emails: { monthly: 1000, daily: 33, enabled: true },
        analytics_enabled: true,
        whop_plan_id: process.env.WHOP_PLAN_ID_PRO || 'plan_pro',
    },
};

// ===== IN-MEMORY DATABASE =====
const usersDB = {};

const getUser = async (whopUserId) => {
    if (!whopUserId) {
        console.warn('⚠️  getUser called with empty whopUserId');
        return null;
    }

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
    if (!whopUserId) {
        console.warn('⚠️  updateUser called with empty whopUserId');
        return null;
    }

    const existing = await getUser(whopUserId);
    usersDB[whopUserId] = { ...existing, ...data, whopUserId };
    console.log(`[DB] Updated user ${whopUserId}:`, Object.keys(data).join(', '));
    return usersDB[whopUserId];
};

// ===== USAGE RESET LOGIC =====
const checkAndResetUsage = (user) => {
    if (!user) return { updated: false, updates: {} };

    const now = moment.utc();
    let updated = false;
    const updates = {};

    try {
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
    } catch (error) {
        console.error('❌ Error in checkAndResetUsage:', error.message);
    }

    return { updated, updates };
};

// ===== HELPER: Get plan from Whop Plan ID =====
const getPlanFromWhopId = (whopPlanId) => {
    if (!whopPlanId) return 'free';
    return Object.keys(PLANS).find(key => PLANS[key].whop_plan_id === whopPlanId) || 'free';
};

// ===== API ROUTES =====

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Ledge Marketing API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            api_health: '/api/health',
            verify_user: '/api/user/:whopUserId/verify',
            send_email: '/api/send-email',
            analytics: '/api/analytics',
            update_user: '/api/user/update',
            webhook: '/api/webhooks/whop'
        }
    });
});

// 1. Verify user and get usage data
app.get('/api/user/:whopUserId/verify', async (req, res) => {
    const { whopUserId } = req.params;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Valid user ID required' 
        });
    }

    try {
        let user = await getUser(whopUserId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
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
        console.error('❌ Verify user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 2. Send email with plan enforcement
app.post('/api/send-email', async (req, res) => {
    const { whopUserId, campaignName, subject, html, to, type } = req.body;
    const emailType = type === 'transactional' ? 'transactional' : 'marketing';
    const recipients = Array.isArray(to) ? to : [to];
    const emailCount = recipients.length;

    // Validation
    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Valid user ID required' 
        });
    }

    if (!campaignName || !subject || !html || !recipients.length || !type) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: campaignName, subject, html, to, type' 
        });
    }

    try {
        let user = await getUser(whopUserId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
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
        
        if (resend) {
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
                console.error('❌ Resend error:', emailError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send email through Resend',
                    error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
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
        console.error('❌ Send email error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error sending email',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 3. Get analytics (Pro plan only)
app.get('/api/analytics', async (req, res) => {
    const { whopUserId } = req.query;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Valid user ID required' 
        });
    }

    try {
        const user = await getUser(whopUserId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const plan = PLANS[user.plan] || PLANS.free;

        // Check if user has analytics access
        if (!plan.analytics_enabled) {
            return res.status(403).json({
                success: false,
                message: 'Analytics requires Pro plan'
            });
        }

        // Demo analytics data
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
        console.error('❌ Analytics error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 4. Update user profile
app.post('/api/user/update', async (req, res) => {
    const { whopUserId, email, name } = req.body;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Valid user ID required' 
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
        console.error('❌ Update user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error updating profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
            console.warn('⚠️  Webhook received without signature');
            return res.status(401).json({ 
                success: false, 
                message: 'Missing signature' 
            });
        }

        try {
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(body);
            const calculatedSignature = hmac.digest('hex');

            if (calculatedSignature !== signature) {
                console.warn('⚠️  Invalid webhook signature');
                return res.status(403).json({ 
                    success: false, 
                    message: 'Invalid signature' 
                });
            }
        } catch (error) {
            console.error('❌ Signature verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Signature verification failed'
            });
        }
    }

    let event;
    try {
        event = JSON.parse(body);
    } catch (error) {
        console.error('❌ Invalid webhook JSON:', error);
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid JSON' 
        });
    }

    console.log(`📩 Whop webhook received: ${event.type}`);

    try {
        const { type, data } = event;

        if (!data || !data.user_id) {
            console.warn('⚠️  Webhook missing user_id');
            return res.status(400).json({
                success: false,
                message: 'Missing user_id in webhook data'
            });
        }

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
                    plan: 'free'
                });
                console.log(`⚠️  User ${deactivatedUserId} downgraded to free`);
                break;

            case 'payment.succeeded':
                console.log(`💰 Payment succeeded for user: ${data.user_id}`);
                break;

            case 'payment.failed':
                console.warn(`❌ Payment failed for user: ${data.user_id}`);
                break;

            default:
                console.log(`ℹ️  Unhandled webhook type: ${type}`);
        }

        res.json({ 
            success: true, 
            message: 'Webhook processed' 
        });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        // Still return 200 so Whop doesn't retry
        res.json({ 
            success: false, 
            message: 'Webhook processing failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Ledge Marketing API',
        environment: process.env.NODE_ENV || 'development',
        emailEnabled: !!resend,
        port: PORT,
        corsOrigins: allowedOrigins
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        api: 'running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'API endpoint not found',
        path: req.path
    });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ===== START SERVER =====
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 Ledge Marketing Backend Started');
    console.log('═══════════════════════════════════════════════');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✉️  Email: ${resend ? '✓ Enabled' : '✗ Demo mode'}`);
    console.log(`📊 Plans configured: ${Object.keys(PLANS).length}`);
    console.log(`🌐 CORS origins: ${allowedOrigins.length}`);
    console.log(`🏥 Health check: /health`);
    console.log('═══════════════════════════════════════════════');
    console.log('');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📴 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});
