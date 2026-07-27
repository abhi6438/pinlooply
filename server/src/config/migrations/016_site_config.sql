-- Generic key-value config table for site-wide settings (e.g. donate config)
CREATE TABLE IF NOT EXISTS public.site_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default donate config
INSERT INTO public.site_config (key, value) VALUES (
  'donate',
  '{
    "upi":          { "enabled": true,  "id": "yourname@upi", "name": "Your Name" },
    "paypal":       { "enabled": true,  "url": "https://paypal.me/YourUsername" },
    "buymeacoffee": { "enabled": true,  "url": "https://www.buymeacoffee.com/YourUsername" }
  }'
) ON CONFLICT (key) DO NOTHING;
