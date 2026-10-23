/**
 * Employee Management System (EMS) — Backend API Entry Point
 * Stage 1A: Basic Server Foundation & Health Endpoint
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing (CORS) so future Web and Mobile clients can connect
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

/**
 * Health Check Endpoint
 * GET /api/health
 * Used by clients and monitoring tools to verify the server is running.
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Employee Management System API',
    stage: '1A - Backend Foundation',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the EMS Backend API. Visit /api/health to check server status.'
  });
});

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal server error'
  });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`[EMS Server] Backend running at http://localhost:${PORT}`);
  console.log(`[EMS Server] Health check available at http://localhost:${PORT}/api/health`);
});

module.exports = { app, server };
