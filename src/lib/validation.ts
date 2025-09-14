import { z } from 'zod';

// Common validation patterns
const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(255, 'Email must be less than 255 characters')
  .transform(email => email.toLowerCase().trim());

const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(100, 'Password must be less than 100 characters');

const idSchema = z
  .string()
  .min(10, 'ID must be at least 10 characters')
  .max(50, 'ID must be less than 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID contains invalid characters');

const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(50, 'Slug must be less than 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens');

// Authentication schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

// Note schemas
export const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .transform(title => title.trim()),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be less than 10000 characters')
    .transform(content => content.trim()),
});

export const updateNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be less than 200 characters')
    .transform(title => title.trim())
    .optional(),
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(10000, 'Content must be less than 10000 characters')
    .transform(content => content.trim())
    .optional(),
}).refine(
  data => data.title !== undefined || data.content !== undefined,
  {
    message: 'At least one field (title or content) must be provided for update',
  }
);

export const noteIdSchema = z.object({
  id: idSchema,
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteIdInput = z.infer<typeof noteIdSchema>;

// Pagination schemas
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(val => val >= 1, 'Page must be greater than 0'),
  limit: z
    .string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 10)
    .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100'),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'title'])
    .optional()
    .default('createdAt'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// Tenant schemas
export const tenantSlugSchema = z.object({
  slug: slugSchema,
});

export type TenantSlugInput = z.infer<typeof tenantSlugSchema>;

// Query parameter validation
export const queryParamsSchema = z.object({
  search: z
    .string()
    .max(100, 'Search term must be less than 100 characters')
    .optional()
    .transform(val => val?.trim()),
  filter: z
    .enum(['all', 'recent', 'mine'])
    .optional()
    .default('all'),
});

export type QueryParamsInput = z.infer<typeof queryParamsSchema>;

// Request validation helpers
export function validateRequestBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error; // Will be handled by error handler
    }
    throw new Error('Invalid request body format');
  }
}

export function validateQueryParams<T>(schema: z.ZodSchema<T>, params: Record<string, string | string[]>): T {
  try {
    // Convert array values to strings (take first element)
    const normalizedParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      normalizedParams[key] = Array.isArray(value) ? value[0] : value;
    }
    
    return schema.parse(normalizedParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error; // Will be handled by error handler
    }
    throw new Error('Invalid query parameters');
  }
}

export function validatePathParams<T>(schema: z.ZodSchema<T>, params: Record<string, string>): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error; // Will be handled by error handler
    }
    throw new Error('Invalid path parameters');
  }
}

// Content type validation
export const ALLOWED_CONTENT_TYPES = {
  json: 'application/json',
  formData: 'multipart/form-data',
  urlEncoded: 'application/x-www-form-urlencoded',
} as const;

export function validateContentType(
  contentType: string | null,
  allowed: string[] = [ALLOWED_CONTENT_TYPES.json]
): void {
  if (!contentType) {
    throw new Error('Content-Type header is required');
  }
  
  const normalizedContentType = contentType.split(';')[0].trim().toLowerCase();
  
  if (!allowed.includes(normalizedContentType)) {
    throw new Error(`Invalid Content-Type. Allowed: ${allowed.join(', ')}`);
  }
}

// Request size validation
export function validateRequestSize(contentLength: string | null, maxSize: number = 1024 * 1024): void {
  if (!contentLength) {
    return; // No content length header, let the server handle it
  }
  
  const size = parseInt(contentLength, 10);
  if (isNaN(size) || size > maxSize) {
    throw new Error(`Request too large. Maximum size: ${maxSize} bytes`);
  }
}

// Security validation helpers
export function validateNoSQLInjection(input: string): void {
  // Check for common SQL injection patterns
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(--|\/\*|\*\/)/,
    /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/i,
  ];
  
  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(input)) {
      throw new Error('Input contains potentially dangerous content');
    }
  }
}

export function validateNoXSS(input: string): void {
  // Check for common XSS patterns
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];
  
  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      throw new Error('Input contains potentially dangerous content');
    }
  }
}

// Comprehensive input sanitization
export function sanitizeInput(input: string): string {
  // Validate against security threats
  validateNoSQLInjection(input);
  validateNoXSS(input);
  
  // Basic sanitization
  return input
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .slice(0, 10000); // Prevent extremely long inputs
}