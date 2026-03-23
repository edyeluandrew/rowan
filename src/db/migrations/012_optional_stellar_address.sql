-- Make stellar_address optional on traders (can be set later during onboarding)
ALTER TABLE traders ALTER COLUMN stellar_address DROP NOT NULL;
