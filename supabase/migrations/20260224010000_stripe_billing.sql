-- Add Stripe billing columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN stripe_customer_id TEXT,
  ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'canceled', 'past_due'));
