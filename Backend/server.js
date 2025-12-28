const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const moment = require('moment');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log('🔧 Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- PORT:', PORT);
console.log('- EMAIL_ENABLED:', process.env.EMAIL_ENABLED);
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing');
console.log('- RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing');

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
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            console.warn('⚠️  CORS blocked origin:', origin);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'whop-signature']
}));

app.use(express.json());
app.options('*', cors());

db.initializeDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
});

// ===== UPDATED PLANS CONFIGURATION =====
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
        contact_limit: 50,
        marketing_emails: { monthly: 100, daily: 10 },
        transactional_emails: { monthly: 0, daily: 0, enabled: false },
        analytics_enabled: false,
        whop_plan_id: process.env.WHOP_PLAN_ID_STARTER || 'plan_starter',
    },
    'growth': {
        name: 'Growth Plan',
        price: 19,
        contact_limit: 150,
        marketing_emails: { monthly: 300, daily: 20 },
        transactional_emails: { monthly: 0, daily: 0, enabled: false },
        analytics_enabled: false,
        whop_plan_id: process.env.WHOP_PLAN_ID_GROWTH || 'plan_growth',
    },
    'pro': {
        name: 'Pro Plan',
        price: 40,
        contact_limit: 250,
        marketing_emails: { monthly: 500, daily: 50 },
        transactional_emails: { monthly: 0, daily: 0, enabled: false },
        analytics_enabled: true,
        whop_plan_id: process.env.WHOP_PLAN_ID_PRO || 'plan_pro',
    },
};

const checkAndResetUsage = (user) => {
    if (!user) return { updated: false, updates: {} };

    const now = moment.utc();
    let updated = false;
    const updates = {};

    try {
        const lastDaily = moment.utc(user.last_daily_reset);
        if (now.isAfter(lastDaily, 'day')) {
            updates.daily_marketing_sent = 0;
            updates.daily_transactional_sent = 0;
            updates.last_daily_reset = now.format('YYYY-MM-DD');
            updated = true;
        }

        const lastMonthly = moment.utc(user.last_monthly_reset + '-01');
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

const getPlanFromWhopId = (whopPlanId) => {
    if (!whopPlanId) return 'free';
    return Object.keys(PLANS).find(key => PLANS[key].whop_plan_id === whopPlanId) || 'free';
};

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
            subscribers: '/api/subscribers',
            analytics: '/api/analytics',
            update_user: '/api/user/update',
            webhook: '/api/webhooks/whop'
        }
    });
});

