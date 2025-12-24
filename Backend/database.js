const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

// ===== DATABASE INITIALIZATION =====

const initializeDatabase = async () => {
    try {
        console.log('🔧 Initializing database tables...');

        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                whop_user_id VARCHAR(255) PRIMARY KEY,
                email VARCHAR(255),
                name VARCHAR(255),
                plan VARCHAR(50) DEFAULT 'free',
                contacts_count INTEGER DEFAULT 0,
                daily_marketing_sent INTEGER DEFAULT 0,
                monthly_marketing_sent INTEGER DEFAULT 0,
                daily_transactional_sent INTEGER DEFAULT 0,
                monthly_transactional_sent INTEGER DEFAULT 0,
                last_daily_reset DATE DEFAULT CURRENT_DATE,
                last_monthly_reset VARCHAR(7) DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create subscribers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id SERIAL PRIMARY KEY,
                whop_user_id VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (whop_user_id) REFERENCES users(whop_user_id) ON DELETE CASCADE,
                UNIQUE(whop_user_id, email)
            )
        `);

        // Create index for faster lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_subscribers_user_id 
            ON subscribers(whop_user_id)
        `);

        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
};

// ===== USER OPERATIONS =====

const getUser = async (whopUserId) => {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE whop_user_id = $1',
            [whopUserId]
        );
        
        if (result.rows.length === 0) {
            // Create new user with defaults
            return await createUser(whopUserId);
        }
        
        return result.rows[0];
    } catch (error) {
        console.error('Error getting user:', error);
        throw error;
    }
};

const createUser = async (whopUserId, data = {}) => {
    try {
        const result = await pool.query(
            `INSERT INTO users (
                whop_user_id, email, name, plan
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (whop_user_id) 
            DO UPDATE SET 
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                plan = EXCLUDED.plan,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                whopUserId,
                data.email || '',
                data.name || '',
                data.plan || 'free'
            ]
        );
        
        return result.rows[0];
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};

const updateUser = async (whopUserId, data) => {
    try {
        const fields = [];
        const values = [];
        let paramCounter = 1;

        // Build dynamic UPDATE query
        Object.keys(data).forEach(key => {
            fields.push(`${key} = $${paramCounter}`);
            values.push(data[key]);
            paramCounter++;
        });

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(whopUserId);

        const query = `
            UPDATE users 
            SET ${fields.join(', ')}
            WHERE whop_user_id = $${paramCounter}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
};

// ===== SUBSCRIBER OPERATIONS =====

const getSubscribers = async (whopUserId, options = {}) => {
    try {
        let query = 'SELECT * FROM subscribers WHERE whop_user_id = $1';
        const values = [whopUserId];

        // Add status filter if provided
        if (options.status) {
            query += ' AND status = $2';
            values.push(options.status);
        }

        // Add ordering
        query += ' ORDER BY created_at DESC';

        // Add pagination if provided
        if (options.limit) {
            query += ` LIMIT $${values.length + 1}`;
            values.push(options.limit);
        }
        if (options.offset) {
            query += ` OFFSET $${values.length + 1}`;
            values.push(options.offset);
        }

        const result = await pool.query(query, values);
        return result.rows;
    } catch (error) {
        console.error('Error getting subscribers:', error);
        throw error;
    }
};

const getSubscriberCount = async (whopUserId, status = null) => {
    try {
        let query = 'SELECT COUNT(*) as count FROM subscribers WHERE whop_user_id = $1';
        const values = [whopUserId];

        if (status) {
            query += ' AND status = $2';
            values.push(status);
        }

        const result = await pool.query(query, values);
        return parseInt(result.rows[0].count);
    } catch (error) {
        console.error('Error getting subscriber count:', error);
        throw error;
    }
};

const addSubscriber = async (whopUserId, subscriberData) => {
    try {
        const result = await pool.query(
            `INSERT INTO subscribers (whop_user_id, email, name, status)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (whop_user_id, email) 
             DO UPDATE SET 
                name = EXCLUDED.name,
                status = EXCLUDED.status,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                whopUserId,
                subscriberData.email,
                subscriberData.name || '',
                subscriberData.status || 'active'
            ]
        );

        return result.rows[0];
    } catch (error) {
        console.error('Error adding subscriber:', error);
        throw error;
    }
};

const updateSubscriber = async (subscriberId, whopUserId, data) => {
    try {
        const fields = [];
        const values = [];
        let paramCounter = 1;

        Object.keys(data).forEach(key => {
            fields.push(`${key} = $${paramCounter}`);
            values.push(data[key]);
            paramCounter++;
        });

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(subscriberId, whopUserId);

        const query = `
            UPDATE subscribers 
            SET ${fields.join(', ')}
            WHERE id = $${paramCounter} AND whop_user_id = $${paramCounter + 1}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error updating subscriber:', error);
        throw error;
    }
};

const deleteSubscriber = async (subscriberId, whopUserId) => {
    try {
        const result = await pool.query(
            'DELETE FROM subscribers WHERE id = $1 AND whop_user_id = $2 RETURNING *',
            [subscriberId, whopUserId]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error deleting subscriber:', error);
        throw error;
    }
};

const bulkAddSubscribers = async (whopUserId, subscribersArray) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const results = [];
        for (const subscriber of subscribersArray) {
            const result = await client.query(
                `INSERT INTO subscribers (whop_user_id, email, name, status)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (whop_user_id, email) DO NOTHING
                 RETURNING *`,
                [
                    whopUserId,
                    subscriber.email,
                    subscriber.name || '',
                    subscriber.status || 'active'
                ]
            );
            if (result.rows.length > 0) {
                results.push(result.rows[0]);
            }
        }

        await client.query('COMMIT');
        return results;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error bulk adding subscribers:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    initializeDatabase,
    // User operations
    getUser,
    createUser,
    updateUser,
    // Subscriber operations
    getSubscribers,
    getSubscriberCount,
    addSubscriber,
    updateSubscriber,
    deleteSubscriber,
    bulkAddSubscribers
};
