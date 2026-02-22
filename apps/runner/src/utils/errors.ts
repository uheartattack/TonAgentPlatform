export class ExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public agentId?: string
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class PluginError extends Error {
  constructor(
    message: string,
    public pluginName: string
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
