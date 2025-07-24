// auth.js - Authentication routes and middleware
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';
const JWT_EXPIRES_IN = '24h';

// In-memory admin users (you can move this to database later)
const adminUsers = [
  {
    id: 1,
    username: 'admin',
    password: '$2a$12$B7Tp3CvC3Q5vh8shlCN6x.9OBckFizBvTmrato7Cg8RLcrhAmwRn6',
    role: 'admin'
  }
];

async function authRoutes(fastify, options) {
  // Login endpoint
  fastify.post('/auth/login', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.code(400).send({ 
        error: 'Username and password are required' 
      });
    }

    try {
      // Find user (you can replace this with database query)
      const user = adminUsers.find(u => u.username === username);
      
      if (!user) {
        return reply.code(401).send({ 
          error: 'Invalid credentials' 
        });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return reply.code(401).send({ 
          error: 'Invalid credentials' 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      reply.send({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });

    } catch (error) {
      fastify.log.error('Login error:', error);
      reply.code(500).send({ error: 'Login failed' });
    }
  });

  // Token verification endpoint
  fastify.get('/auth/verify', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return reply.code(401).send({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      reply.send({ 
        valid: true, 
        user: decoded 
      });

    } catch (error) {
      reply.code(401).send({ 
        valid: false, 
        error: 'Invalid token' 
      });
    }
  });

  // Logout endpoint (optional - mainly for frontend)
  fastify.post('/auth/logout', async (request, reply) => {
    // With JWT, logout is mainly handled on frontend by removing token
    reply.send({ message: 'Logged out successfully' });
  });
}

// Authentication middleware
export const authenticateToken = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return reply.code(401).send({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    request.user = decoded; // Add user info to request object
    
  } catch (error) {
    return reply.code(403).send({ error: 'Invalid or expired token' });
  }
};

// Admin role middleware
export const requireAdmin = async (request, reply) => {
  if (!request.user || request.user.role !== 'admin') {
    return reply.code(403).send({ error: 'Admin access required' });
  }
};

// Utility function to hash password (for creating new admin users)
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

export default authRoutes;