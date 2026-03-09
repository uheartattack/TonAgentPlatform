export const getAgentStateRepository = jest.fn(() => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));
export const getAgentLogsRepository = jest.fn(() => ({
  log: jest.fn().mockResolvedValue(undefined),
  getLogs: jest.fn().mockResolvedValue([]),
}));
export const runMigrations = jest.fn().mockResolvedValue(undefined);
