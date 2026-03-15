import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Keep-alive headers for long-running requests
app.use((req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=300');
    next();
});

// Routes
app.use('/api', apiRouter);

// Root route
app.get('/', (req, res) => {
    res.json({
        service: 'SP Compliance API',
        status: 'running',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            api: '/api/status'
        }
    });
});

// Healthcheck
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'ConsultaSP Backend Service is running' });
});

const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// Increase keep-alive and headers timeout to match Cloud Run's 300s limit
server.keepAliveTimeout = 310000; // 310s (slightly above Cloud Run's 300s)
server.headersTimeout = 320000;   // 320s (must be > keepAliveTimeout)

// Prevent process from dying on unhandled errors
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});
