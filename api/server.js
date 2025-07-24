import Fastify from 'fastify'
import fastifyPostgres from '@fastify/postgres';
import fastifyCors from '@fastify/cors'
import fastifyJwt from '@fastify/jwt'; // Add JWT plugin
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import userRoute from './routes/user.js'
import mainRoute from './routes/main.js'
import publicRoute from './routes/public.js'
import authRoute from './routes/auth.js' // Add auth routes


// Create fasitfy instance
const fastify = Fastify({
  logger: true
})

// await fastify.register(fastifyCors, {
//   origin: '*',  // อนุญาตทุก origin ถ้าต้องการจำกัดให้ใส่ URL frontend เช่น 'http://localhost:5500'
//   methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
//   allowedHeaders: ['Content-Type'], // Allowed headers
// })

// Register JWT plugin
await fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'secret-key'
});

// Required for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// Connect to DB
fastify.register(fastifyPostgres, {
  connectionString: 'postgres://radius:radiuspassword@localhost:5432/radius'
});
fastify.register(authRoute)
fastify.register(mainRoute)
fastify.register(userRoute)
fastify.register(publicRoute)


/**
 * Run the server!
 */
const start = async () => {
  try {
    await fastify.listen({ port: 3002 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}



start()