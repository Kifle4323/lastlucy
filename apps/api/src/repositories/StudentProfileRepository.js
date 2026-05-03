import { BaseRepository } from '../core/BaseRepository.js';

export class StudentProfileRepository extends BaseRepository {
  constructor() { super('studentProfile'); }

  findByUserId(userId) {
    return this.model.findUnique({ where: { userId }, include: { documents: true } });
  }

  findOrCreate(userId) {
    return this.model.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { documents: true },
    });
  }

  findPending() {
    return this.model.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: { user: { select: { id: true, email: true, fullName: true } }, documents: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findAll(query) {
    const where = {};
    if (query) where.status = query;
    return this.model.findMany({
      where,
      include: { user: { select: { id: true, email: true, fullName: true, profileImage: true } }, documents: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findSingle(profileId) {
    return this.model.findUnique({
      where: { id: profileId },
      include: { user: { select: { id: true, email: true, fullName: true, profileImage: true, createdAt: true } }, documents: true },
    });
  }

  approve(profileId, adminId) {
    return this.model.update({
      where: { id: profileId },
      data: { status: 'APPROVED', adminReviewedBy: adminId, reviewedAt: new Date(), rejectionReason: null },
      include: { user: { select: { id: true, email: true, fullName: true } }, documents: true },
    });
  }

  reject(profileId, adminId, reason) {
    return this.model.update({
      where: { id: profileId },
      data: { status: 'REJECTED', adminReviewedBy: adminId, reviewedAt: new Date(), rejectionReason: reason },
      include: { user: { select: { id: true, email: true, fullName: true } }, documents: true },
    });
  }

  updateProfile(userId, data) {
    return this.model.update({
      where: { userId },
      data,
      include: { documents: true },
    });
  }

  findDocument(documentId) {
    return this.prisma.studentDocument.findUnique({
      where: { id: documentId },
      include: { studentProfile: true },
    });
  }

  findDocumentByType(profileId, documentType) {
    return this.prisma.studentDocument.findFirst({
      where: { studentProfileId: profileId, documentType },
    });
  }

  upsertDocument(profileId, documentType, fileName, fileUrl) {
    return this.prisma.studentDocument.upsert({
      where: { id: '' }, // placeholder, we use findFirst + create/update pattern
      create: { studentProfile: { connect: { id: profileId } }, documentType, fileName, fileUrl, status: 'SUBMITTED', uploadedAt: new Date() },
      update: { fileName, fileUrl, status: 'SUBMITTED', uploadedAt: new Date() },
    });
  }

  deleteDocument(documentId) {
    return this.prisma.studentDocument.delete({ where: { id: documentId } });
  }

  countDocuments(profileId) {
    return this.prisma.studentDocument.count({ where: { studentProfileId: profileId } });
  }
}
