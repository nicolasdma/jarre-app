ALTER TABLE user_profiles
  ADD COLUMN lemonsqueezy_customer_id TEXT,
  ADD COLUMN lemonsqueezy_subscription_id TEXT;

CREATE TABLE IF NOT EXISTS processed_lemonsqueezy_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
