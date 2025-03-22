DELETE FROM user_facts 
WHERE user_id = ? 
AND fact IN (SELECT fact FROM user_facts WHERE user_id = ? ORDER BY rowid ASC LIMIT 1);