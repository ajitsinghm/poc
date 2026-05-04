---
name: postgresql-schema-standards
description: Production-ready PostgreSQL database design and architecture standards
applyTo: "**/*.sql"
---

# PostgreSQL Database Schema Standards

Production-ready database design standards for PostgreSQL, enforcing consistency, performance, and security across the microservice architecture.

---

## 1. Naming Conventions

### Table & Column Naming

**Always use snake_case for:**
- Table names: `users`, `user_profiles`, `audit_logs`
- Column names: `user_id`, `created_at`, `is_active`
- Index names: `idx_users_email_active` (pattern: `idx_<table>_<columns>`)
- Constraint names: `fk_users_organization_id`, `uq_users_email`
- Triggers: `trg_users_update_timestamp`

**Rules:**
- Use singular nouns for tables referencing entities
- Use plural for junction/linking tables: `user_roles`, `product_categories`
- Avoid reserved keywords; prefix with underscore if necessary: `_order`
- Keep names under 63 characters (PostgreSQL identifier limit)
- Use descriptive names: `last_login_at` > `last_login`

### Constraint Naming Pattern

```sql
-- Primary Key
pk_<table>                          -- pk_users

-- Foreign Key
fk_<table>_<referenced_table>_<column>   -- fk_orders_users_id

-- Unique
uq_<table>_<columns>                -- uq_users_email, uq_users_phone

-- Check
ck_<table>_<column>_<condition>     -- ck_users_age_positive

-- Index (non-unique)
idx_<table>_<columns>               -- idx_users_email_active

-- Unique Index
idx_uq_<table>_<columns>            -- idx_uq_users_email_deleted_at
```

---

## 2. Primary Keys & Identity Strategy

### UUID vs BIGSERIAL: Decision Matrix

#### **Use UUID (RECOMMENDED for distributed systems)**

**Advantages:**
- Globally unique without coordination (no sequence management)
- Safe for distributed databases and sharding
- Prevents ID leakage/enumeration attacks
- Works across multiple database instances

**Implementation:**
```sql
-- Option A: Native UUID with pgcrypto
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- Option B: UUID v4 (recommended)
id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
```

**Use case:** Multi-tenant SaaS, API microservices, distributed systems

#### **Use BIGSERIAL (for monolithic systems with single database)**

**Advantages:**
- Smaller storage (8 bytes vs 16 bytes for UUID)
- Slightly faster comparisons
- Human-readable ordering
- Better for high-throughput single database

**Implementation:**
```sql
-- Create sequence with caching for performance
CREATE SEQUENCE users_id_seq AS BIGINT CACHE 100;

id BIGINT PRIMARY KEY DEFAULT nextval('users_id_seq'),
```

**Use case:** Monolithic apps, high-frequency inserts on single database

#### **Hybrid Pattern (RECOMMENDED for this project)**

