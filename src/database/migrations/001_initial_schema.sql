-- Database initialization script
-- File: database/migrations/001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE subscription_tier_enum AS ENUM ('CREATIVE', 'RESEARCH', 'ENTERPRISE');
CREATE TYPE subscription_status_enum AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING');
CREATE TYPE billing_cycle_enum AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE request_type_enum AS ENUM ('TEXT_GENERATION', 'IMAGE_GENERATION', 'BATCH_PROCESSING');
CREATE TYPE generation_status_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE moderation_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- Core tables
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_image TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  status user_status_enum DEFAULT 'ACTIVE',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE TABLE subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  tier subscription_tier_enum NOT NULL,
  status subscription_status_enum DEFAULT 'ACTIVE',
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT TRUE,
  billing_cycle billing_cycle_enum DEFAULT 'MONTHLY',
  price_amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  payment_method_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usage_quotas (
  quota_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
  tier subscription_tier_enum NOT NULL,
  text_generation_limit INTEGER,
  image_generation_limit INTEGER,
  batch_processing_limit INTEGER,
  api_calls_limit INTEGER,
  storage_limit INTEGER, -- in MB
  reset_period VARCHAR(20) DEFAULT 'MONTHLY',
  reset_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE content_generations (
  generation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  request_type request_type_enum NOT NULL,
  prompt TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  result TEXT,
  status generation_status_enum DEFAULT 'PENDING',
  processing_time INTEGER, -- in milliseconds
  vcu_cost DECIMAL(10,4),
  moderation_status moderation_status_enum DEFAULT 'PENDING',
  moderation_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_generations_user_id ON content_generations(user_id);
CREATE INDEX idx_generations_created_at ON content_generations(created_at);
CREATE INDEX idx_generations_status ON content_generations(status);

-- Composite indexes for analytics
CREATE INDEX idx_usage_analytics ON content_generations(user_id, request_type, created_at);