ALTER TABLE user_agent_configs
ADD COLUMN authorization_ttl_hours INTEGER NOT NULL DEFAULT 12
CHECK (authorization_ttl_hours BETWEEN 1 AND 8640);
