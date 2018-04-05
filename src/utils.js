const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const rp = require('request-promise-native');
const transform = require('lodash.transform');
const isObject = require('lodash.isobject');

/**
 * The credentials object
 * @typedef {Object} Credentials
 * @property {string} oauth_consumer_key - The oauth consumer key
 * @property {string} consumer_secret  - The oauth consumer secret
 * @property {string} oauth_token - The oauth token
 * @property {string} oauth_token - The oauth token secret
 */

/**
 * Generate oauth request
 * @param {string} url
 * @param {Credentials} credentials
 * @param {string} [method='GET']
 * @throws {error} 'Credentials need to be specified'
 * @returns {string} Authorization header
 */
const generateOauthParameters = (url, credentials, method = 'GET') => {
  /* eslint-disable camelcase */
  const {
    oauth_consumer_key, consumer_secret, oauth_token, oauth_token_secret,
  } = credentials;
  if (!oauth_consumer_key || !consumer_secret || !oauth_token || !oauth_token_secret) {
    throw new Error('Credentials need to be specified', credentials);
  }
  /* eslint-enable */
  const oauth = OAuth({
    consumer: {
      key: oauth_consumer_key,
      secret: consumer_secret,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto
        .createHmac('sha1', key)
        .update(baseString)
        .digest('base64');
    },
  });
  return oauth.toHeader(oauth.authorize(
    {
      url,
      method,
    },
    {
      key: oauth_token,
      secret: oauth_token_secret,
    },
  ));
};

/**
 * Add credentials for subsequent requests
 * @param {Credentials} credentials
 * @returns {function} uri => promise
 */
/**
 * Curried request function
 * @param {string} uri
 * @returns {promise}
 */
const initRequest = credentials => (uri) => {
  const { Authorization } = generateOauthParameters(uri, credentials);
  const options = {
    uri,
    headers: { Authorization, accept: 'application/json' },
    json: true,
  };
  return rp(options);
};

/**
 * Deep map/alter the props in a (nested) object
 * @param {object/array} obj
 * @param {object} [mapping={}]
 * @param {object} [replace={}] { substr, newSubstr = '' }
 */
const deepRenameProps = (obj, mapping = {}, replace = {}) => {
  const { substr, newSubstr = '' } = replace;
  return transform(obj, (result, value, key) => {
    // Use mapped key if applicable
    let currentKey = mapping[key] || key;
    // replace parts of the key if needed
    if (typeof currentKey === 'string' && substr) {
      currentKey = currentKey.replace(substr, newSubstr);
    }
    // if key is an object recurse
    // eslint-disable-next-line no-param-reassign
    result[currentKey] = isObject(value) ? deepRenameProps(value, mapping, replace) : value;
  });
};

/**
 * Sanitize the urls by replacing the width and height
 * @param {array} urls
 * @param {object} config
 * @param {string} [method='SCALE_AND_CROP']
 * @returns {array}
 */
const sanitizePictureUrl = (urls, { width, height }, method = 'SCALE_AND_CROP') => {
  const url = urls[0].url.find(scaleUrl => scaleUrl['@scale'] === method);
  if (!url) return undefined;
  return url['@href'].replace('%WIDTH%', width).replace('%HEIGHT%', height);
};

/**
 * Get the attachments of an estate and return estate with sanitized urls
 * @param {string} attachmentsUrl
 * @param {function} request
 * @returns {promise}
 */
const getAttachments = (attachmentsUrl, request, imgMaxPixel) => {
  if (!attachmentsUrl) return Promise.resolve([]);
  const key = 'common.attachments';
  return request(attachmentsUrl).then((result) => {
    const { attachment = [] } = (result[key] && result[key][0]) || {};
    return attachment.map(({ title, urls, url }) => {
      if (!urls) return { title, url };
      return {
        title,
        url: sanitizePictureUrl(urls, imgMaxPixel, 'SCALE'),
      };
    });
  });
};

exports = {
  initRequest,
  getAttachments,
  deepRenameProps,
};
