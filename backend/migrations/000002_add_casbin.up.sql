-- Casbin policy storage
CREATE TABLE IF NOT EXISTS casbin_rule (
    id SERIAL PRIMARY KEY,
    ptype VARCHAR(100) NOT NULL,
    v0 VARCHAR(100),
    v1 VARCHAR(100),
    v2 VARCHAR(100),
    v3 VARCHAR(100),
    v4 VARCHAR(100),
    v5 VARCHAR(100),
    CONSTRAINT unique_key UNIQUE(ptype, v0, v1, v2, v3, v4, v5)
);

CREATE INDEX idx_casbin_ptype ON casbin_rule(ptype);

-- Default policies: authenticated users can access items
INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES
    ('p', 'user', '/api/v1/auth/me', 'GET'),
    ('p', 'user', '/api/v1/items', '(GET)|(POST)'),
    ('p', 'user', '/api/v1/items/*', '(GET)|(PATCH)|(DELETE)')
ON CONFLICT DO NOTHING;
