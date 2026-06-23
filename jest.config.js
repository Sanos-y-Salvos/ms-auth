/** @type {import('jest').Config} */
module.exports = {
  displayName: 'ms-auth',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/middlewares/**/*.ts',
    'src/controllers/**/*.ts',
    'src/utils/**/*.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
  clearMocks: true,
};
