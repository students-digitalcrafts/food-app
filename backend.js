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
  port: 7000,
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
app.get('/', function(req, resp) {
  resp.render('index.hbs');
});
//function that capitolize first letter of each word for autocomplete
function sentenceCase (str) {
  if ((str===null) || (str===''))
       return false;
  else
   str = str.toString();

 return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/**************autocomplete request****************/
app.get('/autocomplete/', function(request, response, next) {
  var selection = '%'+ request.query.selection +'%';
  //var choices = ['ActionScript', 'AppleScript', 'Asp', 'Assembly', 'BASIC', 'Batch', 'C', 'C++', 'CSS', 'Clojure', 'COBOL', 'ColdFusion', 'Erlang', 'Fortran', 'Groovy', 'Haskell', 'HTML', 'Java', 'JavaScript', 'Lisp', 'Perl', 'PHP', 'PowerShell', 'Python', 'Ruby', 'Scala', 'Scheme', 'SQL', 'TeX', 'XML'];
  //var suggestions = [];
  //for (var i=0;i<choices.length;i++)
    //if (~choices[i].toLowerCase().indexOf(selection)) suggestions.push(choices[i]);
  var suggestions = [];
  db.any(`SELECT name FROM category WHERE name ILIKE '${selection}'`)
  .then(function(results1) {
    results1.forEach(function(item){
      suggestions.push(sentenceCase(item.name));
    })
    //return suggestions;
    return db.any(`SELECT name FROM diet_rest WHERE name ILIKE '${selection}'`);
  })
  .then(function (results2) {
    results2.forEach(function(item){
      suggestions.push(sentenceCase(item.name));
    })
    return db.any(`SELECT name FROM restaurant WHERE name ILIKE '${selection}'`);
  })
  .then(function(results3){
    results3.forEach(function(item){
      suggestions.push(sentenceCase(item.name));
    })
    response.json({suggestions: suggestions});
  })
})


let PORT = process.env.PORT || 9000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);
});
