/**
 * Test data factories for Last Frontier platform
 * Provides consistent test data generation for all entities
 * Uses London School TDD approach with no hard-coded values
 */

import { UserRole } from '../../src/auth/authService';

/**
 * Interface for User entity (based on database schema)
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

/**
 * Interface for Subscription entity
 */
export interface Subscription {
  id: string;
  userId: string;
  tier: 'explorer' | 'professional' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled';
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for VCU (Virtual Compute Unit) entity
 */
export interface VCU {
  id: string;
  userId: string;
  allocated: number;
  used: number;
  resetDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for Content entity
 */
export interface Content {
  id: string;
  userId: string;
  title: string;
  type: 'document' | 'image' | 'video' | 'dataset';
  size: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Factory for creating test User entities
 */
export class UserFactory {
  private static counter = 0;

  static create(overrides: Partial<User> = {}): User {
    this.counter++;
    const now = new Date();
    
    return {
      id: `test-user-${this.counter}`,
      email: `test${this.counter}@example.com`,
      role: UserRole.EXPLORER,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      ...overrides,
    };
  }

  static createProfessional(overrides: Partial<User> = {}): User {
    return this.create({
      role: UserRole.PROFESSIONAL,
      ...overrides,
    });
  }

  static createEnterprise(overrides: Partial<User> = {}): User {
    return this.create({
      role: UserRole.ENTERPRISE,
      ...overrides,
    });
  }

  static createAdmin(overrides: Partial<User> = {}): User {
    return this.create({
      role: UserRole.ADMIN,
      ...overrides,
    });
  }

  static createInactive(overrides: Partial<User> = {}): User {
    return this.create({
      isActive: false,
      ...overrides,
    });
  }

  static reset(): void {
    this.counter = 0;
  }
}

/**
 * Factory for creating test Subscription entities
 */
export class SubscriptionFactory {
  private static counter = 0;

  static create(overrides: Partial<Subscription> = {}): Subscription {
    this.counter++;
    const now = new Date();
    
    return {
      id: `test-subscription-${this.counter}`,
      userId: `test-user-${this.counter}`,
      tier: 'explorer',
      status: 'active',
      startDate: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  static createProfessional(overrides: Partial<Subscription> = {}): Subscription {
    return this.create({
      tier: 'professional',
      ...overrides,
    });
  }

  static createEnterprise(overrides: Partial<Subscription> = {}): Subscription {
    return this.create({
      tier: 'enterprise',
      ...overrides,
    });
  }

  static createExpired(overrides: Partial<Subscription> = {}): Subscription {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    
    return this.create({
      status: 'inactive',
      endDate: pastDate,
      ...overrides,
    });
  }

  static reset(): void {
    this.counter = 0;
  }
}

/**
 * Factory for creating test VCU entities
 */
export class VCUFactory {
  private static counter = 0;

  static create(overrides: Partial<VCU> = {}): VCU {
    this.counter++;
    const now = new Date();
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    
    return {
      id: `test-vcu-${this.counter}`,
      userId: `test-user-${this.counter}`,
      allocated: 1000,
      used: 0,
      resetDate,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  static createExhausted(overrides: Partial<VCU> = {}): VCU {
    return this.create({
      allocated: 1000,
      used: 1000,
      ...overrides,
    });
  }

  static createPartiallyUsed(overrides: Partial<VCU> = {}): VCU {
    return this.create({
      allocated: 1000,
      used: 500,
      ...overrides,
    });
  }

  static reset(): void {
    this.counter = 0;
  }
}

/**
 * Factory for creating test Content entities
 */
export class ContentFactory {
  private static counter = 0;

  static create(overrides: Partial<Content> = {}): Content {
    this.counter++;
    const now = new Date();
    
    return {
      id: `test-content-${this.counter}`,
      userId: `test-user-${this.counter}`,
      title: `Test Content ${this.counter}`,
      type: 'document',
      size: 1024,
      metadata: { format: 'text/plain' },
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  static createImage(overrides: Partial<Content> = {}): Content {
    return this.create({
      type: 'image',
      size: 2048,
      metadata: { format: 'image/jpeg', width: 1920, height: 1080 },
      ...overrides,
    });
  }

  static createVideo(overrides: Partial<Content> = {}): Content {
    return this.create({
      type: 'video',
      size: 10485760, // 10MB
      metadata: { format: 'video/mp4', duration: 120 },
      ...overrides,
    });
  }

  static createDataset(overrides: Partial<Content> = {}): Content {
    return this.create({
      type: 'dataset',
      size: 5242880, // 5MB
      metadata: { format: 'application/json', records: 1000 },
      ...overrides,
    });
  }

  static reset(): void {
    this.counter = 0;
  }
}

/**
 * Reset all factory counters - useful for test isolation
 */
export function resetAllFactories(): void {
  UserFactory.reset();
  SubscriptionFactory.reset();
  VCUFactory.reset();
  ContentFactory.reset();
}