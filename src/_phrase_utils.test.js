/* eslint-disable no-unused-vars */
import fetch from 'cross-fetch';
import fs from 'fs';
import FormData from 'form-data';

import * as sleepModule from './sleep';

import {
  excludeKeysInLocale,
  checkUploadStatus,
  uploadLocaleFile,
  includeKeysInLocale,
} from './_phrase_utils';

jest.mock('./sleep', () => ({
  sleep: jest.fn(async () => {}),
}));

jest.mock('cross-fetch');
jest.mock('fs');
jest.mock('form-data');

describe('excludeKeysInLocale', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('should call the API with the correct parameters', async () => {
    const uploadId = 'ABCDEFG123';
    const nUnmentionedKeys = 23;

    fetch.mockResolvedValue({
      status: 200,
      json: () => ({
        records_affected: nUnmentionedKeys,
      }),
    });

    await excludeKeysInLocale('en', 'ABCDEFG123', nUnmentionedKeys);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/keys/exclude'),
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Authorization: `token ${process.env.INPUT_PHRASE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_locale_id: 'en',
          q: `unmentioned_in_upload:${uploadId}`,
        }),
      }),
    );
  });

  it('should handle a successful API response', async () => {
    const uploadId = 'ABCDEFG123';
    const nUnmentionedKeys = 23;
    fetch.mockResolvedValue({
      status: 200,
      json: () => ({
        records_affected: nUnmentionedKeys,
      }),
    });

    const result = await excludeKeysInLocale('en', uploadId, nUnmentionedKeys);

    expect(result).toBeUndefined();
  });

  it('should exit on unsuccessful API response', async () => {
    const uploadId = 'ABCDEFG123';
    const nUnmentionedKeys = 23;
    fetch.mockResolvedValue({
      status: 400,
      json: () => ({}),
    });
    // Mock process.exit() to prevent exiting the test runner
    const originalProcessExit = process.exit;
    process.exit = jest.fn();

    try {
      await excludeKeysInLocale('en', uploadId, nUnmentionedKeys);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
    expect(process.exit).toHaveBeenCalledWith(1);

    // Restore the original process.exit
    process.exit = originalProcessExit;
  });

  it('should exit if number of unmentioned keys does not match number of affected records', async () => {
    const uploadId = 'ABCDEFG123';
    const nUnmentionedKeys = 23;
    fetch.mockResolvedValue({
      status: 200,
      json: () => ({
        records_affected: 24,
      }),
    });

    // Mock process.exit() to prevent exiting the test runner
    const originalProcessExit = process.exit;
    process.exit = jest.fn();

    try {
      await excludeKeysInLocale('en', uploadId, nUnmentionedKeys);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
    expect(process.exit).toHaveBeenCalledWith(1);

    // Restore the original process.exit
    process.exit = originalProcessExit;
  });
});

describe('includeKeysInLocale', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('should call the API with the correct parameters', async () => {
    fetch.mockResolvedValue({
      status: 200,
      json: () => ({}),
    });

    await includeKeysInLocale('en');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/keys/include'),
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Authorization: `token ${process.env.INPUT_PHRASE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_locale_id: 'en',
          q: '*',
        }),
      }),
    );
  });

  it('should handle a successful API response', async () => {
    fetch.mockResolvedValue({
      status: 200,
      json: () => ({}),
    });

    const result = await includeKeysInLocale('en');

    expect(result).toBeUndefined();
  });

  it('should throw an error and exit on unsuccessful API response', async () => {
    fetch.mockResolvedValue({
      status: 400,
      json: () => ({}),
    });
    // Mock process.exit() to prevent exiting the test runner
    const originalProcessExit = process.exit;
    process.exit = jest.fn();

    try {
      await includeKeysInLocale('en');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
    expect(process.exit).toHaveBeenCalledWith(1);

    // Restore the original process.exit
    process.exit = originalProcessExit;
  });
});

