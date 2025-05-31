// Mock database for integration tests
import { Pool, PoolClient } from 'pg';

interface MockQueryResult {
  rows: any[];
  rowCount: number;
}

class MockPoolClient {
  private transactionDepth = 0;

  async query(text: string, params?: any[]): Promise<MockQueryResult> {
    // Mock responses for different queries
    if (text.includes('BEGIN')) {
      this.transactionDepth++;
      return { rows: [], rowCount: 0 };
    }
    
    if (text.includes('COMMIT') || text.includes('ROLLBACK')) {
      this.transactionDepth = Math.max(0, this.transactionDepth - 1);
      return { rows: [], rowCount: 0 };
    }
    
    if (text.includes('SELECT id FROM users WHERE email')) {
      // Return empty to simulate user doesn't exist
      return { rows: [], rowCount: 0 };
    }
    
    if (text.includes('INSERT INTO users')) {
      // Return mock user data
      return {
        rows: [{
          id: 'test-user-id-123',
          email: params?.[0] || 'test@example.com',
          role: params?.[2] || 'explorer',
          created_at: new Date()
        }],
        rowCount: 1
      };
    }
    
    if (text.includes('INSERT INTO user_profiles')) {
      return { rows: [], rowCount: 1 };
    }
    
    if (text.includes('INSERT INTO audit_logs')) {
      return { rows: [], rowCount: 1 };
    }
    
    if (text.includes('DELETE FROM users')) {
      return { rows: [], rowCount: 1 };
    }
    
    // Default response
    return { rows: [], rowCount: 0 };
  }

  release(): void {
    // Mock release
  }
}

class MockPool {
  async query(text: string, params?: any[]): Promise<MockQueryResult> {
    const client = new MockPoolClient();
    return client.query(text, params);
  }

  async connect(): Promise<MockPoolClient> {
    return new MockPoolClient();
  }

  async end(): Promise<void> {
    // Mock end
  }
}

// Export the mock
export const createMockPool = () => new MockPool();
export { MockPool, MockPoolClient };
