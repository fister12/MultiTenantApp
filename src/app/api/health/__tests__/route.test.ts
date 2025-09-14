import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { getPrismaClient } from '@/lib/db-helpers';

// Mock the database helpers
vi.mock('@/lib/db-helpers', () => ({
  getPrismaClient: vi.fn(),
}));

describe('/api/health', () => {
  const mockPrisma = {
    $queryRaw: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getPrismaClient as any).mockReturnValue(mockPrisma);
  });

  describe('GET /api/health', () => {
    it('should return ok status when database is connected', async () => {
      // Mock successful database query
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('ok');
      expect(data.data.database).toBe('connected');
      expect(data.data.timestamp).toBeDefined();
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
    });

    it('should return error status when database connection fails', async () => {
      // Mock database connection failure
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('HEALTH_CHECK_FAILED');
      expect(data.error.message).toBe('System health check failed');
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
    });

    it('should include timestamp in successful response', async () => {
      // Mock successful database query
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const beforeTime = new Date().toISOString();
      const response = await GET();
      const afterTime = new Date().toISOString();
      const data = await response.json();

      expect(data.data.timestamp).toBeDefined();
      expect(data.data.timestamp >= beforeTime).toBe(true);
      expect(data.data.timestamp <= afterTime).toBe(true);
    });

    it('should validate database connectivity with simple query', async () => {
      // Mock successful database query
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await GET();

      // Verify that the health check performs a simple database query
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
    });
  });
});