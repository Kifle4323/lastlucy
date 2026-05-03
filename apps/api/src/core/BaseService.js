import { AppError } from './AppError.js';

export class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  throwUnless(condition, statusCode, code, message) {
    if (!condition) throw new AppError(statusCode, code, message);
  }

  throwIf(condition, statusCode, code, message) {
    if (condition) throw new AppError(statusCode, code, message);
  }
}
