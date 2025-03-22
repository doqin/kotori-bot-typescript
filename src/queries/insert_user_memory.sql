INSERT INTO user_memory (user_id, personality, summary)
VALUES (?, ?, ?)
ON CONFLICT(user_id) DO UPDATE
SET personality = excluded.personality, summary = excluded.summary;