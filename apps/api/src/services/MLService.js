import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

export class MLService extends BaseService {
  constructor() {
    super(null);
  }

  async trainModel() {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/ml/train`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'ML service error' }));
        throw new AppError(response.status, 'ml_error', err.detail || 'ML training failed', err);
      }
      return response.json();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw AppError.serviceUnavailable('ml_unavailable', 'ML service is not available');
    }
  }

  async getAnalytics() {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/ml/analytics`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'ML analytics error' }));
        throw new AppError(response.status, 'ml_error', err.detail || 'Failed to fetch ML analytics');
      }
      return response.json();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw AppError.serviceUnavailable('ml_unavailable', 'ML service is not available');
    }
  }

  async getFeatureImportance() {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/ml/feature-importance`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'ML feature importance error' }));
        throw new AppError(response.status, 'ml_error', err.detail || 'Failed to fetch feature importance');
      }
      return response.json();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw AppError.serviceUnavailable('ml_unavailable', 'ML service is not available');
    }
  }

  async predict(features) {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/ml/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Prediction error' }));
        throw new AppError(response.status, 'ml_error', err.detail || 'Prediction failed');
      }
      return response.json();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw AppError.serviceUnavailable('ml_unavailable', 'ML service is not available');
    }
  }

  async predictById(studentId) {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/ml/predict-student/${studentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Prediction error' }));
        throw new AppError(response.status, 'ml_error', err.detail || 'Prediction failed');
      }
      return response.json();
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw AppError.serviceUnavailable('ml_unavailable', 'ML service is not available');
    }
  }
}
