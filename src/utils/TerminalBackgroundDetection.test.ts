import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';

const openSync = jest.fn();
const closeSync = jest.fn();
const ReadStream = jest.fn();
const isatty = jest.fn();
jest.unstable_mockModule('node:fs', () => ({ openSync, closeSync }));
jest.unstable_mockModule('node:tty', () => ({ isatty, ReadStream }));

const { detectTerminalBackgroundRgb } =
  await import('./TerminalBackgroundDetection');

describe('detectTerminalBackgroundRgb', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  let input: EventEmitter & {
    setRawMode: ReturnType<typeof jest.fn>;
    resume: ReturnType<typeof jest.fn>;
    destroy: ReturnType<typeof jest.fn>;
  };
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'linux' });
    isatty.mockReturnValue(true);
    input = Object.assign(new EventEmitter(), {
      setRawMode: jest.fn(),
      resume: jest.fn(),
      destroy: jest.fn(),
    });
    openSync.mockReturnValue(42);
    ReadStream.mockImplementation(() => input);
    jest.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(process, 'platform', platform);
  });

  test('uses a separate terminal handle without reading or pausing stdin', async () => {
    const stdin = jest.spyOn(process, 'stdin', 'get');
    const result = detectTerminalBackgroundRgb();
    expect(openSync).toHaveBeenCalledWith('/dev/tty', 'r');
    expect(ReadStream).toHaveBeenCalledWith(42);
    expect(closeSync).toHaveBeenCalledWith(42);
    input.emit('data', Buffer.from('\x1b]11;rgb:ffff/0000/8080\x07'));
    await expect(result).resolves.toEqual([255, 0, 128]);
    expect(stdin).not.toHaveBeenCalled();
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
    expect(input.listenerCount('data')).toBe(0);
    expect(input.destroy).toHaveBeenCalledTimes(1);
  });

  test('restores raw mode and closes the handle on timeout', async () => {
    const result = detectTerminalBackgroundRgb();
    jest.advanceTimersByTime(500);
    await expect(result).resolves.toBeNull();
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
    expect(input.destroy).toHaveBeenCalledTimes(1);
  });

  test('closes the handle when reading fails', async () => {
    const result = detectTerminalBackgroundRgb();
    input.emit('error', new Error('terminal unavailable'));
    await expect(result).resolves.toBeNull();
    expect(input.destroy).toHaveBeenCalledTimes(1);
  });

  test('falls back when the controlling terminal cannot be opened', async () => {
    openSync.mockImplementationOnce(() => {
      throw new Error('no controlling terminal');
    });
    await expect(detectTerminalBackgroundRgb()).resolves.toBeNull();
    expect(ReadStream).not.toHaveBeenCalled();
  });

  test('closes the descriptor if constructing the stream fails', async () => {
    ReadStream.mockImplementationOnce(() => {
      throw new Error('cannot create terminal stream');
    });
    await expect(detectTerminalBackgroundRgb()).resolves.toBeNull();
    expect(closeSync).toHaveBeenCalledWith(42);
  });

  test('does not open a terminal when output is redirected', async () => {
    isatty.mockImplementation((fd) => fd !== 1);
    await expect(detectTerminalBackgroundRgb()).resolves.toBeNull();
    expect(openSync).not.toHaveBeenCalled();
  });

  test('does not alter console input mode on Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    await expect(detectTerminalBackgroundRgb()).resolves.toBeNull();
    expect(openSync).not.toHaveBeenCalled();
  });
});
