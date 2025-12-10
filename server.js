const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Resend } = require('resend');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize database tables
const initializeDatabase = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        product_name VARCHAR(255),
        plan VARCHAR(100),
        status VARCHAR(50),
        join_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create emails table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emails (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(user_id),
        email_type VARCHAR(100),
        content TEXT,
        sent_to VARCHAR(255),
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'generated'
      )
    `);

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

// Middleware
app.use(cors());
app.use(express.json());

// Mock AI response function
const generateAIResponse = async (userData, emailType) => {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const responses = {
    welcome: `Hi ${userData.name || 'there'}! Welcome to Ledge Marketing. We're excited to help you grow your business with AI-powered marketing solutions. Based on your interest in ${userData.product_name || 'our services'}, we recommend starting with our core strategy session.`,
    
    followup: `Hey ${userData.name || 'there'}! Following up on your purchase of ${userData.product_name || 'our product'}. We've noticed you might benefit from our advanced automation features. Ready to take your marketing to the next level?`,
    
    upgrade: `Hi ${userData.name || 'valued customer'}! You're doing great with ${userData.product_name || 'our product'}. Did you know our premium plan includes 5x more AI credits and priority support? Perfect time to upgrade!`
  };

  return responses[emailType] || "Thank you for being a valued customer!";
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Ledge Marketing Backend is running!' });
});

// Get user data from Whop or database
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists in database
    const dbResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (dbResult.rows.length > 0) {
      return res.json(dbResult.rows[0]);
    }

    // Fetch from Whop API if not in database
    const whopResponse = await fetch(`https://api.whop.com/api/v2/memberships/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.WHOP_API_KEY}`
      }
    });

    if (!whopResponse.ok) {
      throw new Error('Failed to fetch user data from Whop');
    }

    const userData = await whopResponse.json();
    
    // Transform Whop data to our format
    const transformedData = {
      user_id: userId,
      name: userData.details?.full_name || 'Customer',
      email: userData.details?.email || '',
      product_name: userData.product?.product_title || 'Ledge Marketing Product',
      plan: userData.plan?.plan_title || 'Standard',
      status: userData.status || 'active',
      join_date: userData.start_date || new Date().toISOString()
    };

    // Save to database
    await pool.query(
      `INSERT INTO users (user_id, name, email, product_name, plan, status, join_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (user_id) DO UPDATE SET 
       name = $2, email = $3, product_name = $4, plan = $5, status = $6, join_date = $7`,
      [
        transformedData.user_id,
        transformedData.name,
        transformedData.email,
        transformedData.product_name,
        transformedData.plan,
        transformedData.status,
        transformedData.join_date
      ]
    );

    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user data',
      details: error.message 
    });
  }
});

// Generate AI email
app.post('/api/generate-email', async (req, res) => {
  try {
    const { userId, emailType } = req.body;

    if (!userId || !emailType) {
      return res.status(400).json({ error: 'Missing userId or emailType' });
    }

    // Get user data from database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userResult.rows[0];

    // Generate AI response
    const aiResponse = process.env.AI_ENABLED === 'true' 
      ? await generateAIResponse(userData, emailType)
      : `This is a sample ${emailType} email for ${userData.name}. AI features are currently disabled.`;

    const emailId = uuidv4();
    const emailData = {
      id: emailId,
      userId,
      emailType,
      content: aiResponse,
      generatedAt: new Date().toISOString(),
      userData
    };

    // Store email in database
    await pool.query(
      'INSERT INTO emails (id, user_id, email_type, content) VALUES ($1, $2, $3, $4)',
      [emailId, userId, emailType, aiResponse]
    );

    res.json(emailData);
  } catch (error) {
    console.error('Error generating email:', error);
    res.status(500).json({ 
      error: 'Failed to generate email',
      details: error.message 
    });
  }
});

