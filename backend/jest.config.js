module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)sx?'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(@react-pdf|@react-pdf/renderer|@react-pdf/primitives|@react-pdf/render|@react-pdf/events|@react-pdf/image|color-|@streaming-form-data|base64-js|ieee754|canvas)/)',
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
