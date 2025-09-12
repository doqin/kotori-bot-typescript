INSERT INTO user_memory (user_id, summary)
VALUES (?, ?)
ON CONFLICT(user_id) DO UPDATE
SET summary = excluded.summary;