import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { AuditLogger } from '../core/AuditLogger.js';
import path from 'path';
import fs from 'fs';
import tmp from 'tmp';
import { execSync, spawn } from 'child_process';

export class MaterialService extends BaseService {
  constructor() {
    super(new MaterialRepository());
  }

  async createMaterial(user, body) {
    const schema = z.object({
      courseId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      fileUrl: z.string().optional().default(''),
      fileType: z.string(),
      fileName: z.string().optional(),
    });
    const data = schema.parse(body);

    // Validate: file types require a file, link/video require a URL, text requires content
    const fileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
    const urlTypes = ['link'];
    if (fileTypes.includes(data.fileType) && !data.fileUrl) {
      throw AppError.badRequest('missing_file', `File upload is required for type '${data.fileType}'`);
    }
    if (urlTypes.includes(data.fileType) && !data.fileUrl) {
      throw AppError.badRequest('missing_url', 'URL is required for link materials');
    }
    if (data.fileType === 'video' && !data.fileUrl) {
      throw AppError.badRequest('missing_video', 'Video URL or file is required');
    }

    // Verify teacher access
    const courseSection = await this.repository.prisma.courseSection.findFirst({
      where: { courseId: data.courseId, teacherId: user.id },
    });
    const courseClass = await this.repository.prisma.courseClass.findFirst({
      where: { courseId: data.courseId, teacherId: user.id },
    });
    this.throwUnless(courseSection || courseClass, 403, 'forbidden', 'You are not assigned to this course');

    const { courseId, ...rest } = data;
    const material = await this.repository.create({
      data: { ...rest, course: { connect: { id: courseId } }, author: { connect: { id: user.id } } },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    });

    await AuditLogger.log({ action: 'CREATE', category: 'COURSE', userId: user.id, targetId: material.id, description: `Material created: ${material.title}` });
    return material;
  }

  async getMaterials(courseId) {
    return this.repository.findByCourse(courseId);
  }

  async updateMaterial(materialId, user, body) {
    const material = await this.repository.findById(materialId);
    this.throwUnless(material, 404, 'not_found', 'Material not found');
    this.throwUnless(material.authorId === user.id || user.role === 'ADMIN', 403, 'forbidden', 'Not authorized');

    return this.repository.update(materialId, body);
  }

  async deleteMaterial(materialId, user) {
    const material = await this.repository.findById(materialId);
    this.throwUnless(material, 404, 'not_found', 'Material not found');
    this.throwUnless(material.authorId === user.id || user.role === 'ADMIN', 403, 'forbidden', 'Not authorized');

    await this.repository.delete(materialId);
  }

  async getPreview(materialId) {
    const material = await this.repository.findForPreview(materialId);
    this.throwUnless(material, 404, 'not_found', 'Material not found');
    return material;
  }

  async getFile(materialId) {
    const material = await this.repository.findForFile(materialId);
    this.throwUnless(material, 404, 'not_found', 'Material not found');
    return material;
  }

  async getHtmlView(materialId) {
    const material = await this.repository.findForHtml(materialId);
    this.throwUnless(material, 404, 'not_found', 'Material not found');
    return material;
  }

  async updateReadingProgress(materialId, user, body) {
    const schema = z.object({
      slideIndex: z.number().int().min(0),
      totalSlides: z.number().int().min(1),
    });
    const data = schema.parse(body);

    const material = await this.repository.findForProgress(materialId);
    this.throwUnless(material, 404, 'not_found', 'Material not found');

    const progress = Math.round((data.slideIndex / data.totalSlides) * 100);

    await this.repository.prisma.materialView.upsert({
      where: { materialId_studentId: { materialId, studentId: user.id } },
      update: { progress, lastViewedAt: new Date() },
      create: { material: { connect: { id: materialId } }, student: { connect: { id: user.id } }, progress, lastViewedAt: new Date() },
    });

    return { progress };
  }

  async getReadingProgress(courseId, user) {
    const materials = await this.repository.findWithStats(courseId);
    return materials;
  }