// Send email via Resend
app.post('/api/send-email', async (req, res) => {
  try {
    const { userId, emailId, recipientEmail } = req.body;

    if (!userId || !emailId || !recipientEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find the generated email in database
    const emailResult = await pool.query(
      'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
      [emailId, userId]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = emailResult.rows[0];

    if (process.env.EMAIL_ENABLED === 'true' && process.env.RESEND_API_KEY) {
      const { data, error } = await resend.emails.send({
        from: 'Ledge Marketing <onboarding@resend.dev>',
        to: recipientEmail,
        subject: `Ledge Marketing - ${email.email_type.charAt(0).toUpperCase() + email.email_type.slice(1)}`,
        text: email.content,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Ledge Marketing</h2>
                <p>${email.content.replace(/\n/g, '<br>')}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">This email was generated by Ledge Marketing AI.</p>
              </div>`
      });

      if (error) {
        throw new Error(error.message);
      }

      // Update email record as sent
      await pool.query(
        'UPDATE emails SET sent_to = $1, sent_at = $2, status = $3 WHERE id = $4',
        [recipientEmail, new Date(), 'sent', emailId]
      );
    }

    res.json({ 
      success: true, 
      message: process.env.EMAIL_ENABLED === 'true' ? 'Email sent successfully' : 'Email prepared (sending disabled)',
      email: email 
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});

// Get user's email history
app.get('/api/email-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const emailResult = await pool.query(
      'SELECT * FROM emails WHERE user_id = $1 ORDER BY generated_at DESC',
      [userId]
    );
    
    res.json(emailResult.rows);
  } catch (error) {
    console.error('Error fetching email history:', error);
    res.status(500).json({ error: 'Failed to fetch email history' });
  }
});

// ============================================
// WHOP WEBHOOK ENDPOINT (NEW)
// ============================================
app.post('/api/webhooks/whop', async (req, res) => {
  try {
    const event = req.body;
    
    console.log('🔔 Received Whop webhook:', event.type);

    // Handle different webhook events
    switch (event.type) {
      case 'membership.created':
        // New subscription - add user to database
        console.log('✅ New membership created:', event.data.id);
        
        const newUser = {
          user_id: event.data.id,
          name: event.data.user?.username || event.data.user?.name || 'Customer',
          email: event.data.user?.email || '',
          product_name: event.data.product?.title || 'Ledge Marketing',
          plan: event.data.plan?.title || 'Standard',
          status: 'active',
          join_date: new Date()
        };
        
        await pool.query(
          `INSERT INTO users (user_id, name, email, product_name, plan, status, join_date) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (user_id) DO UPDATE SET 
           name = $2, email = $3, product_name = $4, plan = $5, status = $6`,
          [newUser.user_id, newUser.name, newUser.email, newUser.product_name, newUser.plan, newUser.status, newUser.join_date]
        );
        
        console.log('✅ User saved to database:', newUser.user_id);
        break;

      case 'membership.updated':
        // Subscription updated (plan change, status change, etc.)
        console.log('🔄 Membership updated:', event.data.id);
        
        await pool.query(
          'UPDATE users SET plan = $1, status = $2 WHERE user_id = $3',
          [event.data.plan?.title || 'Standard', event.data.status || 'active', event.data.id]
        );
        
        console.log('✅ User updated in database:', event.data.id);
        break;

      case 'membership.deleted':
      case 'membership.cancelled':
        // Subscription canceled
        console.log('❌ Membership canceled:', event.data.id);
        
        await pool.query(
          'UPDATE users SET status = $1 WHERE user_id = $2',
          ['canceled', event.data.id]
        );
        
        console.log('✅ User status updated to canceled:', event.data.id);
        break;

      case 'payment.succeeded':
        // Payment successful
        console.log('💰 Payment succeeded for:', event.data.user_id);
        break;

      case 'payment.failed':
        // Payment failed
        console.log('⚠️ Payment failed for:', event.data.user_id);
        break;

      default:
        console.log('ℹ️ Unhandled webhook type:', event.type);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Still return 200 to prevent Whop from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Ledge Marketing Backend running on port ${PORT}`);
    console.log(`📧 AI Enabled: ${process.env.AI_ENABLED}`);
    console.log(`✉️ Email Enabled: ${process.env.EMAIL_ENABLED}`);
    console.log(`📨 Resend API: ${process.env.RESEND_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`🗄️ Database Connected: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
    console.log(`🔔 Webhook endpoint: /api/webhooks/whop`);
  });
});