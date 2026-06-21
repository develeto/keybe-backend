import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/unit/**/*.test.ts', '**/integration/**/*.test.ts', '**/e2e/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/test/',
    '/cdk/',
    'src/docs/',
  ],
  collectCoverageFrom: [
    'src/modules/**/application/**/*.{ts,tsx}',
    'src/modules/**/domain/**/*.{ts,tsx}',
    'src/shared/utils/validate-input.utils.ts',
    'src/shared/utils/error-handler.utils.ts',
    'src/shared/utils/http-response.utils.ts',
    'src/shared/utils/with-user.middleware.ts',
    'src/shared/infrastructure/cache/**/*.{ts,tsx}',
    'src/shared/domain/**/*.{ts,tsx}',
    '!src/**/index.ts',
    '!src/**/*.types.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 91,
      lines: 95,
      functions: 95,
    },
  },
};

export default config;