```sql
-- Use UUID for public-facing resources
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Use BIGSERIAL for internal/audit tables
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Schema Design Rules

### Normalization (3NF Standard)

**Enforce Third Normal Form (3NF):**

1. **1NF** - Atomic values only (no repeating groups)
   - ✅ Use ARRAY/JSONB for semi-structured data
   - ❌ Never store comma-separated values in TEXT

2. **2NF** - All non-key attributes depend on entire primary key
   - ✅ Separate user data from user_profile data
   - ❌ Don't mix entity types in one table

3. **3NF** - Non-key attributes depend only on primary key
   - ✅ Store user_id in orders, not user details
   - ❌ Never store derived/calculated values (unless justified)

### Denormalization Guidelines

**When to denormalize (with justification):**

1. **Reporting/Analytics Tables**
   ```sql
   -- Fact table with denormalized dimensions
   CREATE TABLE order_summary (
       order_id UUID PRIMARY KEY,
       user_id UUID NOT NULL,
       user_email VARCHAR(255),        -- Denormalized for reporting
       user_country VARCHAR(50),       -- Avoids JOINs
       total_amount DECIMAL(12,2),
       status VARCHAR(50),
       created_at TIMESTAMP WITH TIME ZONE
   );
   ```

2. **High-Cardinality Aggregate Queries**
   ```sql
   -- Store computed aggregates to avoid expensive calculations
   CREATE TABLE user_stats (
       user_id UUID PRIMARY KEY REFERENCES users(id),
       total_orders INT DEFAULT 0,
       lifetime_spent DECIMAL(12,2) DEFAULT 0,
       last_order_at TIMESTAMP WITH TIME ZONE,
       updated_at TIMESTAMP WITH TIME ZONE
   );
   ```

3. **Performance-Critical Paths**
   - Denormalize only after proving bottleneck with EXPLAIN ANALYZE
   - Always document why denormalization was chosen
   - Keep denormalized data in sync via triggers or application logic

---

## 4. Data Types & PostgreSQL Features

### Standard Data Type Selection

| Use Case | Type | Notes |
|----------|------|-------|
| **Identifiers** | `UUID` or `BIGINT` | See primary key section |
| **Email/URLs** | `VARCHAR(255)` | Store normalized (lowercase) |
| **Names/Strings** | `VARCHAR(255)` or `TEXT` | Use VARCHAR with limit for indexes |
| **Booleans** | `BOOLEAN` | Use BOOLEAN, not CHAR/INT |
| **Numbers** | `INTEGER`, `BIGINT`, `DECIMAL` | Use DECIMAL for money (not FLOAT) |
| **Money/Prices** | `DECIMAL(12,2)` | Never FLOAT for currency |
| **Dates** | `DATE` | Date without time |
| **Timestamps** | `TIMESTAMP WITH TIME ZONE` | Always use TZ for consistency |
| **JSON/Objects** | `JSONB` | Indexed, queryable JSON (not TEXT) |
| **Arrays** | `ARRAY` | Use typed arrays: `UUID[]`, `VARCHAR[]` |
| **IPs** | `INET` or `CIDR` | Native IP type |
| **Full-Text Search** | `TSVECTOR` | For search indexing |

### JSONB for Semi-Structured Data

```sql
-- Good: JSONB for flexible metadata
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    metadata JSONB DEFAULT '{}',              -- Phone, locale, preferences
    preferences JSONB DEFAULT '{"theme":"light", "notifications": true}'
);

-- Query JSONB
SELECT * FROM users WHERE metadata->>'phone' = '555-1234';
SELECT * FROM users WHERE metadata @> '{"verified": true}';

-- Index JSONB for faster queries
CREATE INDEX idx_users_metadata_verified ON users USING GIN (metadata)
WHERE metadata->>'verified' = 'true';
```

**When to use JSONB:**
- ✅ Metadata, settings, preferences that may evolve
- ✅ Store versioned/historical configurations
- ❌ Don't use for frequently queried structured data (normalize instead)

---

## 5. Foreign Keys & Relationships

### Foreign Keys (Always Explicit)

```sql
-- Standard FK with cascade on delete
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    CONSTRAINT fk_orders_users_id FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- FK with restrict (safe for important data)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    CONSTRAINT fk_payments_orders_id FOREIGN KEY (order_id)
        REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
```

### Cascading Rules

| Rule | When | Use Case |
|------|------|----------|
| `ON DELETE CASCADE` | Child rows depend on parent | order → order_items |
| `ON DELETE RESTRICT` | Protect critical relationships | user → account |
| `ON DELETE SET NULL` | Optional FK | article → author |
| `ON DELETE SET DEFAULT` | Fallback value exists | order → default_warehouse |

**Rule:** Use CASCADE for owned relationships; use RESTRICT for independent relationships.

---

## 6. Audit Fields (MANDATORY)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    
    -- Audit fields (MANDATORY)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,  -- For soft deletes
    
    -- Tracking (optional but recommended)
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    CHECK (status IN ('active', 'inactive', 'suspended', 'deleted'))
);

-- Automatic timestamp update via trigger
CREATE TRIGGER trg_users_update_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Trigger function (create once)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 7. Constraints & Data Integrity

### Check Constraints

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(12,2),
    stock INT DEFAULT 0,
    
    CONSTRAINT ck_products_price_positive CHECK (price > 0),
    CONSTRAINT ck_products_stock_non_negative CHECK (stock >= 0),
    CONSTRAINT ck_products_name_length CHECK (LENGTH(name) >= 3)
);
```

### Unique Constraints

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    
    -- Simple unique
    CONSTRAINT uq_users_email UNIQUE (email),
    
    -- Partial unique (ignore soft-deleted)
    CONSTRAINT uq_users_email_active UNIQUE (email) WHERE deleted_at IS NULL
);