  async getVideoTrackingStats(materialId, user) {
    const material = await this.repository.prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, title: true, fileType: true, courseId: true },
    });
    this.throwUnless(material, 404, 'not_found', 'Material not found');
    this.throwUnless(material.fileType === 'video', 400, 'invalid_type', 'Material is not a video');

    // Get all views for this video
    const views = await this.repository.prisma.materialView.findMany({
      where: { materialId },
      include: { student: { select: { id: true, fullName: true, email: true, profileImage: true } } },
      orderBy: { openedAt: 'desc' },
    });

    // Get face verifications for this video
    const faceVerifications = await this.repository.prisma.videoFaceVerification.findMany({
      where: { materialId },
    });

    // Build a map of studentId -> face verification
    const faceMap = {};
    faceVerifications.forEach(fv => { faceMap[fv.studentId] = fv; });

    // Get total enrolled students for the course
    const enrollments = await this.repository.prisma.studentEnrollment.findMany({
      where: { courseSection: { courseId: material.courseId }, status: 'ENROLLED' },
      include: { student: { select: { id: true, fullName: true } } },
    });
    const totalStudents = enrollments.length;

    // Deduplicate views per student (keep latest)
    const latestViewMap = {};
    views.forEach(v => {
      if (!latestViewMap[v.studentId] || new Date(v.openedAt) > new Date(latestViewMap[v.studentId].openedAt)) {
        latestViewMap[v.studentId] = v;
      }
    });
    const uniqueViews = Object.values(latestViewMap);

    // Combine view + face data per student
    const studentTracking = uniqueViews.map(v => {
      const face = faceMap[v.studentId];
      return {
        studentId: v.studentId,
        studentName: v.student.fullName,
        studentEmail: v.student.email,
        studentImage: v.student.profileImage,
        openedAt: v.openedAt,
        closedAt: v.closedAt,
        durationSec: v.durationSec,
        faceVerified: face ? face.matchResult : null,
        faceReviewed: face ? face.adminReviewed : null,
        faceApproved: face ? face.adminApproved : null,
        capturedImage: face ? face.capturedImage : null,
      };
    });

    // Students who haven't viewed
    const viewedIds = new Set(uniqueViews.map(v => v.studentId));
    const notViewed = enrollments.filter(e => !viewedIds.has(e.student.id)).map(e => ({
      studentId: e.student.id,
      studentName: e.student.fullName,
      openedAt: null,
      durationSec: 0,
      faceVerified: null,
    }));

    const matched = faceVerifications.filter(f => f.matchResult).length;
    const mismatched = faceVerifications.filter(f => !f.matchResult).length;
    const viewCount = uniqueViews.length;

    return {
      materialId,
      materialTitle: material.title,
      totalStudents,
      viewCount,
      viewPercent: totalStudents > 0 ? Math.round((viewCount / totalStudents) * 100) : 0,
      faceMatched: matched,
      faceMismatched: mismatched,
      students: [...studentTracking, ...notViewed],
    };
  }

  // Convert office documents to PDF for preview
  async convertToPdf(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.pdf'].includes(ext)) return filePath;

    if (['.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx'].includes(ext)) {
      const tmpObj = tmp.fileSync({ postfix: '.pdf' });
      try {
        const libreConvert = (await import('libreoffice-convert')).default;
        const inputBuf = fs.readFileSync(filePath);
        const pdfBuf = await new Promise((resolve, reject) => {
          libreConvert.convert(inputBuf, '.pdf', undefined, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        fs.writeFileSync(tmpObj.name, pdfBuf);
        return tmpObj.name;
      } catch (err) {
        tmpObj.removeCallback();
        throw AppError.internal('Failed to convert document: ' + err.message);
      }
    }

    return filePath;
  }

  // Convert PPTX to HTML for interactive viewing (old method, kept for compatibility)
  async convertPptxToHtml(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pptx') return null;

    try {
      const tmpDir = tmp.dirSync({ unsafeCleanup: true });
      const scriptPath = path.join(process.cwd(), 'scripts', 'pptx2html.py');
      execSync(`python3 "${scriptPath}" "${filePath}" "${tmpDir.name}"`, { stdio: 'pipe' });
      const htmlFile = path.join(tmpDir.name, 'index.html');
      if (fs.existsSync(htmlFile)) return { htmlDir: tmpDir.name, htmlFile };
      return null;
    } catch (err) {
      throw AppError.internal('Failed to convert PPTX: ' + err.message);
    }
  }

  // Convert PPTX from base64 data URL to HTML string using python-pptx script
  async convertPptxToHtmlBase64(fileUrl, fileType, materialId) {
    if (!fileUrl.startsWith('data:')) return null;

    return new Promise((resolve) => {
      tmp.file({ postfix: `.${fileType}`, keep: true }, (err, tmpPath, fd, cleanup) => {
        if (err) { console.error('tmp file error:', err); resolve(null); return; }

        try {
          const matches = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) { cleanup(); resolve(null); return; }

          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(tmpPath, buffer);
          fs.closeSync(fd);

          const outputPath = tmpPath + '.html';
          const scriptPath = path.join(process.cwd(), 'scripts', 'pptx_to_html.py');
          const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

          console.log(`Converting PPTX: ${pythonCommand} ${scriptPath} ${tmpPath} ${outputPath}`);

          const python = spawn(pythonCommand, [scriptPath, tmpPath, outputPath, '--material-id', materialId], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
          });

          let errorOutput = '';
          python.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });

          python.on('close', (code) => {
            try { fs.unlinkSync(tmpPath); } catch (_) {}

            if (code !== 0) {
              console.error('PPTX conversion error:', errorOutput);
              resolve(null);
              return;
            }

            try {
              const htmlContent = fs.readFileSync(outputPath, 'utf-8');
              try { fs.unlinkSync(outputPath); } catch (_) {}
              resolve(htmlContent);
            } catch (readErr) {
              console.error('Error reading HTML file:', readErr);
              resolve(null);
            }
          });
        } catch (writeErr) {
          console.error('Error writing temp file:', writeErr);
          cleanup();
          resolve(null);
        }
      });
    });
  }

  // Convert DOC/DOCX from base64 data URL to HTML string using docx_to_html.py script
  async convertDocxToHtmlBase64(fileUrl, fileType, materialId) {
    if (!fileUrl.startsWith('data:')) return null;

    return new Promise((resolve) => {
      tmp.file({ postfix: `.${fileType}`, keep: true }, (err, tmpPath, fd, cleanup) => {
        if (err) { console.error('tmp file error:', err); resolve(null); return; }

        try {
          const matches = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) { cleanup(); resolve(null); return; }

          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(tmpPath, buffer);
          fs.closeSync(fd);

          const outputPath = tmpPath + '.html';
          const scriptPath = path.join(process.cwd(), 'scripts', 'docx_to_html.py');
          const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

          console.log(`Converting DOCX/DOC: ${pythonCommand} ${scriptPath} ${tmpPath} ${outputPath}`);

          const python = spawn(pythonCommand, [scriptPath, tmpPath, outputPath, '--material-id', materialId], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
          });

          let errorOutput = '';
          python.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });

          python.on('close', (code) => {
            try { fs.unlinkSync(tmpPath); } catch (_) {}

            if (code !== 0) {
              console.error('DOCX/DOC conversion error:', errorOutput);
              resolve(null);
              return;
            }

            try {
              const htmlContent = fs.readFileSync(outputPath, 'utf-8');
              try { fs.unlinkSync(outputPath); } catch (_) {}
              resolve(htmlContent);
            } catch (readErr) {
              console.error('Error reading HTML file:', readErr);
              resolve(null);
            }
          });
        } catch (writeErr) {
          console.error('Error writing temp file:', writeErr);
          cleanup();
          resolve(null);
        }
      });
    });
  }
}
