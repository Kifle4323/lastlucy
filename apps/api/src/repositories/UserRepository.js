import { BaseRepository } from '../core/BaseRepository.js';

export class UserRepository extends BaseRepository {
  constructor() { super('user'); }

  findByEmail(email) {
    return this.model.findUnique({ where: { email: email.toLowerCase() } });
  }

  findPendingUsers() {
    return this.model.findMany({
      where: { isApproved: false },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  approveUser(userId) {
    return this.model.update({
      where: { id: userId },
      data: { isApproved: true },
      select: { id: true, email: true, fullName: true, role: true, isApproved: true },
    });
  }

  findMe(userId) {
    return this.model.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, isProfileComplete: true, profileImage: true, isApproved: true, createdAt: true },
    });
  }

  updatePassword(userId, passwordHash) {
    return this.model.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  updateProfile(userId, data) {
    return this.model.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, fullName: true, role: true, profileImage: true, isProfileComplete: true },
    });
  }

  findAllUsers() {
    return this.model.findMany({
      select: { id: true, email: true, fullName: true, role: true, profileImage: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findStudentsWithProfiles() {
    return this.model.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true, email: true, fullName: true, profileImage: true, isProfileComplete: true, createdAt: true,
        classStudents: { include: { class: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getProfileStatus(userId) {
    return this.model.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, profileImage: true, isProfileComplete: true },
    });
  }
}
