const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const rp = require('request-promise-native');

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
 * Make a request
 * @param {string} uri
 * @param {object} credentials
 * @returns {promise}
 */
const makeRequest = (uri, credentials) => {
  const { Authorization } = module.exports.generateOauthParameters(uri, credentials);
  const options = {
    uri,
    headers: { Authorization, accept: 'application/json' },
    json: true,
  };
  return rp(options);
};

module.exports.sourceNodes = async (
  { boundActionCreators: { createNode } },
  {
    // credentials
    oauth_consumer_key,
    consumer_secret,
    oauth_token,
    oauth_token_secret,
    baseUrl = 'https://rest.immobilienscout24.de/restapi/api/offer/v1.0/user/me/realestate',
  }
) => {
  console.log('Fetching is24 estates');

  if (!oauth_consumer_key || !consumer_secret || !oauth_token || !oauth_token_secret) {
    console.error('Credentials need to be specified');
    process.exit(1);
  }

  const credentials = {
    oauth_consumer_key,
    consumer_secret,
    oauth_token,
    oauth_token_secret,
  };
  // Fetch all estate ids
  const res = await makeRequest(baseUrl, credentials);
  // Fetch single estate
  const items = await Promise.all(
    res['realestates.realEstates'].realEstateList.realEstateElement.map(element => makeRequest(`${baseUrl}/${element['@id']}`, credentials))
  );

  // Process data into nodes.
  items.forEach(item => {
    const key = Object.keys(item)[0];
    const estate = item[key];
    createNode({
      // Data for the node.
      id: estate['@id'],
      ...estate,
      key,
      parent: null,
      children: [],
      internal: {
        type: `is24Estates`,
        content: JSON.stringify(estate),
        contentDigest: crypto
          .createHash(`md5`)
          .update(JSON.stringify(estate))
          .digest(`hex`),
      },
    });
  });

  // We're done, return.
  return;
};
