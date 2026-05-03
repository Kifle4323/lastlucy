// @ts-nocheck
import type { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authRequired, requireRole, type AuthedRequest } from '../middleware';

export function registerStudentProfileRoutes(router: Router) {
  // === STUDENT ROUTES ===

  // Get own profile
  router.get('/student/profile', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: { documents: true },
    });

    if (!profile) {
      // Create empty profile if doesn't exist
      const newProfile = await prisma.studentProfile.create({
        data: { userId: req.user!.id },
        include: { documents: true },
      });
      res.json(newProfile);
      return;
    }

    res.json(profile);
  });

  // Save profile (draft or submit for approval)
  router.patch('/student/profile', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    try {
      const body = z.object({
      // Basic Information
      firstName: z.string().nullable().optional(),
      fatherName: z.string().nullable().optional(),
      grandFatherName: z.string().nullable().optional(),
      firstNameLocal: z.string().nullable().optional(),
      fatherNameLocal: z.string().nullable().optional(),
      grandFatherNameLocal: z.string().nullable().optional(),
      dateOfBirthGC: z.string().nullable().optional(),
      gender: z.string().nullable().optional(),
      placeOfBirth: z.string().nullable().optional(),
      motherTongue: z.string().nullable().optional(),
      healthStatus: z.string().nullable().optional(),
      maritalStatus: z.string().nullable().optional(),
      nationalIdFan: z.string().nullable().optional().refine(v => !v || /^\d{16}$/.test(v), 'National ID (FAN) must be exactly 16 digits'),
      // Location and Address
      citizenship: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      subCity: z.string().nullable().optional(),
      kebele: z.string().nullable().optional(),
      woreda: z.string().nullable().optional(),
      houseNumber: z.string().nullable().optional(),
      phone: z.string().nullable().optional().refine(v => !v || /^(\+?251|0)?9\d{8}$/.test(v.replace(/\s/g, '')), 'Invalid Ethiopian phone number (e.g. 0912345678 or +251912345678)'),
      email: z.string().nullable().optional(),
      pobox: z.string().nullable().optional(),
      // Others
      economicalStatus: z.string().nullable().optional(),
      areaType: z.string().nullable().optional(),
      tinNumber: z.string().nullable().optional().refine(v => !v || /^\d{10}$/.test(v), 'TIN number must be exactly 10 digits'),
      accountNumber: z.string().nullable().optional().refine(v => !v || /^\d{10,18}$/.test(v), 'Account number must be 10-18 digits'),
      // Educational - Campus Related
      stream: z.string().nullable().optional(),
      entryYear: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional(),
      sponsorCategory: z.string().nullable().optional(),
      sponsoredBy: z.string().nullable().optional(),
      nationalExamYearEC: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional(),
      examinationId: z.string().nullable().optional(),
      admissionDate: z.string().nullable().optional(),
      checkedInDate: z.string().nullable().optional(),
      nationalExamResultTotal: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional(),
      // National Exam Results
      examEnglish: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'English result cannot exceed 100'),
      examPhysics: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Physics result cannot exceed 100'),
      examCivics: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Civics result cannot exceed 100'),
      examNaturalMath: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Natural Math result cannot exceed 100'),
      examChemistry: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Chemistry result cannot exceed 100'),
      examBiology: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Biology result cannot exceed 100'),
      examAptitude: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Aptitude result cannot exceed 100'),
      // Social Science exam results
      examHistory: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'History result cannot exceed 100'),
      examEconomics: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Economics result cannot exceed 100'),
      examGeography: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Geography result cannot exceed 100'),
      examSocialMath: z.union([z.number(), z.string().transform(v => v === '' ? undefined : parseInt(v))]).nullable().optional().refine(v => v == null || v <= 100, 'Social Math result cannot exceed 100'),
      // Submit action
      submitForApproval: z.boolean().optional(),
    }).parse(req.body);

    // Check if profile exists
    let profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      profile = await prisma.studentProfile.create({
        data: { userId: req.user!.id },
      });
    }

    // Update profile
    const updateData: any = {
      ...body,
      dateOfBirthGC: body.dateOfBirthGC ? new Date(body.dateOfBirthGC) : undefined,
      admissionDate: body.admissionDate ? new Date(body.admissionDate) : undefined,
      checkedInDate: body.checkedInDate ? new Date(body.checkedInDate) : undefined,
    };

    // Remove submitForApproval from updateData (it's not a database field)
    delete updateData.submitForApproval;

    // Validate required fields when submitting for approval
    if (body.submitForApproval) {
      const requiredFields = [
        'firstName', 'fatherName', 'grandFatherName',
        'dateOfBirthGC', 'gender', 'placeOfBirth',
        'citizenship', 'country', 'city', 'phone',
        'stream', 'entryYear'
      ];
      
      const missingFields = requiredFields.filter(field => {
        const value = updateData[field] || profile[field];
        return !value || (typeof value === 'string' && value.trim() === '');
      });
      
      if (missingFields.length > 0) {
        res.status(400).json({ 
          error: 'Please fill in all required fields',
          missingFields 
        });
        return;
      }
      
      // Check if at least one document is uploaded
      const documents = await prisma.studentDocument.findMany({
        where: { studentProfileId: profile.id }
      });
      
      if (documents.length === 0) {
        res.status(400).json({ 
          error: 'Please upload at least one document before submitting' 
        });
        return;
      }
      
      updateData.status = 'PENDING_APPROVAL';
    }

    const updatedProfile = await prisma.studentProfile.update({
      where: { userId: req.user!.id },
      data: updateData,
      include: { documents: true },
    });

    res.json(updatedProfile);
    } catch (err) {
      console.error('Error updating student profile:', err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: err.errors });
        return;
      }
      res.status(500).json({ error: 'Failed to update profile', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // Upload document
  router.post('/student/profile/documents', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const body = z.object({
      documentType: z.string(),
      fileName: z.string().optional(),
      fileUrl: z.string(), // Base64 encoded file
    }).parse(req.body);

    // Ensure profile exists
    let profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      profile = await prisma.studentProfile.create({
        data: { userId: req.user!.id },
      });
    }

    // Check if document type already exists
    const existing = await prisma.studentDocument.findFirst({
      where: { studentProfileId: profile.id, documentType: body.documentType },
    });

    if (existing) {
      // Update existing document
      const updated = await prisma.studentDocument.update({
        where: { id: existing.id },
        data: {
          fileName: body.fileName,
          fileUrl: body.fileUrl,
          status: 'SUBMITTED',
          uploadedAt: new Date(),
        },
      });
      res.json(updated);
      return;
    }

    // Create new document
    const document = await prisma.studentDocument.create({
      data: {
        studentProfileId: profile.id,
        documentType: body.documentType,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        status: 'SUBMITTED',
        uploadedAt: new Date(),
      },
    });

    res.json(document);
  });

  // Delete document
  router.delete('/student/profile/documents/:documentId', authRequired, requireRole(['STUDENT']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ documentId: z.string() }).parse(req.params);

    const document = await prisma.studentDocument.findUnique({
      where: { id: params.documentId },
      include: { studentProfile: true },
    });

    if (!document || document.studentProfile.userId !== req.user!.id) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    await prisma.studentDocument.delete({
      where: { id: params.documentId },
    });

    res.json({ success: true });
  });

  // === ADMIN ROUTES ===

  // Get all pending profiles
  router.get('/admin/student-profiles/pending', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const profiles = await prisma.studentProfile.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        documents: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(profiles);
  });

  // Get all profiles (with filter)
  router.get('/admin/student-profiles', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const query = z.object({
      status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
    }).parse(req.query);

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }

    const profiles = await prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, fullName: true, profileImage: true } },
        documents: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(profiles);
  });

  // Get single profile
  router.get('/admin/student-profiles/:profileId', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ profileId: z.string() }).parse(req.params);

    const profile = await prisma.studentProfile.findUnique({
      where: { id: params.profileId },
      include: {
        user: { select: { id: true, email: true, fullName: true, profileImage: true, createdAt: true } },
        documents: true,
      },
    });

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json(profile);
  });

  // Approve profile
  router.post('/admin/student-profiles/:profileId/approve', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ profileId: z.string() }).parse(req.params);

    const profile = await prisma.studentProfile.update({
      where: { id: params.profileId },
      data: {
        status: 'APPROVED',
        adminReviewedBy: req.user!.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        documents: true,
      },
    });

    res.json(profile);
  });

  // Reject profile
  router.post('/admin/student-profiles/:profileId/reject', authRequired, requireRole(['ADMIN']), async (req: AuthedRequest, res: Response) => {
    const params = z.object({ profileId: z.string() }).parse(req.params);
    const body = z.object({ reason: z.string().min(1) }).parse(req.body);

    const profile = await prisma.studentProfile.update({
      where: { id: params.profileId },
      data: {
        status: 'REJECTED',
        adminReviewedBy: req.user!.id,
        reviewedAt: new Date(),
        rejectionReason: body.reason,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        documents: true,
      },
    });

    res.json(profile);
  });
}
