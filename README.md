# gatsby-source-is24

This plugin uses the is24 real estate api and fetches all estates.

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
