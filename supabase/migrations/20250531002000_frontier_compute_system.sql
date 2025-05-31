-- Last Frontier Compute System Database Schema
-- Implements FFC (Frontier Freedom Credits) tokenomics with decentralized AI backend integration

-- Extend users table with FFC balance and staking information
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS ffc_balance DECIMAL(15,4) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS total_ffc_purchased DECIMAL(15,4) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS total_ffc_used DECIMAL(15,4) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS ffc_tier VARCHAR(20) DEFAULT 'explorer',
ADD COLUMN IF NOT EXISTS daily_ffc_limit DECIMAL(15,4) DEFAULT 100.0,
ADD COLUMN IF NOT EXISTS last_ffc_reset_date DATE DEFAULT CURRENT_DATE;

-- FFC transaction log for complete audit trail
CREATE TABLE IF NOT EXISTS public.ffc_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'deduction', 'refund', 'allocation', 'bonus')),
    amount DECIMAL(15,4) NOT NULL,
    balance_before DECIMAL(15,4) NOT NULL,
    balance_after DECIMAL(15,4) NOT NULL,
    description TEXT,
    inference_request_id UUID NULL,
    payment_reference VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- AI inference request log with cost tracking
CREATE TABLE IF NOT EXISTS public.ai_inference_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('text', 'image', 'code', 'chat')),
    ffc_cost DECIMAL(10,4) NOT NULL,
    token_count INTEGER NULL,
    request_payload JSONB NOT NULL,
    response_payload JSONB NULL,
    provider_request_id VARCHAR(255) NULL, -- Venice API request ID
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    processing_time_ms INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    error_message TEXT NULL
);

-- Payment records linking USD payments to FFC credits
CREATE TABLE IF NOT EXISTS public.ffc_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_provider VARCHAR(50) NOT NULL, -- 'stripe', 'paypal', etc.
    payment_provider_id VARCHAR(255) NOT NULL, -- External payment ID
    amount_usd DECIMAL(10,2) NOT NULL,
    ffc_amount DECIMAL(15,4) NOT NULL,
    ffc_rate DECIMAL(10,6) NOT NULL, -- FFC per USD at time of purchase
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- User FFC subscription tiers and limits
CREATE TABLE IF NOT EXISTS public.ffc_tiers (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    daily_ffc_limit DECIMAL(15,4) NOT NULL,
    monthly_price_usd DECIMAL(10,2) NULL,
    features JSONB DEFAULT '{}'::jsonb,
    priority_queue BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI provider proxy configuration and monitoring
CREATE TABLE IF NOT EXISTS public.ai_provider_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requests INTEGER DEFAULT 0,
    total_vcu_cost DECIMAL(15,4) DEFAULT 0.0, -- Actual Venice VCU cost
    total_ffc_billed DECIMAL(15,4) DEFAULT 0.0, -- FFC billed to users
    revenue_usd DECIMAL(15,2) DEFAULT 0.0,
    avg_response_time_ms INTEGER NULL,
    error_rate DECIMAL(5,4) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date)
);

-- Real-time FFC balance tracking with triggers
CREATE OR REPLACE FUNCTION update_ffc_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user FFC balance based on transaction
    UPDATE auth.users 
    SET ffc_balance = NEW.balance_after,
        total_ffc_used = CASE 
            WHEN NEW.transaction_type = 'deduction' THEN total_ffc_used + NEW.amount 
            ELSE total_ffc_used 
        END,
        total_ffc_purchased = CASE 
            WHEN NEW.transaction_type IN ('purchase', 'allocation') THEN total_ffc_purchased + NEW.amount 
            ELSE total_ffc_purchased 
        END
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update user balance on FFC transactions
DROP TRIGGER IF EXISTS trigger_update_ffc_balance ON public.ffc_transactions;
CREATE TRIGGER trigger_update_ffc_balance 
    AFTER INSERT ON public.ffc_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_ffc_balance();

-- Daily FFC limit reset function
CREATE OR REPLACE FUNCTION reset_daily_ffc_limits()
RETURNS void AS $$
BEGIN
    UPDATE auth.users 
    SET last_ffc_reset_date = CURRENT_DATE
    WHERE last_ffc_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default FFC tiers
INSERT INTO public.ffc_tiers (id, name, daily_ffc_limit, monthly_price_usd, features) VALUES
('explorer', 'Explorer', 100.0, 0.00, '{"models": ["basic"], "support": "community"}'),
('professional', 'Professional', 1000.0, 29.99, '{"models": ["basic", "advanced"], "support": "email", "priority": true}'),
('enterprise', 'Enterprise', 10000.0, 199.99, '{"models": ["all"], "support": "dedicated", "priority": true, "custom_limits": true}'),
('unlimited', 'Unlimited', 999999.0, 999.99, '{"models": ["all"], "support": "dedicated", "priority": true, "unlimited": true}')
ON CONFLICT (id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ffc_transactions_user_id ON public.ffc_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ffc_transactions_created_at ON public.ffc_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_inference_requests_user_id ON public.ai_inference_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_inference_requests_created_at ON public.ai_inference_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_ffc_payments_user_id ON public.ffc_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_ffc_payments_payment_provider_id ON public.ffc_payments(payment_provider_id);

-- Row Level Security (RLS) policies
ALTER TABLE public.ffc_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_inference_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffc_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffc_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_metrics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own FFC transactions
CREATE POLICY "Users can view own FFC transactions" ON public.ffc_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only see their own AI inference requests
CREATE POLICY "Users can view own AI requests" ON public.ai_inference_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only see their own payments
CREATE POLICY "Users can view own payments" ON public.ffc_payments
    FOR SELECT USING (auth.uid() = user_id);

-- Everyone can read FFC tiers
CREATE POLICY "Everyone can view FFC tiers" ON public.ffc_tiers
    FOR SELECT USING (true);

-- Only admins can see provider metrics
CREATE POLICY "Admins can view provider metrics" ON public.ai_provider_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );