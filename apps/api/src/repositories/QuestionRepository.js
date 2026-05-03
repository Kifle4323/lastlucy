import { BaseRepository } from '../core/BaseRepository.js';

export class QuestionRepository extends BaseRepository {
  constructor() { super('question'); }

  findByAssessment(assessmentId) {
    return this.model.findMany({ where: { assessmentId }, orderBy: { createdAt: 'asc' } });
  }

  findWithCourse(questionId) {
    return this.model.findUnique({
      where: { id: questionId },
      include: { assessment: { include: { course: { include: { courseSections: true, courseClasses: true } } } } },
    });
  }

  deleteAnswersAndQuestion(questionId) {
    return this.prisma.$transaction(async (tx) => {
      await tx.answer.deleteMany({ where: { questionId } });
      await tx.question.delete({ where: { id: questionId } });
    });
  }
}
