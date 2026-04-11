export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export function successResponse<T>(data: T, message = 'Success'): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(message: string): ApiResponse {
  return {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
}

export class BusinessException extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BusinessException';
    this.status = status;
  }
}

export class ResourceNotFoundException extends Error {
  status: number;
  constructor(resource: string, id?: number | string) {
    super(id !== undefined ? `${resource} with id ${id} not found` : `${resource} not found`);
    this.name = 'ResourceNotFoundException';
    this.status = 404;
  }
}
