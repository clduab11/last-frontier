-- Development seed data for Last Frontier core tables

-- Insert sample users
INSERT INTO users (user_id, email, password_hash, first_name, last_name, email_verified, status, preferences, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com', '$2b$10$hash1', 'Alice', 'Anderson', TRUE, 'ACTIVE', '{}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com', '$2b$10$hash2', 'Bob', 'Brown', FALSE, 'ACTIVE', '{}', NOW(), NOW());

-- Insert sample subscriptions
INSERT INTO subscriptions (subscription_id, user_id, tier, status, start_date, end_date, auto_renew, billing_cycle, price_amount, currency, payment_method_id, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'CREATIVE', 'ACTIVE', NOW(), NULL, TRUE, 'MONTHLY', 29.99, 'USD', 'pm_123', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'RESEARCH', 'ACTIVE', NOW(), NULL, TRUE, 'YEARLY', 299.99, 'USD', 'pm_456', NOW(), NOW());

-- Insert sample usage quotas
INSERT INTO usage_quotas (quota_id, subscription_id, tier, text_generation_limit, image_generation_limit, batch_processing_limit, api_calls_limit, storage_limit, reset_period, reset_date, created_at)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'CREATIVE', 10000, 1000, 100, 50000, 1024, 'MONTHLY', NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'RESEARCH', 50000, 5000, 500, 200000, 5120, 'YEARLY', NOW(), NOW());

-- Insert sample content generations
INSERT INTO content_generations (generation_id, user_id, request_type, prompt, parameters, result, status, processing_time, vcu_cost, moderation_status, moderation_reason, created_at, completed_at)
VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'TEXT_GENERATION', 'Write a poem about the frontier.', '{"length": "short"}', 'A poem...', 'COMPLETED', 1200, 0.25, 'APPROVED', NULL, NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'IMAGE_GENERATION', 'Generate an image of a spaceship.', '{"resolution": "1024x1024"}', NULL, 'PENDING', NULL, NULL, 'PENDING', NULL, NOW(), NULL);