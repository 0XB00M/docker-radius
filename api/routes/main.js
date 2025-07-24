
async function routes(fastify, options) {
  fastify.get('/', async (request, reply) => {
    return reply.sendFile('management.html'); // looks inside the `root` defined earlier
  });
}

export default routes;