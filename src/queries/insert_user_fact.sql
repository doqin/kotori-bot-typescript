INSERT INTO user_facts (user_id, fact)
VALUES (?, ?)
ON CONFLICT DO NOTHING;