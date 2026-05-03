import { z } from 'zod';
import { BaseService } from '../core/BaseService.js';
import { AppError } from '../core/AppError.js';
import { StudentProfileRepository } from '../repositories/StudentProfileRepository.js';

export class StudentProfileService extends BaseService {
  constructor() {
    super(new StudentProfileRepository());
  }

  async getProfile(userId) {
    let profile = await this.repository.findByUserId(userId);
    if (!profile) {
      profile = await this.repository.create({ data: { userId }, include: { documents: true } });
    }
    return profile;
  }

  async updateProfile(userId, body) {
    const schema = z.object({
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
      economicalStatus: z.string().nullable().optional(),
      areaType: z.string().nullable().optional(),
      tinNumber: z.string().nullable().optional().refine(v => !v || /^\d{10}$/.test(v), 'TIN number must be exactly 10 digits'),
      accountNumber: z.string().nullable().optional().refine(v => !v || /^\d{10,18}$/.test(v), 'Account number must be 10-18 digits'),
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
      submitForApproval: z.boolean().optional(),
    });
    const data = schema.parse(body);

    // Validate total matches sum of subjects
    const naturalFields = ['examEnglish', 'examPhysics', 'examCivics', 'examNaturalMath', 'examChemistry', 'examBiology', 'examAptitude'];
    const socialFields = ['examEnglish', 'examCivics', 'examHistory', 'examEconomics', 'examGeography', 'examSocialMath', 'examAptitude'];
    const examFields = [...new Set([...naturalFields, ...socialFields])];
    const subjectSum = examFields.reduce((sum, f) => sum + (data[f] || 0), 0);
    if (data.nationalExamResultTotal != null && subjectSum > 0 && data.nationalExamResultTotal !== subjectSum) {
      throw AppError.badRequest('invalid_total', `National Exam Result Total (${data.nationalExamResultTotal}) must equal the sum of subject results (${subjectSum})`);
    }

    let profile = await this.repository.findByUserId(userId);
    if (!profile) {
      profile = await this.repository.create({ data: { userId } });
    }

    const updateData = { ...data };
    // Convert date fields: valid string -> Date, empty/null -> undefined (Prisma can't parse "" or null for DateTime)
    for (const dateField of ['dateOfBirthGC', 'admissionDate', 'checkedInDate']) {
      if (updateData[dateField] && typeof updateData[dateField] === 'string' && updateData[dateField].trim() !== '') {
        updateData[dateField] = new Date(updateData[dateField]);
      } else {
        updateData[dateField] = undefined;
      }
    }
    delete updateData.submitForApproval;

    if (data.submitForApproval) {
      const requiredFields = ['firstName', 'fatherName', 'grandFatherName', 'dateOfBirthGC', 'gender', 'placeOfBirth', 'citizenship', 'country', 'city', 'phone', 'stream', 'entryYear'];
      const missingFields = requiredFields.filter(field => {
        const value = updateData[field] || profile[field];
        return !value || (typeof value === 'string' && value.trim() === '');
      });
      if (missingFields.length > 0) throw AppError.badRequest('Please fill in all required fields', 'missing_fields', { missingFields });

      const docCount = await this.repository.countDocuments(profile.id);
      if (docCount === 0) throw AppError.badRequest('Please upload at least one document before submitting', 'no_documents');

      updateData.status = 'PENDING_APPROVAL';
    }

    return this.repository.updateProfile(userId, updateData);
  }

  async uploadDocument(userId, body) {
    const schema = z.object({ documentType: z.string(), fileName: z.string().optional(), fileUrl: z.string() });
    const data = schema.parse(body);

    let profile = await this.repository.findByUserId(userId);
    if (!profile) {
      profile = await this.repository.create({ data: { userId } });
    }

    const existing = await this.repository.findDocumentByType(profile.id, data.documentType);
    if (existing) {
      return this.repository.prisma.studentDocument.update({
        where: { id: existing.id },
        data: { fileName: data.fileName, fileUrl: data.fileUrl, status: 'SUBMITTED', uploadedAt: new Date() },
      });
    }

    return this.repository.prisma.studentDocument.create({
      data: { studentProfile: { connect: { id: profile.id } }, documentType: data.documentType, fileName: data.fileName, fileUrl: data.fileUrl, status: 'SUBMITTED', uploadedAt: new Date() },
    });
  }

  async deleteDocument(userId, documentId) {
    const document = await this.repository.findDocument(documentId);
    if (!document || document.studentProfile.userId !== userId) {
      throw AppError.notFound('not_found', 'Document not found');
    }
    await this.repository.deleteDocument(documentId);
  }

  async getPendingProfiles() {
    return this.repository.findPending();
  }

  async getAllProfiles(status) {
    return this.repository.findAll(status);
  }

  async getSingleProfile(profileId) {
    const profile = await this.repository.findSingle(profileId);
    this.throwUnless(profile, 404, 'not_found', 'Profile not found');
    return profile;
  }

  async approveProfile(profileId, adminId) {
    return this.repository.approve(profileId, adminId);
  }

  async rejectProfile(profileId, adminId, reason) {
    return this.repository.reject(profileId, adminId, reason);
  }
}