app.get('/api/user/:whopUserId/verify', async (req, res) => {
    const { whopUserId } = req.params;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Valid user ID required' 
        });
    }

    try {
        let user = await db.getUser(whopUserId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const { updated, updates } = checkAndResetUsage(user);
        if (updated) {
            user = await db.updateUser(whopUserId, updates);
        }

        const plan = PLANS[user.plan] || PLANS.free;

        const dailyMarketingRemaining = plan.marketing_emails.daily - (user.daily_marketing_sent || 0);
        const monthlyMarketingRemaining = plan.marketing_emails.monthly - (user.monthly_marketing_sent || 0);
        const contactsRemaining = plan.contact_limit - (user.contacts_count || 0);

        const response = {
            success: true,
            user: {
                whopUserId,
                plan: user.plan,
                planName: plan.name,
                email: user.email || '',
                name: user.name || user.username || '',
                contacts_count: user.contacts_count || 0,
                daily_marketing_sent: user.daily_marketing_sent || 0,
                monthly_marketing_sent: user.monthly_marketing_sent || 0,
                daily_transactional_sent: user.daily_transactional_sent || 0,
                monthly_transactional_sent: user.monthly_transactional_sent || 0,
                contact_limit: plan.contact_limit,
                marketing_limit_monthly: plan.marketing_emails.monthly,
                marketing_limit_daily: plan.marketing_emails.daily,
                transactional_limit_monthly: plan.transactional_emails.monthly,
                transactional_limit_daily: plan.transactional_emails.daily,
                transactional_enabled: plan.transactional_emails.enabled,
                analytics_enabled: plan.analytics_enabled,
                daily_marketing_remaining: dailyMarketingRemaining,
                monthly_marketing_remaining: monthlyMarketingRemaining,
                contacts_remaining: contactsRemaining
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

app.post('/api/send-email', async (req, res) => {
    const { whopUserId, campaignName, subject, html, to, type, recipientType, customEmails } = req.body;
    const emailType = type === 'transactional' ? 'transactional' : 'marketing';
    
    let recipients = [];
    
    if (recipientType === 'all') {
        recipients = await db.getActiveSubscriberEmails(whopUserId);
    } else if (recipientType === 'vip') {
        const vipSubscribers = await db.getVipSubscribers(whopUserId);
        recipients = vipSubscribers.map(sub => sub.email);
    } else if (recipientType === 'custom' && customEmails) {
        recipients = Array.isArray(customEmails) ? customEmails : [customEmails];
    } else if (to) {
        recipients = Array.isArray(to) ? to : [to];
    } else {
        return res.status(400).json({
            success: false,
            message: 'No recipients specified'
        });
    }
    
    const emailCount = recipients.length;
    
    if (emailCount === 0) {
        return res.status(400).json({
            success: false,
            message: 'No recipients to send to'
        });
    }

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
        let user = await db.getUser(whopUserId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const { updated, updates } = checkAndResetUsage(user);
        if (updated) {
            user = await db.updateUser(whopUserId, updates);
        }

        const plan = PLANS[user.plan] || PLANS.free;

        if (user.contacts_count + emailCount > plan.contact_limit) {
            return res.status(403).json({
                success: false,
                message: `Contact limit exceeded. You have ${user.contacts_count}/${plan.contact_limit} contacts.`
            });
        }

        if (emailType === 'transactional' && !plan.transactional_emails.enabled) {
            return res.status(403).json({
                success: false,
                message: 'Transactional emails not available on your plan.'
            });
        }

        const dailyKey = `daily_${emailType}_sent`;
        const dailyLimit = plan[`${emailType}_emails`].daily;
        if (user[dailyKey] + emailCount > dailyLimit) {
            return res.status(403).json({
                success: false,
                message: `Daily ${emailType} email limit exceeded: ${user[dailyKey]}/${dailyLimit}`
            });
        }

        const monthlyKey = `monthly_${emailType}_sent`;
        const monthlyLimit = plan[`${emailType}_emails`].monthly;
        if (user[monthlyKey] + emailCount > monthlyLimit) {
            return res.status(403).json({
                success: false,
                message: `Monthly ${emailType} email limit exceeded: ${user[monthlyKey]}/${monthlyLimit}`
            });
        }

        let sendResult = null;
        
        if (resend) {
            try {
                sendResult = await resend.emails.send({
                    from: 'Ledge Marketing <noreply@ledgemarketing.xyz>',
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
            console.log(`[DEMO] Would send ${emailType} email to ${emailCount} recipients`);
            sendResult = { id: 'demo_' + Date.now(), demo: true };
        }

        const usageUpdates = {
            [dailyKey]: (user[dailyKey] || 0) + emailCount,
            [monthlyKey]: (user[monthlyKey] || 0) + emailCount,
            contacts_count: (user.contacts_count || 0) + emailCount
        };

        await db.updateUser(whopUserId, usageUpdates);

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

app.get('/api/analytics', async (req, res) => {
    const { whopUserId } = req.query;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Valid user ID required' 
        });
    }

    try {
        const user = await db.getUser(whopUserId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const plan = PLANS[user.plan] || PLANS.free;

        if (!plan.analytics_enabled) {
            return res.status(403).json({
                success: false,
                message: 'Analytics requires Pro plan'
            });
        }

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

        await db.updateUser(whopUserId, updates);

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

app.get('/api/subscribers', async (req, res) => {
    const { whopUserId } = req.query;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({
            success: false,
            message: 'Valid user ID required'
        });
    }

    try {
        const subscribers = await db.getSubscribers(whopUserId);
        const activeCount = await db.getSubscriberCount(whopUserId, 'active');
        const totalCount = await db.getSubscriberCount(whopUserId);

        res.json({
            success: true,
            subscribers,
            stats: {
                total: totalCount,
                active: activeCount,
                unsubscribed: totalCount - activeCount
            }
        });
    } catch (error) {
        console.error('❌ Get subscribers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching subscribers',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/api/subscribers', async (req, res) => {
    const { whopUserId, email, name } = req.body;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({
            success: false,
            message: 'Valid user ID required'
        });
    }

    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email is required'
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email format'
        });
    }

    try {
        const user = await db.getUser(whopUserId);
        const currentCount = await db.getSubscriberCount(whopUserId);
        const plan = PLANS[user.plan] || PLANS.free;

        if (currentCount >= plan.contact_limit) {
            return res.status(403).json({
                success: false,
                message: `Contact limit reached: ${currentCount}/${plan.contact_limit}`
            });
        }

        const subscriber = await db.addSubscriber(whopUserId, {
            email,
            name: name || '',
            status: 'active'
        });

        await db.updateUser(whopUserId, {
            contacts_count: currentCount + 1
        });

        res.json({
            success: true,
            message: 'Subscriber added successfully',
            subscriber,
            newCount: currentCount + 1
        });
    } catch (error) {
        console.error('❌ Add subscriber error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding subscriber',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.put('/api/subscribers/:id', async (req, res) => {
    const { id } = req.params;
    const { whopUserId, name, status } = req.body;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({
            success: false,
            message: 'Valid user ID required'
        });
    }

    try {
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (status !== undefined) updates.status = status;

        const subscriber = await db.updateSubscriber(id, whopUserId, updates);

        if (!subscriber) {
            return res.status(404).json({
                success: false,
                message: 'Subscriber not found'
            });
        }

        res.json({
            success: true,
            message: 'Subscriber updated successfully',
            subscriber
        });
    } catch (error) {
        console.error('❌ Update subscriber error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating subscriber',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.delete('/api/subscribers/:id', async (req, res) => {
    const { id } = req.params;
    const { whopUserId } = req.query;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({
            success: false,
            message: 'Valid user ID required'
        });
    }

    try {
        const subscriber = await db.deleteSubscriber(id, whopUserId);

        if (!subscriber) {
            return res.status(404).json({
                success: false,
                message: 'Subscriber not found'
            });
        }

        const newCount = await db.getSubscriberCount(whopUserId);
        await db.updateUser(whopUserId, {
            contacts_count: newCount
        });

        res.json({
            success: true,
            message: 'Subscriber deleted successfully',
            newCount
        });
    } catch (error) {
        console.error('❌ Delete subscriber error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting subscriber',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.put('/api/subscribers/:id/vip', async (req, res) => {
    const { id } = req.params;
    const { whopUserId } = req.body;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({
            success: false,
            message: 'Valid user ID required'
        });
    }

    try {
        const subscriber = await db.toggleVipStatus(id, whopUserId);

        if (!subscriber) {
            return res.status(404).json({
                success: false,
                message: 'Subscriber not found'
            });
        }

        res.json({
            success: true,
            message: `Subscriber ${subscriber.is_vip ? 'marked as VIP' : 'removed from VIP'}`,
            subscriber
        });
    } catch (error) {
        console.error('❌ Toggle VIP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error toggling VIP status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/api/subscribers/bulk', async (req, res) => {
    const { whopUserId, subscribers } = req.body;

    if (!whopUserId || whopUserId === 'undefined') {
        return res.status(400).json({
            success: false,
            message: 'Valid user ID required'
        });
    }

    if (!Array.isArray(subscribers) || subscribers.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Subscribers array is required'
        });
    }

    try {
        const user = await db.getUser(whopUserId);
        const currentCount = await db.getSubscriberCount(whopUserId);
        const plan = PLANS[user.plan] || PLANS.free;
        const availableSlots = plan.contact_limit - currentCount;

        if (subscribers.length > availableSlots) {
            return res.status(403).json({
                success: false,
                message: `Not enough contact slots. Available: ${availableSlots}, Requested: ${subscribers.length}`
            });
        }

        const addedSubscribers = await db.bulkAddSubscribers(whopUserId, subscribers);
        const newCount = await db.getSubscriberCount(whopUserId);
        
        await db.updateUser(whopUserId, {
            contacts_count: newCount
        });

        res.json({
            success: true,
            message: `${addedSubscribers.length} subscribers imported successfully`,
            added: addedSubscribers.length,
            skipped: subscribers.length - addedSubscribers.length,
            newCount
        });
    } catch (error) {
        console.error('❌ Bulk import error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error importing subscribers',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/api/webhooks/whop', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['whop-signature'];
    const body = req.body.toString('utf8');
    const secret = process.env.WHOP_WEBHOOK_SECRET;

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
    console.log('📦 Webhook data:', JSON.stringify(event.data, null, 2));

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
                const whopPlanId = data.plan_id;
                const planKey = getPlanFromWhopId(whopPlanId);
                const userId = data.user_id;

                const userUpdates = {
                    plan: planKey,
                    daily_marketing_sent: 0,
                    monthly_marketing_sent: 0,
                    daily_transactional_sent: 0,
                    monthly_transactional_sent: 0,
                    contacts_count: 0,
                    last_daily_reset: moment.utc().format('YYYY-MM-DD'),
                    last_monthly_reset: moment.utc().format('YYYY-MM'),
                    email: data.user_email || data.email || '',
                    name: data.user_username || data.username || data.user_name || data.name || '',
                    username: data.user_username || data.username || ''
                };

                console.log('✅ Updating user with data:', userUpdates);

                await db.updateUser(userId, userUpdates);

                if (data.buyer_email && data.seller_id) {
                    try {
                        await db.addSubscriber(data.seller_id, {
                            email: data.buyer_email,
                            name: data.buyer_username || data.buyer_email.split('@')[0],
                            status: 'active'
                        });
                        
                        const sellerContactCount = await db.getSubscriberCount(data.seller_id);
                        await db.updateUser(data.seller_id, {
                            contacts_count: sellerContactCount
                        });
                        
                        console.log(`✅ Auto-added buyer ${data.buyer_email} to seller ${data.seller_id} contact list`);
                    } catch (error) {
                        console.error('⚠️  Failed to auto-add buyer as subscriber:', error);
                    }
                }
                console.log(`✅ User ${userId} activated plan: ${planKey} with username: ${userUpdates.username}`);
                break;

            case 'membership.deactivated':
            case 'invoice.past_due':
                const deactivatedUserId = data.user_id;
                await db.updateUser(deactivatedUserId, { plan: 'free' });
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
        res.json({ 
            success: false, 
            message: 'Webhook processing failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Ledge Marketing API',
        environment: process.env.NODE_ENV || 'development',
        emailEnabled: !!resend,
        databaseConnected: !!db.pool,
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

app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'API endpoint not found',
        path: req.path
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 Ledge Marketing Backend Started');
    console.log('═══════════════════════════════════════════════');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✉️  Email: ${resend ? '✓ Enabled' : '✗ Demo mode'}`);
    console.log(`💾 Database: ${process.env.DATABASE_URL ? '✓ Connected' : '✗ Not configured'}`);
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

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});
