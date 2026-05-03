import { BaseController } from '../core/BaseController.js';
import { AuthService } from '../services/AuthService.js';
import { JwtService } from '../core/JwtService.js';

export class AuthController extends BaseController {
  constructor() {
    super();
    this.authService = new AuthService();
    
  }

  setupRoutes() {
    // Public routes
    this.post('/auth/register', (req, res) => this.register(req, res));
    this.post('/auth/login', (req, res) => this.login(req, res));
    this.post('/auth/refresh', (req, res) => this.refresh(req, res));

    // Authenticated routes
    this.authGet('/auth/me', (req, res) => this.getMe(req, res));
    this.authPatch('/users/me/password', (req, res) => this.changePassword(req, res));

    // Users list
    this.roleGet('/users', (req, res) => this.getUsers(req, res), ['ADMIN']);

    // Admin routes
    this.rolePost('/admin/users', (req, res) => this.adminCreateUser(req, res), ['ADMIN']);
    this.roleGet('/admin/users/pending', (req, res) => this.getPendingUsers(req, res), ['ADMIN']);
    this.rolePost('/admin/users/:userId/approve', (req, res) => this.approveUser(req, res), ['ADMIN']);
    this.rolePost('/admin/users/:userId/reset-password', (req, res) => this.adminResetPassword(req, res), ['ADMIN']);
    this.rolePatch('/admin/users/:userId', (req, res) => this.adminUpdateUser(req, res), ['ADMIN']);
    this.roleDelete('/admin/users/:userId', (req, res) => this.deleteUser(req, res), ['ADMIN']);
  }

  async register(req, res) {
    const result = await this.authService.register(req.body);
    res.status(201).json(result);
  }

  async login(req, res) {
    const result = await this.authService.login(req.body);
    res.json(result);
  }

  async refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });
    try {
      const payload = JwtService.verifyRefreshToken(refreshToken);
      const accessToken = JwtService.signAccessToken({ sub: payload.sub, role: payload.role });
      const newRefreshToken = JwtService.signRefreshToken({ sub: payload.sub, role: payload.role });
      res.json({ accessToken, refreshToken: newRefreshToken });
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  }

  async getMe(req, res) {
    const user = await this.authService.getMe(req.user.id);
    res.json(user);
  }

  async getUsers(req, res) {
    const users = await this.authService.getUsers(req.query);
    res.json(users);
  }

  async adminCreateUser(req, res) {
    const user = await this.authService.adminCreateUser(req.user, req.body);
    res.status(201).json(user);
  }

  async getPendingUsers(req, res) {
    const users = await this.authService.getPendingUsers();
    res.json(users);
  }

  async approveUser(req, res) {
    const user = await this.authService.approveUser(req.user, req.params.userId);
    res.json(user);
  }

  async deleteUser(req, res) {
    await this.authService.deleteUser(req.user, req.params.userId);
    res.json({ success: true });
  }

  async changePassword(req, res) {
    await this.authService.changePassword(req.user.id, req.body);
    res.json({ success: true });
  }

  async adminResetPassword(req, res) {
    const result = await this.authService.adminResetPassword(req.user, req.params.userId, req.body);
    res.json(result);
  }

  async adminUpdateUser(req, res) {
    const result = await this.authService.adminUpdateUser(req.user, req.params.userId, req.body);
    res.json(result);
  }
}
