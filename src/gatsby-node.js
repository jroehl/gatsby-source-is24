const crypto = require('crypto');
const { getAttachments, initRequest, deepRenameProps } = require('./utils');

const pluginName = 'gatsby-source-is24';

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
    const attachmentUrl =
        estate.attachments && estate.attachments[0]
          ? estate.attachments[0]['@xlink.href']
          : undefined;

      // merge list and details
    return {
      ...element,
      ...estate,
      type,
      attachments: attachmentUrl ? await getAttachments(attachmentUrl, request) : undefined,
    };
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
