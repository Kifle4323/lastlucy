import { BaseController } from '../core/BaseController.js';
import { MaterialService } from '../services/MaterialService.js';

export class MaterialController extends BaseController {
  constructor() {
    super();
    this.materialService = new MaterialService();
    
  }

  setupRoutes() {
    this.rolePost('/courses/:courseId/materials', (req, res) => this.createMaterial(req, res), ['TEACHER']);
    this.authGet('/courses/:courseId/materials', (req, res) => this.getMaterials(req, res));
    this.rolePatch('/materials/:materialId', (req, res) => this.updateMaterial(req, res), ['TEACHER']);
    this.roleDelete('/materials/:materialId', (req, res) => this.deleteMaterial(req, res), ['TEACHER']);
    this.authGet('/materials/:materialId/preview', (req, res) => this.getPreview(req, res));
    this.get('/materials/:materialId/file', (req, res) => this.getFile(req, res));
    this.authGet('/materials/:materialId/html', (req, res) => this.getHtmlView(req, res));
    this.rolePost('/materials/:materialId/progress', (req, res) => this.updateProgress(req, res), ['STUDENT']);
    this.authGet('/courses/:courseId/materials/progress', (req, res) => this.getProgress(req, res));
    this.roleGet('/materials/:materialId/video-tracking', (req, res) => this.getVideoTracking(req, res), ['TEACHER']);
  }

  async createMaterial(req, res) {
    const material = await this.materialService.createMaterial(req.user, { ...req.body, courseId: req.params.courseId });
    res.status(201).json(material);
  }

  async getMaterials(req, res) {
    const materials = await this.materialService.getMaterials(req.params.courseId);
    res.json(materials);
  }

  async updateMaterial(req, res) {
    const material = await this.materialService.updateMaterial(req.params.materialId, req.user, req.body);
    res.json(material);
  }

  async deleteMaterial(req, res) {
    await this.materialService.deleteMaterial(req.params.materialId, req.user);
    res.json({ success: true });
  }

  async getPreview(req, res) {
    const material = await this.materialService.getPreview(req.params.materialId);
    res.json(material);
  }

  async getFile(req, res) {
    const material = await this.materialService.getFile(req.params.materialId);
    if (!material || !material.fileUrl) {
      return res.status(404).json({ error: 'File not found' });
    }

    // If it's a data URL (base64), decode and serve the raw file
    if (material.fileUrl.startsWith('data:')) {
      const matches = material.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Invalid data URL' });
      }
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = material.fileName || `${material.title}.${material.fileType || 'bin'}`;

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(buffer);
    }

    // If it's a regular URL, redirect to it
    return res.redirect(material.fileUrl);
  }

  async getHtmlView(req, res) {
    const { materialId } = req.params;
    const user = req.user;

    const material = await this.materialService.getHtmlView(materialId);
    if (!material) return res.status(404).json({ error: 'not_found' });

    // Access permission check
    if (user.role !== 'ADMIN') {
      if (user.role === 'TEACHER') {
        const courseSection = await this.materialService.repository.prisma.courseSection.findFirst({
          where: { courseId: material.courseId, teacherId: user.id },
        });
        const courseClass = await this.materialService.repository.prisma.courseClass.findFirst({
          where: { courseId: material.courseId, teacherId: user.id },
        });
        if (!courseSection && !courseClass) return res.status(403).json({ error: 'forbidden' });
      } else {
        const enrollment = await this.materialService.repository.prisma.studentEnrollment.findFirst({
          where: { studentId: user.id, status: 'ENROLLED', courseSection: { courseId: material.courseId } },
        });
        const courseClass = await this.materialService.repository.prisma.courseClass.findFirst({
          where: { courseId: material.courseId, class: { students: { some: { studentId: user.id } } } },
        });
        if (!enrollment && !courseClass) return res.status(403).json({ error: 'forbidden' });
      }
    }

    // If HTML content already cached, serve it
    if (material.htmlContent) {
      const htmlWithApi = material.htmlContent.replace(
        "const apiBase = '';",
        `const apiBase = '${process.env.API_URL || ''}';`
      );
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(htmlWithApi);
    }

    // PPTX/PPT/DOCX/DOC: convert on-demand using python scripts (COM automation on Windows)
    const convertibleTypes = ['pptx', 'ppt', 'docx', 'doc'];
    if (convertibleTypes.includes(material.fileType) && material.fileUrl) {
      const isDocType = material.fileType === 'docx' || material.fileType === 'doc';
      const htmlContent = isDocType
        ? await this.materialService.convertDocxToHtmlBase64(material.fileUrl, material.fileType, materialId)
        : await this.materialService.convertPptxToHtmlBase64(material.fileUrl, material.fileType, materialId);
      if (htmlContent) {
        await this.materialService.repository.prisma.material.update({
          where: { id: materialId },
          data: { htmlContent },
        });
        const htmlWithApi = htmlContent.replace(
          "const apiBase = '';",
          `const apiBase = '${process.env.API_URL || ''}';`
        );
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(htmlWithApi);
      }
    }

    return res.status(404).json({ error: 'HTML version not available for this material' });
  }

  async updateProgress(req, res) {
    const result = await this.materialService.updateReadingProgress(req.params.materialId, req.user, req.body);
    res.json(result);
  }

  async getProgress(req, res) {
    const materials = await this.materialService.getReadingProgress(req.params.courseId, req.user);
    res.json(materials);
  }

  async getVideoTracking(req, res) {
    const stats = await this.materialService.getVideoTrackingStats(req.params.materialId, req.user);
    res.json(stats);
  }
}
