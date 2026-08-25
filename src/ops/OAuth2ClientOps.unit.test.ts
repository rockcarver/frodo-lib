import { jest } from '@jest/globals';

const getOAuth2Client = jest.fn(async (_args?: any): Promise<any> => ({}));
const putOAuth2Client = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/OAuth2ClientApi', () => ({
  deleteOAuth2Client: jest.fn(),
  getOAuth2Client,
  getOAuth2Clients: jest.fn(),
  putOAuth2Client,
}));

const { createOAuth2Client } = await import('./OAuth2ClientOps');

function mockState() {
  return {
    getRealm: () => 'alpha',
    getDebugHandler: () => undefined,
  } as any;
}

function errorWithStatus(status: number) {
  const error: any = new Error(`HTTP ${status}`);
  error.response = { status };
  return error;
}

describe('createOAuth2Client', () => {
  beforeEach(() => {
    getOAuth2Client.mockReset();
    putOAuth2Client.mockReset();
    putOAuth2Client.mockResolvedValue({ _id: 'my-client' });
  });

  test('creates the client when the existence check confirms a 404', async () => {
    getOAuth2Client.mockRejectedValue(errorWithStatus(404));

    const result = await createOAuth2Client({
      clientId: 'my-client',
      clientData: {} as any,
      state: mockState(),
    });

    expect(result).toEqual({ _id: 'my-client' });
    expect(putOAuth2Client).toHaveBeenCalledTimes(1);
  });

  test('does not attempt to create when the existence check fails with a 403', async () => {
    getOAuth2Client.mockRejectedValue(errorWithStatus(403));

    await expect(
      createOAuth2Client({
        clientId: 'my-client',
        clientData: {} as any,
        state: mockState(),
      })
    ).rejects.toThrow();
    expect(putOAuth2Client).not.toHaveBeenCalled();
  });

  test('does not attempt to create when the existence check fails with a 500', async () => {
    getOAuth2Client.mockRejectedValue(errorWithStatus(500));

    await expect(
      createOAuth2Client({
        clientId: 'my-client',
        clientData: {} as any,
        state: mockState(),
      })
    ).rejects.toThrow();
    expect(putOAuth2Client).not.toHaveBeenCalled();
  });

  test('does not attempt to create on a network/timeout failure with no response', async () => {
    getOAuth2Client.mockRejectedValue(new Error('timeout of 5000ms exceeded'));

    await expect(
      createOAuth2Client({
        clientId: 'my-client',
        clientData: {} as any,
        state: mockState(),
      })
    ).rejects.toThrow();
    expect(putOAuth2Client).not.toHaveBeenCalled();
  });

  test('refuses when the client already exists (read succeeds)', async () => {
    getOAuth2Client.mockResolvedValue({ _id: 'my-client' });

    await expect(
      createOAuth2Client({
        clientId: 'my-client',
        clientData: {} as any,
        state: mockState(),
      })
    ).rejects.toThrow(/already exists/);
    expect(putOAuth2Client).not.toHaveBeenCalled();
  });
});
