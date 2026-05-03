import { BaseController } from '../core/BaseController.js';
import { MLService } from '../services/MLService.js';

export class MLController extends BaseController {
  constructor() {
    super();
    this.mlService = new MLService();
    
  }

  setupRoutes() {
    this.authPost('/ml/train', (req, res) => this.trainModel(req, res));
    this.authGet('/ml/analytics', (req, res) => this.getAnalytics(req, res));
    this.authGet('/ml/feature-importance', (req, res) => this.getFeatureImportance(req, res));
    this.authPost('/ml/predict', (req, res) => this.predict(req, res));
    this.authGet('/ml/predict-student/:studentId', (req, res) => this.predictById(req, res));
  }

  async trainModel(req, res) {
    const result = await this.mlService.trainModel();
    res.json(result);
  }

  async getAnalytics(req, res) {
    const data = await this.mlService.getAnalytics();
    res.json(data);
  }

  async getFeatureImportance(req, res) {
    const data = await this.mlService.getFeatureImportance();
    res.json(data);
  }

  async predict(req, res) {
    const result = await this.mlService.predict(req.body);
    res.json(result);
  }

  async predictById(req, res) {
    // Students can only predict for themselves
    if (req.user.role === 'STUDENT' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ error: 'You can only view your own predictions' });
    }
    const result = await this.mlService.predictById(req.params.studentId);
    res.json(result);
  }
}
