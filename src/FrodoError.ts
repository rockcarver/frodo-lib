export class FrodoError extends Error {
  originalErrors: Error[] = [];
  constructor(message: string, originalErrors: Error | Error[] = null) {
    super(message);
    this.name = 'FrodoError';
    if (originalErrors && Array.isArray(originalErrors)) {
      this.originalErrors = originalErrors;
    } else if (originalErrors) {
      this.originalErrors = [originalErrors as Error];
    }
  }

  getOriginalErrors(): Error[] {
    return this.originalErrors;
  }

  getCombinedMessage(): string {
    let combinedMessage = this.message;
    this.originalErrors.forEach((error) => {
      combinedMessage += '\n  ' + error.message;
    });
    return combinedMessage;
  }
}
