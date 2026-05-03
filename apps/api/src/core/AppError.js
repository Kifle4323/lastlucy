export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(code, message, details) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(code, message) {
    return new AppError(401, code, message);
  }

  static forbidden(code, message) {
    return new AppError(403, code, message);
  }

  static notFound(code, message) {
    return new AppError(404, code, message);
  }

  static serviceUnavailable(code, message) {
    return new AppError(503, code, message);
  }

  static internal(message) {
    return new AppError(500, 'internal_error', message);
  }
}
