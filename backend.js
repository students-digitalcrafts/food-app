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
const db = pgp({
  host: 'localhost',
  // NOTE: change to your preferred port for development --
  // Must match your Postico settings
  port: 9001,
  database: 'fooddev',
  user: 'postgres',
  });

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

// NOTE: Sample query: Un-Comment to check connection to Yelp-Fusion API
// NOTE: Must have .env file with YELP_ACCESS_TOKEN to use API
// yelp_client.search({
//   term:'villa arcos',
//   location: 'houston, tx'
// }).then(response => {
//   console.log(response.jsonBody.businesses[0]);
// }).catch(err => {
//   console.error(err);
// });

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
// NOTE: Currently works for restaurant names only!
// NOTE: Currently returns only one result!
// Accepts GET parameters from search input and returns matching result
// from database

// To test on your dev server: localhost:9000/search?search_term=piola
app.get('/search', function (req, resp, next) {
  let term = req.query.search_term;
  let query = "SELECT * FROM restaurant WHERE restaurant.name ILIKE '%$1#%'";
  let fields;
  db.any(query, term)
    // If the Yelp fields have been queried in the last week, do nothing.
    // Else, hit the Yelp API, save the data, update the last_updated field.
    .then(function (results_array) {
      let last_updated = results_array[0].last_updated;
      // if the last_updated field is NOT NULL and is < 7 days old (UTC)
      if(last_updated && (Date.now() - last_updated) < 604800000) {
          ; // do nothing
      } else {
        // hit Yelp API
        console.log("Contacting Yelp API");
        yelp_client.search({
          term: term,
          location: 'houston, tx'
        }).then(response => {
          // save desired data from Yelp API's JSON response
          let api_response = response.jsonBody.businesses[0];
          fields = {
            //NOTE: Need to update 'name', currently only works for restaurant names
            name: term,
            last_updated: Date.now,
            image_url: api_response.image_url,
            yelp_id: api_response.id,
            phone: api_response.phone,
            address: api_response.location.display_address.join(', ')
          };
          // SQL statement to save fields to database
          let query = "UPDATE restaurant \
            SET image_url = ${image_url}, \
            yelp_id = ${yelp_id}, \
            phone = ${phone}, \
            address = ${address}, \
            last_updated = ${last_updated} \
            WHERE name = ${name}"; //NOTE: Update 'name' here too!!
          db.result(query, fields)
          .then(function (result) {
            console.log(result);
            pgp.end();
          });
        }).catch(err => {
          console.error(err);
        });
      }
      resp.render('search_results.hbs', {results: results_array});
    })
    .catch(next);
});

/* NOTE: Steps for searching:
1. receive restaurant name, query database - DONE
2. check restaurant table last_updated - DONE
3. if last_updated null or >7 days old
      A. hit Yelp API - DONE
      B. save data from Yelp API and add timestamp.now to last_updated - DONE
4. query db, return results array
5. display on front end
*/


let PORT = process.env.PORT || 9000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);
});
