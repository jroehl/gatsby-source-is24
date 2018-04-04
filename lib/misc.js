const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const moment = require('moment');
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
 * Sanitize the state of the estate
 *
 * @param {string|boolean} [realEstateState='']
 * @returns {boolean}
 */
const getState = (realEstateState = '') => {
  const isBool = typeof realEstateState === 'boolean';
  if ((isBool && realEstateState === false) || (!isBool && realEstateState.match(/(INACTIVE|ARCHIVED|TO_BE_DELETED)/i))) {
    return false;
  } else if ((isBool && realEstateState === true) || (!isBool && realEstateState.match(/ACTIVE/i))) {
    return true;
  }
  return undefined;
};

/**
 * Sanitize the date and return epoch time
 * @param {string|number} date
 * @returns {number}
 */
const sanitizeDate = date => {
  if (!isNaN(date)) return date;
  return moment(date).valueOf();
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

/**
 * Sanitize the estate details (rename, update, remove keys)
 * @param {array} estates
 * @param {array} fields
 * @returns {array}
 */
const sanitizeDetails = (estates, fields) =>
  estates.map(item => {
    const key = Object.keys(item)[0];
    const estate = item[key];
    let price;
    if (estate.price) {
      price = {
        marketingType: estate.price.marketingType,
        value: estate.price.value,
        currency: estate.price.currency,
        priceIntervalType: estate.price.priceIntervalType,
      };
    } else {
      price = {
        marketingType: 'RENT',
        value: estate.totalRent,
        currency: 'EUR',
      };
    }
    return Object.assign(
      {},
      {
        title: estate.title,
        id: estate['@id'],
        internalId: estate.externalId,
        estateType: estate['@xsi.type'] || key.split('.')[1],
        tradeType: estate.apartmentType || estate.buildingType || estate.estateType || estate.investmentType,
        createdAt: sanitizeDate(estate.creationDate || estate['@creation']),
        updatedAt: sanitizeDate(estate.lastModificationDate || estate['@modified'] || estate['@modification']),
        address: estate.address
          ? {
              country: estate.address.country,
              street: estate.address.street,
              houseNumber: estate.address.houseNumber,
              city: estate.address.city,
              postcode: estate.address.postcode,
              coordinates: estate.address.wgs84Coordinate
                ? {
                    latitude: estate.address.wgs84Coordinate.latitude,
                    longitude: estate.address.wgs84Coordinate.longitude,
                  }
                : undefined,
            }
          : undefined,
        active: getState(estate.realEstateState),
        handicappedAccessible: estate.handicappedAccessible || estate.assistedLiving,
        heatingTypeEnev2014: estate.heatingTypeEnev2014 || estate.heatingType,
        minDivisible: estate.minDivisible || estate.areaDivisibleFrom,
        numberOfRoomsFrom: estate.numberOfRoomsFrom || estate.roomAvailableFrom,
        numberOfRoomsTo: estate.numberOfRoomsTo || estate.numberOfRoomsTo,
        energySourcesEnev2014: estate.energySourcesEnev2014 ? estate.energySourcesEnev2014.energySourceEnev2014 : undefined,
        energyCertificateAvailability: estate.energyCertificate ? estate.energyCertificate.energyCertificateAvailability : undefined,
        energyCertificateCreationDate: estate.energyCertificate ? estate.energyCertificate.energyCertificateCreationDate : undefined,
        attachments: estate.attachments && estate.attachments[0] ? estate.attachments[0]['@xlink.href'] : undefined,
        price,
      },
      fields.reduce((obj, field) => {
        if (estate[field] === undefined) return obj;
        return Object.assign({}, obj, { [field]: estate[field] });
      }, {})
    );
  });

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
 * @param {object} estate
 * @param {object} credentials
 * @param {number} maxPixel
 * @returns {promise}
 */
const getAttachments = (estate, credentials, maxPixel) => {
  if (!estate.attachments) return Promise.resolve([]);
  const key = 'common.attachments';
  return makeRequest(estate.attachments, credentials).then(result => {
    const { attachment = [] } = (result[key] && result[key][0]) || {};
    const attachments = attachment.map(({ title, urls, url }) => {
      if (!urls) return { title, url };
      return {
        title,
        url: sanitizePictureUrl(urls, maxPixel, 'SCALE'),
      };
    });
    return Object.assign({}, estate, { attachments });
  });
};

module.exports = {
  generateOauthParameters,
  getState,
  sanitizeDate,
  makeRequest,
  sanitizeDetails,
};