-- Composite unique
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    CONSTRAINT uq_user_roles_composite UNIQUE (user_id, role_id),
    PRIMARY KEY (user_id, role_id)
);
```

---

## 8. Indexing Strategy

### Index Selection

| Index Type | Best For | Use Case |
|------------|----------|----------|
| **B-tree** | Equality, range queries | `WHERE email = ?`, `WHERE age > 18` |
| **GIN** | Full-text search, JSONB, ARRAY | `WHERE metadata @> '{...}'` |
| **GIST** | Range, geometric data | `WHERE date_range @> DATE` |
| **BRIN** | Time-series, large tables | `WHERE created_at > NOW()` |

### Indexing Guidelines

```sql
-- 1. Index foreign keys (for JOINs)
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 2. Index WHERE clause columns
CREATE INDEX idx_users_email ON users(email);

-- 3. Composite indexes for multi-column WHERE
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- 4. Partial indexes (filter unused rows)
CREATE INDEX idx_orders_pending ON orders(user_id, created_at)
WHERE status = 'pending';

-- 5. JSONB indexes
CREATE INDEX idx_users_metadata_gin ON users USING GIN (metadata);

-- 6. Full-text search indexes
CREATE INDEX idx_products_search ON products 
USING GIN (to_tsvector('english', name || ' ' || description));

-- 7. Unique indexes
CREATE UNIQUE INDEX idx_uq_users_email ON users(email);
```

**Test before committing:**
```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
-- Should show "Index Scan"
```

---

## 9. Security: Roles & RLS

### Database Roles

```sql
-- Create roles with minimal privileges
CREATE ROLE app_user LOGIN PASSWORD 'strong_password';
CREATE ROLE app_admin LOGIN PASSWORD 'admin_password';

GRANT CONNECT ON DATABASE myapp TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Don't use superuser for application
```

### Row-Level Security

```sql
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_isolation ON users
FOR ALL
USING (id = current_user_id());

-- Admin bypass
CREATE POLICY admin_access ON users
FOR ALL
USING (current_setting('app.user_role') = 'admin');
```

---

## 10. Transaction Handling

### Isolation Levels

| Level | Use Case |
|-------|----------|
| **READ COMMITTED** | Most cases (default) |
| **REPEATABLE READ** | Strong consistency needed |
| **SERIALIZABLE** | Financial transactions |

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  UPDATE account SET balance = balance - 100 WHERE id = 1;
  UPDATE account SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

### Deadlock Prevention

```sql
-- Always lock tables in the same order across transactions
BEGIN;
  UPDATE users SET ... WHERE id = 1;     -- First
  UPDATE accounts SET ... WHERE id = 1;  -- Second
COMMIT;
```

---

## 11. Performance & Scaling

### Query Optimization

```sql
-- Use EXPLAIN ANALYZE to find bottlenecks
EXPLAIN ANALYZE
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id;

-- Batch operations instead of individual queries
INSERT INTO logs (user_id, action, created_at)
VALUES ('user-1', 'login', NOW()), ('user-2', 'login', NOW());
```

### Partitioning for Large Tables

```sql
-- Time-series partitioning
CREATE TABLE events (
    id BIGSERIAL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (YEAR(created_at), MONTH(created_at));

CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM (2024, 1) TO (2024, 2);
```

### VACUUM & Maintenance

```sql
-- Reclaim storage and update statistics
VACUUM ANALYZE users;

-- Schedule regular maintenance via pg_cron
SELECT cron.schedule('vacuum-users', '0 2 * * *', 'VACUUM ANALYZE users');
```

---

## 12. Complete Example: Users & Orders

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Audit trigger function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT uq_users_email_active UNIQUE (email) WHERE deleted_at IS NULL
);

CREATE TRIGGER trg_users_update_timestamp BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT ck_orders_status CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    CONSTRAINT ck_orders_amount CHECK (total_amount > 0)
);

CREATE TRIGGER trg_orders_update_timestamp BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status) WHERE deleted_at IS NULL;
```

---

## 13. Quality Checklist

- [ ] All tables have UUID or BIGSERIAL primary key
- [ ] All tables have created_at, updated_at audit fields
- [ ] Foreign keys include ON DELETE/UPDATE rules
- [ ] Soft-delete tables have deleted_at + filtered indexes
- [ ] CHECK constraints enforce business rules
- [ ] UNIQUE constraints on natural identifiers
- [ ] Indexes on foreign keys and filtered columns
- [ ] Indexes verified with EXPLAIN ANALYZE
- [ ] DECIMAL used for money; never FLOAT
- [ ] TIMESTAMP WITH TIME ZONE for all timestamps
- [ ] snake_case naming on all objects
- [ ] Denormalization is performance-justified
- [ ] Row-level security for multi-tenant data
- [ ] Triggers maintain updated_at automatically
- [ ] No nullable primary or foreign keys
- [ ] Schema DDL is version-controlled