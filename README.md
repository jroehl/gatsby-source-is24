# gatsby-source-is24

[![Build Status](https://travis-ci.org/jroehl/gatsby-source-is24.svg?branch=master)](https://travis-ci.org/jroehl/gatsby-source-is24)
[![npm](https://img.shields.io/npm/v/gatsby-source-is24.svg)](https://www.npmjs.com/package/gatsby-source-is24)
[![Code Style](https://img.shields.io/badge/code%20style-eslint--airbnb-brightgreen.svg)](https://github.com/mycsHQ/eslint-config-airbnb)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

This plugin uses the is24 real estate api and fetches all estates for a single user. It does only work with pregenerated oauth credentials. The estates are fetched for the logged in user.

- [gatsby-source-is24](#gatsby-source-is24)
  - [Install](#install)
  - [How to use](#how-to-use)
  - [How to query](#how-to-query)
  - [TODO](#todo)

## Install

`npm install --save jroehl/gatsby-source-is24`

## How to use

```javascript
// In your gatsby-config.js
plugins: [
  resolve: `gatsby-source-is24`,
  options: {
    // required option properties
    oauth_consumer_key: 'oauth_consumer_key',
    consumer_secret: 'consumer_secret',
    oauth_token: 'oauth_token',
    oauth_token_secret: 'oauth_token_secret',
    // optional option properties
    // baseUrl = 'https://rest.immobilienscout24.de/restapi/api/offer/v1.0/user/me/realestate', // The base url to query
    // replacer = { substr: '@' }, // replacer object to be used for sanitizing the properties
    // mapping, // mapping object to be used for mapping the properties
  }
]
```

## How to query

You can query npm nodes like the following

```graphql
allEstates {
  allIs24Estates {
    edges {
      node {
        id
        title
      }
    }
  }
}

singleEstate {
  is24Estates(id: { eq: "123456" }) {
    id
    title
  }
}
```

## TODO

* write tests
* Find way to install as git package
* Roll out for other types
