async function routes(fastify, options) {

  // Get all users
  fastify.get('/users', async (request, reply) => {
    try {
      const client = await fastify.pg.connect();
      const query = `
        SELECT
          rc.username,
          ra.framedipaddress AS ip_address,
          ra.acctstarttime AS start_time,
          ra.acctstoptime AS stop_time,
          ra.callingstationid AS mac_address,
          ROUND(ra.AcctInputOctets / 1024.0 / 1024.0, 2) AS download_mb,
          ROUND(ra.AcctOutputOctets / 1024.0 / 1024.0, 2) AS upload_mb,
          ra.acctsessiontime AS duration,
          CASE
            WHEN ra.acctstoptime IS NULL THEN 'Online'
            WHEN ra.acctsessiontime IS NOT NULL THEN 'Terminated'
            ELSE 'Never connected'
          END AS status
        FROM radcheck rc
        LEFT JOIN LATERAL (
            SELECT *
            FROM radacct ra
            WHERE ra.username = rc.username
            ORDER BY ra.acctstarttime DESC
            LIMIT 1
        ) ra ON true;
      `;
      const { rows } = await client.query(query);
      client.release();
      return rows;
    } catch (err) {
      request.log.error('Postgres query error:', err);
      reply.code(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Get one user by username (fetch all radcheck entries for that user)
  fastify.get('/users/:username', async (request, reply) => {
    try {
      const client = await fastify.pg.connect();
      const query = `SELECT id, username, attribute, op, value FROM radcheck WHERE username = $1;`;
      const { rows } = await client.query(query, [request.params.username]);
      client.release();
      if (rows.length === 0) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }
      return rows;
    } catch (err) {
      request.log.error('Postgres query error:', err);
      reply.code(500).send({ error: 'Failed to fetch user' });
    }
  });

  // Create user - expects JSON body { username, password }
  // Will insert with attribute='Cleartext-Password', op=':=', value=password
  fastify.post('/users', async (request, reply) => {
    const { username, password } = request.body;
    if (!username || !password) {
      reply.code(400).send({ error: 'Username and password are required' });
      return;
    }
    try {
      const client = await fastify.pg.connect();

      // Insert Cleartext-Password record
      const query = `
        INSERT INTO radcheck (username, attribute, op, value)
        VALUES ($1, 'Cleartext-Password', ':=', $2)
        RETURNING id, username, attribute, op, value;
      `;

      const { rows } = await client.query(query, [username, password]);
      client.release();

      reply.code(201).send(rows[0]);
    } catch (err) {
      request.log.error('Postgres insert error:', err);
      if (err.code === '23505') { // unique violation
        reply.code(409).send({ error: 'User already exists' });
      } else {
        reply.code(500).send({ error: 'Failed to create user' });
      }
    }
  });

  // Update user password (cleartext) by username
  // This updates the radcheck entry with attribute=Cleartext-Password for that user
  fastify.put('/users/:username', async (request, reply) => {
    const { username } = request.params;
    const { password } = request.body;
    if (!password) {
      reply.code(400).send({ error: 'Password is required' });
      return;
    }
    try {
      const client = await fastify.pg.connect();

      // Update password if user exists
      const query = `
        UPDATE radcheck
        SET value = $1
        WHERE username = $2 AND attribute = 'Cleartext-Password'
        RETURNING id, username, attribute, op, value;
      `;

      const { rows } = await client.query(query, [password, username]);
      client.release();

      if (rows.length === 0) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      reply.send(rows[0]);
    } catch (err) {
      request.log.error('Postgres update error:', err);
      reply.code(500).send({ error: 'Failed to update password' });
    }
  });

  // Enhanced Delete user by username (deletes all radcheck entries for that user)
  // Also handles cleanup of related radacct entries if needed
  fastify.delete('/users/:username', async (request, reply) => {
    const { username } = request.params;
    
    if (!username || username.trim() === '') {
      reply.code(400).send({ error: 'Username is required' });
      return;
    }

    try {
      const client = await fastify.pg.connect();

      // Start a transaction for data consistency
      await client.query('BEGIN');

      try {
        // First check if user exists
        const checkQuery = `SELECT username FROM radcheck WHERE username = $1 LIMIT 1;`;
        const checkResult = await client.query(checkQuery, [username]);

        if (checkResult.rows.length === 0) {
          await client.query('ROLLBACK');
          client.release();
          reply.code(404).send({ error: 'User not found' });
          return;
        }

        // Delete from radcheck (main user data)
        const deleteQuery = `DELETE FROM radcheck WHERE username = $1 RETURNING id;`;
        const { rows } = await client.query(deleteQuery, [username]);

        // Optional: Also delete accounting records if desired
        // Uncomment the following lines if you want to delete accounting history
        /*
        const deleteAcctQuery = `DELETE FROM radacct WHERE username = $1;`;
        await client.query(deleteAcctQuery, [username]);
        */

        // Commit the transaction
        await client.query('COMMIT');
        client.release();

        request.log.info(`User ${username} deleted successfully`);
        reply.send({ 
          message: `User ${username} deleted successfully`,
          username: username,
          deletedRecords: rows.length
        });

      } catch (transactionError) {
        await client.query('ROLLBACK');
        client.release();
        throw transactionError;
      }

    } catch (err) {
      request.log.error('Postgres delete error:', err);
      reply.code(500).send({ error: 'Failed to delete user' });
    }
  });

  // Bulk delete users - expects JSON body { usernames: ["user1", "user2", ...] }
  fastify.post('/users/bulk-delete', async (request, reply) => {
    const { usernames } = request.body;

    // Validate input
    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      reply.code(400).send({ 
        error: 'usernames array is required and must contain at least one username' 
      });
      return;
    }

    // Validate usernames
    const validUsernames = usernames.filter(username => 
      username && typeof username === 'string' && username.trim() !== ''
    ).map(username => username.trim());

    if (validUsernames.length === 0) {
      reply.code(400).send({ 
        error: 'No valid usernames provided' 
      });
      return;
    }

    // Limit bulk delete to prevent abuse (adjust as needed)
    if (validUsernames.length > 100) {
      reply.code(400).send({ 
        error: 'Cannot delete more than 100 users at once' 
      });
      return;
    }

    const results = {
      successful: [],
      failed: [],
      totalRequested: validUsernames.length,
      successCount: 0,
      failCount: 0
    };

    try {
      const client = await fastify.pg.connect();

      // Process deletions in a transaction for better performance and consistency
      await client.query('BEGIN');

      try {
        // First, check which users exist
        const placeholders = validUsernames.map((_, index) => `$${index + 1}`).join(',');
        const checkQuery = `SELECT username FROM radcheck WHERE username IN (${placeholders});`;
        const existingUsersResult = await client.query(checkQuery, validUsernames);
        const existingUsernames = existingUsersResult.rows.map(row => row.username);

        // Mark non-existent users as failed
        validUsernames.forEach(username => {
          if (!existingUsernames.includes(username)) {
            results.failed.push({
              username: username,
              error: 'User not found'
            });
            results.failCount++;
          }
        });

        // Delete existing users
        if (existingUsernames.length > 0) {
          const deletePlaceholders = existingUsernames.map((_, index) => `$${index + 1}`).join(',');
          const deleteQuery = `DELETE FROM radcheck WHERE username IN (${deletePlaceholders}) RETURNING username;`;
          const deleteResult = await client.query(deleteQuery, existingUsernames);

          // Optional: Also delete accounting records
          // Uncomment if you want to delete accounting history for bulk operations
          /*
          const deleteAcctQuery = `DELETE FROM radacct WHERE username IN (${deletePlaceholders});`;
          await client.query(deleteAcctQuery, existingUsernames);
          */

          // Mark successful deletions
          deleteResult.rows.forEach(row => {
            results.successful.push({
              username: row.username,
              message: 'User deleted successfully'
            });
            results.successCount++;
          });

          // Check for any users that existed but failed to delete
          existingUsernames.forEach(username => {
            const wasDeleted = deleteResult.rows.some(row => row.username === username);
            if (!wasDeleted) {
              results.failed.push({
                username: username,
                error: 'Delete operation failed'
              });
              results.failCount++;
            }
          });
        }

        await client.query('COMMIT');
        client.release();

        // Log the bulk operation
        request.log.info(`Bulk delete completed: ${results.successCount} successful, ${results.failCount} failed`);

        // Return appropriate status code based on results
        if (results.successCount === 0) {
          reply.code(400).send({
            message: 'No users were deleted',
            ...results
          });
        } else if (results.failCount === 0) {
          reply.code(200).send({
            message: `All ${results.successCount} users deleted successfully`,
            ...results
          });
        } else {
          reply.code(207).send({ // 207 Multi-Status for partial success
            message: `Bulk delete completed with mixed results: ${results.successCount} successful, ${results.failCount} failed`,
            ...results
          });
        }

      } catch (transactionError) {
        await client.query('ROLLBACK');
        client.release();
        throw transactionError;
      }

    } catch (err) {
      request.log.error('Bulk delete error:', err);
      reply.code(500).send({ 
        error: 'Bulk delete operation failed',
        details: err.message 
      });
    }
  });

  // Alternative bulk delete endpoint using DELETE method with query parameters
  // Usage: DELETE /users/bulk?usernames=user1,user2,user3
  fastify.delete('/users/bulk', async (request, reply) => {
    const { usernames } = request.query;

    if (!usernames) {
      reply.code(400).send({ 
        error: 'usernames query parameter is required (comma-separated list)' 
      });
      return;
    }

    // Parse comma-separated usernames
    const usernameArray = usernames.split(',').map(u => u.trim()).filter(u => u !== '');

    if (usernameArray.length === 0) {
      reply.code(400).send({ 
        error: 'No valid usernames provided' 
      });
      return;
    }

    // Reuse the bulk delete logic by calling the POST endpoint logic
    request.body = { usernames: usernameArray };
    
    // Forward to the POST bulk delete handler
    return fastify.inject({
      method: 'POST',
      url: '/users/bulk-delete',
      payload: { usernames: usernameArray }
    }).then(response => {
      reply.code(response.statusCode).send(JSON.parse(response.payload));
    });
  });

  // Health check endpoint for the user management system
  fastify.get('/users/health', async (request, reply) => {
    try {
      const client = await fastify.pg.connect();
      const result = await client.query('SELECT COUNT(*) as user_count FROM radcheck;');
      client.release();
      
      reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        userCount: parseInt(result.rows[0].user_count),
        database: 'connected'
      });
    } catch (err) {
      request.log.error('Health check failed:', err);
      reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed'
      });
    }
  });

}

export default routes;