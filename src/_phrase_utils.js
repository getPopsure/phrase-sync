#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
const fetch = require('cross-fetch');
const FormData = require('form-data');
const fs = require('fs');
const { sleep } = require('./sleep.js');

const PROJECT_ID = process.env.INPUT_PROJECT_ID;
const BASE_API_URL = `https://api.phrase.com/v2/projects/${PROJECT_ID}`;
const ENGLISH_LOCALE_FILE_PATH = process.env.INPUT_ENGLISH_LOCALE_FILE_PATH;

const TOKEN = process.env.INPUT_PHRASE_TOKEN;

// Upload english locale file to Phrase
export const uploadLocaleFile = async () => {
  const formData = new FormData();
  const fileStream = fs.createReadStream(ENGLISH_LOCALE_FILE_PATH);

  // Set form data properties
  // These would be the -F parameters of a curl call:
  // https://developers.phrase.com/api/#post-/projects/-project_id-/uploads
  formData.append('file', fileStream);
  formData.append('file_format', 'simple_json');
  formData.append('locale_id', 'en');
  formData.append('tags', 'synced_from_code');
  formData.append('update_translations', 'true');

  // API call to /uploads endpoint
  // https://developers.phrase.com/api/#post-/projects/-project_id-/uploads
  const uploadResponse = await fetch(`${BASE_API_URL}/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'multipart/form-data',
      ...formData.getHeaders(),
    },
    body: formData,
  });

  // Upload unsuccessful => exit
  if (uploadResponse.status !== 201) {
    console.error(
      `Failed to upload locale file to Phrase - status code: ${uploadResponse.status}`,
    );
    process.exit(1);
  }

  // Grab and return the upload's id for all subsequent API calls
  const { id: uploadId } = await uploadResponse.json();

  return uploadId;
};

// Uploading a file can take quite a long time, so in order to be able to check how many keys are
// unmentioned in the upload we just made, we need to check the status until it reaches "success".
// Only then will the response body's "summary" field actually contain the number of unmentioned keys etc.
export const checkUploadStatus = async (uploadId) => {
  console.log(
    `File upload successfully initiated.\nChecking status for upload '${uploadId}'`,
  );
  // Set maximum number of retries
  const MAX_RETRIES = 5;

  // Get upload status data
  // https://developers.phrase.com/api/#get-/projects/-project_id-/uploads/-id-
  let uploadStatusResponse = await fetch(
    `${BASE_API_URL}/uploads/${uploadId}`,
    {
      headers: {
        Authorization: `token ${TOKEN}`,
      },
    },
  );
  let uploadStatusData;

  // If the API call itself was successful, grab the upload status ("state")
  if (uploadStatusResponse.status === 200) {
    uploadStatusData = await uploadStatusResponse.json();
    console.log(`Status - "${uploadStatusData.state}"`);
  }

  // Check if the upload status is "success", if not retry up to MAX_RETRIES times
  for (let i = 0; i < MAX_RETRIES; i += 1) {
    // Status is "success" => break out of the loop
    if (uploadStatusData.state === 'success') {
      break;
    }
    // Wait for a few seconds before making the next API call
    await sleep(30000);

    // Get upload status again
    uploadStatusResponse = await fetch(`${BASE_API_URL}/uploads/${uploadId}`, {
      headers: {
        Authorization: `token ${TOKEN}`,
      },
    });
    if (uploadStatusResponse.status === 200) {
      uploadStatusData = await uploadStatusResponse.json();
      console.log(`Status - "${uploadStatusData.state}"`);
    }
  }

  // If after all retries we still haven't reached "success", exit
  if (uploadStatusData.state !== 'success') {
    console.error(
      `Failed to reach 'success' state of upload after ${MAX_RETRIES} retries.`,
    );
    process.exit(1);
  }

  // We reached "success" so the "summary" field now contains the number of unmentioned keys, which we return
  console.log(uploadStatusData);
  const {
    summary: { translation_keys_unmentioned: nUnmentionedKeys },
  } = uploadStatusData;

  return nUnmentionedKeys;
};

// Exclude all keys that are unmentioned in a certain upload in target locale (adds "excluded" status to all affected keys)
export const excludeKeysInLocale = async (
  locale,
  uploadId,
  nUnmentionedKeys,
) => {
  console.log(
    `\nAttempting to exclude ${nUnmentionedKeys} unmentioned keys in ${locale}...`,
  );

  // API call to /keys/exclude endpoint
  // https://developers.phrase.com/api/#patch-/projects/-project_id-/keys/exclude
  const excludeResponse = await fetch(`${BASE_API_URL}/keys/exclude`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Set target locale
      target_locale_id: locale,
      // Set query to "all unmentioned keys in upload specified by uploadId"
      q: `unmentioned_in_upload:${uploadId}`,
    }),
  });

  // Grab response body and log it
  const excludeResponseData = await excludeResponse.json();

  console.log(excludeResponseData);

  // If unsuccessful, exit
  if (excludeResponse.status !== 200) {
    console.error(
      `Excluding keys for locale '${locale}' failed - status: ${excludeResponse.status}.`,
    );
    process.exit(1);
  }

  // Grab the number of affected records (=number of keys we just excluded) from the response
  const { records_affected: nRecordsAffected } = excludeResponseData;

  // If for some reason the number of affected records does not match the number of unmentioned keys in the upload, exit
  if (nRecordsAffected !== nUnmentionedKeys) {
    console.error(
      `Excluding keys for locale '${locale}' failed: Exclusion affected ${nRecordsAffected} records, but ${nUnmentionedKeys} keys were unmentioned in upload '${uploadId}'.`,
    );
    process.exit(1);
  }
};

// Re-Include all keys in target locale (removes "excluded" status from affected keys)
export const includeKeysInLocale = async (locale) => {
  console.log(`\nAttempting to include all keys in ${locale} ...`);

  // API call to /keys/include endpoint
  // https://developers.phrase.com/api/#patch-/projects/-project_id-/keys/include
  const includeResponse = await fetch(`${BASE_API_URL}/keys/include`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Set target locale
      target_locale_id: locale,
      // Set query to "all"
      q: '*',
    }),
  });

  // Grab response data
  const includeResponseData = await includeResponse.json();

  // Show the response data
  console.log(includeResponseData);

  // Exit if unsuccessful
  if (includeResponse.status !== 200) {
    console.error(
      `Including keys for locale '${locale}' failed - status: ${includeResponse.status}.`,
    );
    process.exit(1);
  }
};
