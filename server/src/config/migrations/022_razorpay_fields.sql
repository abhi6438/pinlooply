-- Migration 022: Add Razorpay payment fields to donor_details
-- Run this in your Supabase SQL editor

ALTER TABLE donor_details
  ADD COLUMN IF NOT EXISTS razorpay_order_id   text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text;

-- Index for quick lookups by payment ID
CREATE INDEX IF NOT EXISTS idx_donor_details_razorpay_payment
  ON donor_details (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
