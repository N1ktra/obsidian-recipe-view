/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.svelte$': '<rootDir>/__mocks__/svelteMock.js',
    '^obsidian$': '<rootDir>/__mocks__/obsidian.js',
    '^svelte/store$': '<rootDir>/__mocks__/svelteStore.js',
  },
};