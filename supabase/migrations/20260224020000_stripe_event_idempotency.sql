-- Stripe webhook event idempotency table
-- Prevents processing the same webhook event more than once

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for future cleanup of old entries
CREATE INDEX idx_processed_stripe_events_processed_at ON processed_stripe_events (processed_at);
