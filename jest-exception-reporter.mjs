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

    (testResult.testResults || []).forEach(assertion => {
      if (assertion.status === 'failed') {
        // Prefer structured failure details if available (some runners include objects)
        const details = assertion.failureDetails && assertion.failureDetails.length ? assertion.failureDetails : null;
        if (details) {
          details.forEach(detail => {
            try {
              if (detail && typeof detail === 'object') {
                // Check name property
                if (detail.name === 'FrodoError') {
                  detail = detail.toString();
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
              detail
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
