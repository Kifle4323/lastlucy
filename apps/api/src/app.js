import 'express-async-errors';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

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
import { AppError } from './core/AppError.js';

const app = express();

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : true;

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '300mb' }));

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
];

for (const controller of controllers) {
  controller.registerRoutes(app, '/api');
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }
  const message = err instanceof Error ? err.message : 'internal_error';
  res.status(500).json({ error: 'internal_error', message });
});

export default app;
