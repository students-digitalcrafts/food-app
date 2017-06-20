const express = require('express');
const app = express();

/*************** Database ***************/
const promise = require('bluebird');
const pgp = require('pg-promise')({
  promiseLib: promise,
});
const db = pgp({database: 'fooddev'});

/*********** API-Related Packages **********/
const apicache = require('apicache');
const cache = apicache.middleware;
const axios = require('axios');


/************* Yelp API ****************/
const yelp = require('yelp-fusion');
const yelp_token = process.env.YELP_ACCESS_TOKEN;
const yelp_client = yelp.client(yelp_token);


app.use('/axios', express.static('node_modules/axios/dist'));

yelp_client.search({
  term:'Four Barrel Coffee',
  location: 'san francisco, ca'
}).then(response => {
  console.log(response.jsonBody.businesses[0].name);
}).catch(e => {
  console.log(e);
});

var PORT = process.env.PORT || 8000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);
});
