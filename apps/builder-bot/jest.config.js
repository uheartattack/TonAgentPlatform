/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    // Mock heavy runtime deps so unit tests don't need DB/Telegram
    '^../notifier$': '<rootDir>/src/__tests__/__mocks__/notifier.ts',
    '^../../notifier$': '<rootDir>/src/__tests__/__mocks__/notifier.ts',
    '^../db/schema-extensions$': '<rootDir>/src/__tests__/__mocks__/db.ts',
    '^../../db/schema-extensions$': '<rootDir>/src/__tests__/__mocks__/db.ts',
    '^../fragment-service$': '<rootDir>/src/__tests__/__mocks__/fragment-service.ts',
    '^../../fragment-service$': '<rootDir>/src/__tests__/__mocks__/fragment-service.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }],
  },
};
