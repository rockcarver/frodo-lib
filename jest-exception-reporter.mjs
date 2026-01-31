import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';

export default class JestExceptionReporter {
  constructor(globalConfig, options = {}) {
    this._globalConfig = globalConfig;
    this._options = options || {};
    this.logFile = this._options.logFile || path.resolve(process.cwd(), 'frodo-lib-jest-exceptions.log');

    try {
      fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
    } catch (e) {
      // ignore - best effort
    }

    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
         format.printf(({ timestamp, level, message, ...meta }) => {
           const base = { timestamp, level, message };
           // pretty-print JSON with 2-space indentation and ensure a trailing newline
           return JSON.stringify(Object.assign(base, meta), null, 2) + '\n';
         })
      ),
      transports: [
        new transports.File({ filename: this.logFile, handleExceptions: false })
      ],
      exitOnError: false
    });
  }

  onRunStart() {
    this.logger.info('Jest exceptions log started');
  }

  onTestResult(test, testResult) {
    if (!testResult) return;
    const filePath = testResult.testFilePath || (test && test.path) || 'unknown';

    const parseFailureMessage = (msg) => {
      if (!msg || typeof msg !== 'string') return { raw: msg };
      // Jest failureMessages are strings. Try to split into message + stack.
      // The first line is usually the error message, rest is stack trace.
      const lines = msg.split('\n');
      const firstLine = lines[0] || '';
      const rest = lines.slice(1).join('\n').trim();

      // Try to find a JSON object at the end of the message (if tests serialized errors)
      let parsed = null;
      try {
        const jsonMatch = msg.match(/(\{[\s\S]*\})\s*$/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          // sometimes the first line itself may be JSON
          const maybeJson = firstLine.trim();
          if (maybeJson.startsWith('{') && maybeJson.endsWith('}')) {
            parsed = JSON.parse(maybeJson);
          }
        }
      } catch (e) {
        // ignore parse errors
      }

      return {
        raw: msg,
        errorMessage: firstLine,
        stack: rest,
        parsedError: parsed,
        isFrodoError: false,
        frodoFields: null
      };
    };

    (testResult.testResults || []).forEach(assertion => {
      if (assertion.status === 'failed') {
        // Prefer structured failure details if available (some runners include objects)
        const details = assertion.failureDetails && assertion.failureDetails.length ? assertion.failureDetails : null;
        if (details) {
          details.forEach(detail => {
            let isFrodo = false;
            let frodoFields = null;
            try {
              if (detail && typeof detail === 'object') {
                // Check name property
                if (detail.name === 'FrodoError') {
                  isFrodo = true;
                  frodoFields = {
                    message: detail.message,
                    originalErrors: detail.originalErrors || detail.getOriginalErrors || null,
                    isHttpError: detail.isHttpError || null,
                    httpCode: detail.httpCode || null,
                    httpStatus: detail.httpStatus || null
                  };
                }
              }
            } catch (e) {
              // ignore
            }

            // Log what we found
            this.logger.error('test-failure', {
              file: filePath,
              fullName: assertion.fullName,
              ancestorTitles: assertion.ancestorTitles,
              title: assertion.title,
              isFrodoError: isFrodo,
              frodoFields,
              detail
            });
          });
        } else {
          (assertion.failureMessages || []).forEach(msg => {
            const parsed = parseFailureMessage(msg);

            // Heuristic: if the first line or raw contains 'FrodoError' or 'FrodoError:' mark it
            const containsFrodo = typeof parsed.errorMessage === 'string' && /FrodoError/.test(parsed.errorMessage || parsed.raw);
            let frodoFields = null;
            if (containsFrodo && parsed.parsedError && typeof parsed.parsedError === 'object') {
              frodoFields = parsed.parsedError;
            }

            this.logger.error('test-failure', {
              file: filePath,
              fullName: assertion.fullName,
              ancestorTitles: assertion.ancestorTitles,
              title: assertion.title,
              isFrodoError: Boolean(containsFrodo),
              frodoFields,
              errorMessage: parsed.errorMessage,
              stack: parsed.stack,
              parsedError: parsed.parsedError,
              rawMessage: parsed.raw
            });
          });
        }
      }
    });
  }

  onRunComplete(contexts, results) {
    try {
      this.logger.info('Jest run completed', {
        numTotalTests: results.numTotalTests,
        numFailedTests: results.numFailedTests,
        success: results.numFailedTests === 0
      });
    } catch (e) {
      // ignore
    }
  }
}