describe('uploadLocaleFile', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    fs.createReadStream.mockReset();
    fetch.mockReset();
    FormData.prototype.append.mockReset();
    FormData.prototype.getHeaders.mockReset();
  });

  test('should successfully upload the locale file', async () => {
    // Mock file stream
    const mockFileStream = Symbol('fileStream');
    fs.createReadStream.mockReturnValue(mockFileStream);

    // Mock successful API response
    fetch.mockResolvedValue({
      status: 201,
      json: async () => ({ id: 'mock-upload-id' }),
    });

    const result = await uploadLocaleFile();

    expect(fs.createReadStream).toHaveBeenCalledWith('./src/locales/en.json');
    expect(FormData.prototype.append).toHaveBeenCalledWith(
      'file',
      mockFileStream,
    );
    expect(FormData.prototype.append).toHaveBeenCalledWith(
      'file_format',
      'simple_json',
    );
    expect(FormData.prototype.append).toHaveBeenCalledWith('locale_id', 'en');
    expect(FormData.prototype.append).toHaveBeenCalledWith(
      'tags',
      'synced_from_code',
    );
    expect(FormData.prototype.append).toHaveBeenCalledWith(
      'update_translations',
      'true',
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/uploads'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `token ${process.env.INPUT_PHRASE_TOKEN}`,
          'Content-Type': 'multipart/form-data',
        },
      }),
    );

    expect(result).toBe('mock-upload-id');
  });

  test('should throw an error and exit when the upload is unsuccessful', async () => {
    // Mock file stream
    const mockFileStream = Symbol('fileStream');
    fs.createReadStream.mockReturnValue(mockFileStream);

    // Mock unsuccessful API response
    fetch.mockResolvedValue({
      status: 400,
      json: async () => ({ message: 'Bad Request' }),
    });

    // Mock process.exit() to prevent exiting the test runner
    const originalProcessExit = process.exit;
    process.exit = jest.fn();

    try {
      await uploadLocaleFile();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    expect(fs.createReadStream).toHaveBeenCalledWith('./src/locales/en.json');
    expect(FormData.prototype.append).toHaveBeenCalledWith(
      'file',
      mockFileStream,
    );
    expect(FormData.prototype.append).toHaveBeenCalledWith(
      'file_format',
      'simple_json',
    );
    expect(FormData.prototype.append).toHaveBeenCalledWith('locale_id', 'en');
    expect(FormData.prototype.append).toHaveBeenCalledWith(
      'tags',
      'synced_from_code',
    );
    expect(FormData.prototype.append).toHaveBeenCalledWith(
      'update_translations',
      'true',
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/uploads'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `token ${process.env.INPUT_PHRASE_TOKEN}`,
          'Content-Type': 'multipart/form-data',
        },
      }),
    );

    expect(process.exit).toHaveBeenCalledWith(1);

    // Restore the original process.exit
    process.exit = originalProcessExit;
  });
});

describe('checkUploadStatus', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  const uploadId = 'ABCDEFG123';

  it('should return number of unmentioned keys when the upload is successful', async () => {
    // Mock the fetch call to return a successful response with the desired state and summary
    fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        state: 'success',
        summary: { translation_keys_unmentioned: 5 },
      }),
    });

    const result = await checkUploadStatus(uploadId);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/uploads/${uploadId}`),
      expect.objectContaining({
        headers: { Authorization: `token ${process.env.INPUT_PHRASE_TOKEN}` },
      }),
    );
    expect(result).toBe(5);
  });

  it('should retry up to MAX_RETRIES when the upload status is not success', async () => {
    // Mock the fetch call to return an unsuccessful state initially and a successful state after MAX_RETRIES
    fetch
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          state: 'processing',
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          state: 'processing',
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          state: 'success',
          summary: { translation_keys_unmentioned: 7 },
        }),
      });

    const result = await checkUploadStatus(uploadId);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toBe(7);
  });

  it('should exit with an error when the upload status is not "success" after MAX_RETRIES', async () => {
    // Mock the fetch call to return an unsuccessful state for all retries
    fetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        state: 'processing',
      }),
    });

    // Mock process.exit() to prevent exiting the test runner
    const originalProcessExit = process.exit;
    process.exit = jest.fn();

    try {
      await checkUploadStatus(uploadId);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(process.exit).toHaveBeenCalledWith(1);

    // Restore the original process.exit
    process.exit = originalProcessExit;
  });
});
