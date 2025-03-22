SELECT m.personality, m.summary, 
       GROUP_CONCAT(f.fact, '||') AS facts
FROM user_memory m
LEFT JOIN user_facts f ON m.user_id = f.user_id
WHERE m.user_id = ?
GROUP BY m.user_id;