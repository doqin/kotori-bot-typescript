SELECT m.summary
FROM user_memory m
WHERE m.user_id = ?
GROUP BY m.user_id;