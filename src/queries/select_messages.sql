SELECT users.username, messages.content, messages.timestamp
FROM messages
JOIN users ON messages.user_id = users.id
WHERE messages.channel_id = ?
ORDER BY messages.timestamp DESC;