module.exports = {
  testDir: 'e2e', use: { baseURL: 'http://localhost:5173' },
  webServer: { command: 'npx --yes serve -l 5173 .', port: 5173, reuseExistingServer: true },
};
