export function createRequestId(prefix: string = 'req'): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}-${cryptoApi.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export class RequestIdGuard {
  private currentId: string | null = null;

  constructor(private readonly prefix: string = 'req') {}

  getId(): string {
    if (this.currentId === null) {
      this.currentId = createRequestId(this.prefix);
    }
    return this.currentId;
  }

  reset(): void {
    this.currentId = null;
  }
}