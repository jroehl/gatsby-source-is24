const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const rp = require('request-promise-native');
const transform = require('lodash/transform');
const isObject = require('lodash/isObject');

/**
 * Generate oauth request
 * credentials must contain
 *  {
 *    oauth_consumer_key : 'oauth_consumer_key',
 *    consumer_secret : 'consumer_secret',
 *    oauth_token : 'oauth_token',
 *    oauth_token_secret : 'oauth_token_secret',
 *  }
 *
 * @param {string} url
 * @param {object} credentials
 * @param {string} [method='GET']
 * @returns {string} Authorization header
 */
const generateOauthParameters = (url, credentials, method = 'GET') => {
  const oauth = OAuth({
    consumer: {
      key: credentials.oauth_consumer_key,
      secret: credentials.consumer_secret,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto
        .createHmac('sha1', key)
        .update(baseString)
        .digest('base64');
    },
  });
  return oauth.toHeader(
    oauth.authorize(
      {
        url,
        method,
      },
      {
        key: credentials.oauth_token,
        secret: credentials.oauth_token_secret,
      }
    )
  );
};

/**
 * Add credentials for subsequent requests
 * @param {object} credentials
 * @returns {function} uri => promise
 */
/**
 * Curried request function
 * @param {string} uri
 * @returns {promise}
 */
const initRequest = credentials => uri => {
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
    result[currentKey] = isObject(value) ? deepRenameProps(value, mapping, replace) : value;
  });
};

/**
 *
 * @param {object}
 * @param {object} options
 */
module.exports.sourceNodes = async (
  { boundActionCreators: { createNode, deleteNode }, getNode, getNodes, store },
  {
    // credentials
    oauth_consumer_key,
    consumer_secret,
    oauth_token,
    oauth_token_secret,
    baseUrl = 'https://rest.immobilienscout24.de/restapi/api/offer/v1.0/user/me/realestate',
    // remove @ from keys to sanitize for graphql
    replacer = { substr: '@' },
    mapping,
  }
) => {
  const pluginName = `gatsby-source-is24`;

  console.time('Fetching is24 estates');

  if (!oauth_consumer_key || !consumer_secret || !oauth_token || !oauth_token_secret) {
    console.error('Credentials need to be specified');
    process.exit(1);
  }

  const request = initRequest({
    oauth_consumer_key,
    consumer_secret,
    oauth_token,
    oauth_token_secret,
  });

  // Fetch all estate ids
  const list = (await request(baseUrl))['realestates.realEstates'].realEstateList.realEstateElement;

  const existingNodes = getNodes().filter(({ internal }) => internal.owner === pluginName);

  // Fetch single estate details
  const items = await Promise.all(
    list.map(async element => {
      const detail = await request(`${baseUrl}/${element['@id']}`);

      // remove weird is24 nesting
      const [type] = Object.keys(detail);
      const estate = detail[type];
      // merge list and details
      return { ...element, ...estate, type };
    })
  );

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
  sanitizedEstates.forEach(estate => {
    const content = JSON.stringify(estate);
    createNode({
      // Data for the node.
      ...estate,
      parent: null,
      children: [],
      internal: {
        type: `is24Estates`,
        content,
        contentDigest: crypto
          .createHash(`md5`)
          .update(content)
          .digest(`hex`),
      },
    });
  });

  return;
};
