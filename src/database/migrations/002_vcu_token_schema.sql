-- Migration: VCU Token Storage Schema Extension
-- Adds vcu_tokens table for secure, encrypted token management

CREATE TABLE IF NOT EXISTS vcu_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    value BYTEA NOT NULL, -- AES-256 encrypted token value
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_rotated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    usage_count INTEGER NOT NULL DEFAULT 0,
    quota INTEGER NOT NULL,
    rate_limit INTEGER NOT NULL,
    owner_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    metadata JSONB,
    CONSTRAINT fk_owner FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_vcu_tokens_owner_id ON vcu_tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_vcu_tokens_status ON vcu_tokens(status);
CREATE INDEX IF NOT EXISTS idx_vcu_tokens_expires_at ON vcu_tokens(expires_at);