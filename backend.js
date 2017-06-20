'use strict';
const express = require('express');
const app = express();
const body_parser = require('body-parser');

/*********** API-Related Packages **********/
const apicache = require('apicache');
const cache = apicache.middleware;
const axios = require('axios');

/*************** Database ***************/
const promise = require('bluebird');
const pgp = require('pg-promise')({
  promiseLib: promise,
});
//Development database settings
const db = pgp(process.env.DATABASE_URL||{
  host: 'localhost',
  // NOTE: change to your preferred port for development --
  // Must match your Postico settings
  port: 9001,
  database: 'fooddev',
  user: 'postgres',
});

// Production database settings

// const db = require('pg');
//
// db.defaults.ssl = true;
// db.connect(process.env.DATABASE_URL, function(err, client) {
//   if (err) throw err;
//   console.log('Connected to prod postgres')
// });

// NOTE: Sample query: Un-Comment to check connection to database
// db.query("SELECT * FROM restaurant")
//   .then(function(results) {
//     results.forEach(function(row) {
//         console.log(row.name, row.atmosphere, row.parking, row.busy);
//     });
//     return db.one("SELECT * FROM restaurant WHERE name='tout suit'");
//   })

/************* Yelp API ****************/
const yelp = require('yelp-fusion');
const yelp_token = process.env.YELP_ACCESS_TOKEN;
const yelp_client = yelp.client(yelp_token);
//
// NOTE: Sample query: Un-Comment to check connection to Yelp-Fusion API
// NOTE: Must have .env file with YELP_ACCESS_TOKEN to use API
yelp_client.search({
  term:'villa arcos',
  location: 'houston, tx'
}).then(response => {
  console.log(response.jsonBody.businesses[0]);
}).catch(err => {
  console.error(err);
});

/*********** App Configuration **************/
app.set('view engine', 'hbs');
app.use('/static', express.static('static'));
app.use('/axios', express.static('node_modules/axios/dist'));
app.use(body_parser.urlencoded({extended: false}));

/************** Server *******************/
app.get('/', function (req, resp) {
  resp.render('index.hbs');
});

/********* Search Engine ***********/
// NOTE: Currently works only for restaurant names
// Accepts GET parameters from search input and returns matching results
// from database

// Test in your dev environment:
// localhost:9000/search?search_term=piola
app.get('/search', function (req, resp, next) {
  let term = req.query.search_term;
  console.log(term);
  let query = "SELECT * FROM restaurant WHERE restaurant.name ILIKE '%$1#%'";
  db.any(query, term)
    .then(function (results_array) {
      console.log(results_array)
      resp.render('search_results.hbs', {results: results_array});
    })
    .catch(next);
});

let PORT = process.env.PORT || 9000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);
});
