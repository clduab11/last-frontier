/** @type {import('jest').Config} */
module.exports = {
  // Global configuration (minimal to avoid conflicts)
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Separate test suites for unit and integration tests
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src', '<rootDir>/tests'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/index.ts'
      ],
      coverageDirectory: 'coverage/unit',
      coverageThreshold: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      clearMocks: true,
      restoreMocks: true,
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: 'tsconfig.json'
        }]
      }
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src', '<rootDir>/tests'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.ts'],
      clearMocks: true,
      restoreMocks: true,
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: 'tsconfig.json'
        }]
      }
    }
  ]
};