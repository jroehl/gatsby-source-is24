const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const rp = require('request-promise-native');
const transform = require('lodash.transform');
const isObject = require('lodash.isobject');

const pluginName = 'gatsby-source-is24';

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
 * Source the nodes
 * @param {object}
 * @param {object} options
 */
module.exports.sourceNodes = async (
  { boundActionCreators: { createNode, deleteNode }, getNode, getNodes },
  {
    // credentials
    baseUrl = 'https://rest.immobilienscout24.de/restapi/api/offer/v1.0/user/me/realestate',
    // remove @ from keys to sanitize for graphql
    replacer = { substr: '@' },
    mapping,
    ...credentials
  },
) => {
  console.time('Fetching is24 estates');

  const request = initRequest(credentials);

  // Fetch all estate ids
  const list = (await request(baseUrl))['realestates.realEstates'].realEstateList.realEstateElement;

  const existingNodes = getNodes().filter(({ internal }) => internal.owner === pluginName);

  // Fetch single estate details
  const items = await Promise.all(list.map(async (element) => {
    const detail = await request(`${baseUrl}/${element['@id']}`);

    // remove weird is24 nesting
    const [type] = Object.keys(detail);
    const estate = detail[type];
    // merge list and details
    return { ...element, ...estate, type };
  }));

  console.log('');
  console.timeEnd('Fetching is24 estates');

  const sanitizedEstates = deepRenameProps(items, mapping, replacer);

  // remove deleted nodes
  existingNodes.forEach(({ id: existingId }) => {
    if (!sanitizedEstates.some(({ id }) => id === existingId)) {
      deleteNode((existingId, getNode(existingId)));
    }
  });

  // Process data into nodes.
  sanitizedEstates.forEach((estate) => {
    const content = JSON.stringify(estate);
    createNode({
      // Data for the node.
      ...estate,
      parent: null,
      children: [],
      internal: {
        type: 'is24Estates',
        content,
        contentDigest: crypto
          .createHash('md5')
          .update(content)
          .digest('hex'),
      },
    });
  });

  console.log(`Added/updated ${sanitizedEstates.length} estates as nodes`);
};
