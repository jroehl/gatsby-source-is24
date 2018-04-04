const { makeRequest, sanitizeDetails } = require('../lib/misc');
const cfg = require('../config');

exports.sourceNodes = async (
  { boundActionCreators: { createNode } },
  {
    // credentials
    oauth_consumer_key,
    consumer_secret,
    oauth_token,
    oauth_token_secret,
    ...remaining
  }
) => {
  const { baseUrl, maxPixel, fields } = { ...cfg, ...remaining };

  if (!oauth_consumer_key || !consumer_secret || !oauth_token || oauth_token_secret) {
    console.log('Credentials need to be specified');
    process.exit(1);
  }

  // Create nodes here, generally by downloading data
  // from a remote API.
  const res = await makeRequest(baseUrl, { oauth_consumer_key, consumer_secret, oauth_token, oauth_token_secret });
  const ids = res['realestates.realEstates'].realEstateList.realEstateElement.map(element => element['@id']);

  const details = await Promise.all(ids.map(id => makeRequest(`${baseUrl}/${id}`, credentials)));
  let estates = sanitizeDetails(details, fields);
  estates = await Promise.all(estates.map(estate => getAttachments(estate, credentials, maxPixel)));

  // Process data into nodes.
  data.forEach(estate =>
    createNode({
      // Data for the node.
      ...estate,
      parent: null,
      children: [],
      internal: {
        type: `is24${estate.id}`,
        content: JSON.stringify(estate),
        contentDigest: crypto
          .createHash(`md5`)
          .update(JSON.stringify(estate))
          .digest(`hex`),
      },
    })
  );

  // We're done, return.
  return;
};
