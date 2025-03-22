SELECT
    messages.id AS message_id,
    messages.user_id,
    users.username,
    users.display_name,
    messages.channel_id,
    messages.role,
    messages.content,
    messages.timestamp,
    messages_attachments.mime_type,
    messages_attachments.data
FROM messages
JOIN users ON messages.user_id = users.id
LEFT JOIN message_attachments ON messages.id = message_attachments.message_id
WHERE messages.channel_id = ?
ORDER BY messages.timestamp DESC
LIMIT ? OFFSET ?;