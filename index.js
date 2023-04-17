const core = require('@actions/core');
const {
  includeKeysInLocale,
  uploadLocaleFile,
  checkUploadStatus,
  excludeKeysInLocale,
} = require('./src/_phrase_utils');

const run = async () => {
  try {
    const reset = core.getInput('reset');
    if (reset === 'true') {
      await phraseResetExclusions();
    } else {
      await phraseSync();
    }
  } catch (error) {
    core.setFailed(error.message);
  }
};

const phraseResetExclusions = async () => {
  // Re-include all keys for "en" and "de"
  await includeKeysInLocale('en');
  await includeKeysInLocale('de');

  core.info('Successfully re-included all keys.');
};

const phraseSync = async () => {
  // Upload en.json to Phrase and grab the uploadId
  const uploadId = await uploadLocaleFile();
  // Check above upload's status until successful and grab the number of unmentioned keys
  const nUnmentionedKeys = await checkUploadStatus(uploadId);

  // If there are unmentioned keys, exclude them from "en" and "de"
  if (nUnmentionedKeys > 0) {
    await excludeKeysInLocale('en', uploadId, nUnmentionedKeys);
    await excludeKeysInLocale('de', uploadId, nUnmentionedKeys);

    console.log('\nSuccessfully excluded unmentioned keys.');
  }
};

run();
