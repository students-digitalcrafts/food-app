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
  port: 8080,
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

//function that capitalizes first letter of each word in a string
function sentenceCase (str) {
  if ((str===null) || (str===''))
       return false;
  else
   str = str.toString();

 return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/**************autocomplete request****************/

app.get('/autocomplete/', function(request, response, next) {
  // gets the user inputs and adds % signs to both ends so it can accept characters on both sides on ILIKE
  var selection = '%'+ request.query.selection +'%';
  var suggestions = [];
// queries for all cuisine types names
db.any(`SELECT name FROM cuisine_type WHERE name ILIKE '${selection}'`)
  .then(function(results1) {
  // for loop to add all the results to the array that will be passed back
  results1.forEach(function(item){
    suggestions.push(sentenceCase(item.name));
  })
  // queries for all category names
  return db.any(`SELECT name FROM category WHERE name ILIKE '${selection}'`)
  })
  .then(function(results2) {
    // for loop to add all the results to the array that will be passed back
    results2.forEach(function(item){
      suggestions.push(sentenceCase(item.name));
    })
    // queries for all dietary restriction names
    return db.any(`SELECT name FROM diet_rest WHERE name ILIKE '${selection}'`);
  })
  .then(function (results3) {
    // for loop to add all the results to the array that will be passed back
    results3.forEach(function(item){
      suggestions.push(sentenceCase(item.name));
    })
    // queries for all the restaurant names
    return db.any(`SELECT name FROM restaurant WHERE name ILIKE '${selection}'`);
  })
  .then(function(results4){
    // for loop to add all the results to the array that will be passed back
    results4.forEach(function(item){
      suggestions.push(sentenceCase(item.name));
    })
    if (suggestions.length === 0){
      // if no matches return "No match was found"
      response.json({suggestions:["No match was found"]});
    }
    else {
      // return the suggestions to the query to the frontend api
      response.json({suggestions: suggestions});
    }
  });
});

/********* Search Engine ***********/
// NOTE: Currently works for restaurant names only!
// Accepts GET parameters from search input and returns matching result
// from database

// To test on your dev server: localhost:9000/search?search_term=piola
app.get('/search/', function (req, resp, next) {
  let term = req.query.search_term.toLowerCase();
  let query = `SELECT * FROM restaurant WHERE restaurant.name = '${term}'`;
  let fields;
  db.one(query, term)
    // If the Yelp fields have been queried in the last week, do nothing.
    // Else, hit the Yelp API, save the data, update the last_updated field.
    .then(function (result) {
      let last_updated = result.last_updated;
      // if the last_updated field is NOT NULL and is < 7 days old (UTC)
      if(last_updated && (Date.now() - last_updated) < 604800000) {
        resp.render('search_results.hbs', {result: result});
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
            WHERE name = ${name}";
          db.result(query, fields)
          .then(function (update_result) {
            // Takes fields from API response and merges them with db result fields
            result = Object.assign(result, fields);
            resp.render('search_results.hbs', {result: result});
            pgp.end();
          });
        }).catch(err => {
          console.error(err);
        });
      }
    })
    .catch(next);
});


let PORT = process.env.PORT || 9000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);

});
