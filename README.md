# gatsby-source-is24

This plugin uses the is24 real estate api and fetches all estates.

## Install

`npm install --save gatsby-source-is24`

## How to use

```javascript
// In your gatsby-config.js
plugins: [
  resolve: `gatsby-source-is24`,
  options: {
    // mandatory option properties
    oauth_consumer_key: 'oauth_consumer_key',
    consumer_secret: 'consumer_secret',
    oauth_token: 'oauth_token',
    oauth_token_secret: 'oauth_token_secret',
    // optional option properties
    // baseUrl: 'https://rest.immobilienscout24.de/restapi/api/offer/v1.0/user/me/realestate', // The base url to query
    // maxPixel: 4000, // maximum pixel of longest side of attachments
    // fields: [
    //   'list of fields to be kept'
    // ]
  }
]
```

## How to query

You can query npm nodes like the following

```graphql
{
  allIs24Packages {
    edges {
      node {
      }
    }
  }
}
```
