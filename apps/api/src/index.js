import 'express-async-errors';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { AuthController } from './controllers/AuthController.js';
import { CourseController } from './controllers/CourseController.js';
import { AssessmentController } from './controllers/AssessmentController.js';
import { ClassController } from './controllers/ClassController.js';
import { MaterialController } from './controllers/MaterialController.js';
import { LiveSessionController } from './controllers/LiveSessionController.js';
import { GradebookController } from './controllers/GradebookController.js';
import { FaceVerificationController } from './controllers/FaceVerificationController.js';
import { StudentProfileController } from './controllers/StudentProfileController.js';
import { NotificationController } from './controllers/NotificationController.js';
import { AcademicController } from './controllers/AcademicController.js';
import { AddDropController } from './controllers/AddDropController.js';
import { QuestionReportController } from './controllers/QuestionReportController.js';
import { AnalyticsController } from './controllers/AnalyticsController.js';
import { PaymentController } from './controllers/PaymentController.js';
import { DepartmentController } from './controllers/DepartmentController.js';
import { MLController } from './controllers/MLController.js';
import { AppError } from './core/AppError.js';
import { SchedulerService } from './services/SchedulerService.js';

dotenv.config();

const app = express();

// Parse CORS origins from env (comma-separated)
const corsOrigin = process.env.CORS_ORIGIN;
const corsOrigins = corsOrigin && corsOrigin !== '*'
  ? corsOrigin.split(',').map(o => o.trim())
  : true;

app.use(
  cors({
    origin: corsOrigins,
    credentials: corsOrigins === true ? false : true,
  }),
);
app.use(express.json({ limit: '300mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Register all controllers (each registers its own routes under /api prefix)
const controllers = [
  new AuthController(),
  new CourseController(),
  new AssessmentController(),
  new ClassController(),
  new MaterialController(),
  new LiveSessionController(),
  new GradebookController(),
  new FaceVerificationController(),
  new StudentProfileController(),
  new NotificationController(),
  new AcademicController(),
  new AddDropController(),
  new QuestionReportController(),
  new AnalyticsController(),
  new PaymentController(),
  new DepartmentController(),
  new MLController(),
];

for (const controller of controllers) {
  controller.registerRoutes(app, '/api');
}

// Global error handler
app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }
  // Handle Zod validation errors
  if (err.name === 'ZodError' && Array.isArray(err.errors)) {
    return res.status(400).json({ error: 'validation_error', message: err.errors.map(e => e.message).join(', '), details: err.errors });
  }
  console.error('Unhandled error:', err);
  const message = err instanceof Error ? err.message : 'internal_error';
  res.status(500).json({ error: 'internal_error', message });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`API listening on http://localhost:${port} (network accessible)\n`);
  // Start scheduled notification checks
  const scheduler = new SchedulerService();
  scheduler.start();
});
