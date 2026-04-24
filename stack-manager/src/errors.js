// Typed errors the manager throws. Route handlers map them to HTTP
// status codes; library callers use instanceof.

export class InvalidStackNameError extends Error {
  constructor(name) {
    super(`invalid stack name: ${JSON.stringify(name)}`);
    this.name = "InvalidStackNameError";
    this.providedName = name;
  }
}

export class UnknownStackError extends Error {
  constructor(name) {
    super(`unknown stack: ${name}`);
    this.name = "UnknownStackError";
    this.stackName = name;
  }
}

export class ComposeError extends Error {
  constructor(message, { exitCode, stderr } = {}) {
    super(message);
    this.name = "ComposeError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}
