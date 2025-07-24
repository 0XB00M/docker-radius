
async function routes(fastify, options) {
  fastify.get('/login', async (request, reply) => {
    return reply.sendFile('login.html'); // looks inside the `root` defined earlier
  });
}

export default routes;