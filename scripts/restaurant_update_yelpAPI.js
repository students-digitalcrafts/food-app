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
/*********** API-Related Packages **********/
const apicache = require('apicache');
const cache = apicache.middleware;
const axios = require('axios');

/************* Yelp API ****************/
const yelp = require('yelp-fusion');
const yelp_token = process.env.YELP_ACCESS_TOKEN;
const yelp_client = yelp.client(yelp_token);

var promiseChain = [];
var now = Date.now()
var sevenDaysAgo = now - 604800000;
// Logic to determine if row needs updating (Date.now() - last_updated) < 604800000)
// Value of 7 days in milliseconds: 604800000
// Value of about 14 days in ms: 1204800000
// UTC Value of 14 days ago: 1497290514994
// UTC Value of 3 days: 259200000
// UTC value of about 3 days ago: 1498191049067

// Query the database for rows that need to be updated
db.query(`SELECT id, name FROM restaurant WHERE yelp_id IS NULL OR last_updated < ${sevenDaysAgo}`)
.then(function(results){
  promiseChain.push(results);
  // console.log('SQL results: '+results);
})
.then(response => {
  //Iterate insert into promiseChain Yelp API results for every row that needs to be updated
  for (let i=0; i < promiseChain[0].length; i++) {
    yelp_client.search({
      term: promiseChain[0].name,
      location: 'houston, tx'
    })
    .then(function(){

    })
  }

  // save desired data from Yelp API's JSON response
  let api_response = response.jsonBody.businesses[0];
  fields = {
    name: 'villa arcos',
    last_updated: Date.now(),
    image_url: api_response.image_url,
    yelp_id: api_response.id,
    phone: api_response.phone,
    address: api_response.location.display_address.join(', '),
    latitude: api_response.coordinates.latitude,
    longitude: api_response.coordinates.longitude
  };

  // console.log('Lat: '+fields.latitude+' Long: '+fields.longitude)
  promiseChain.push(fields);
})
.then(function(){
  let query = "UPDATE restaurant \
          SET image_url = ${image_url}, \
          yelp_id = ${yelp_id}, \
          phone = ${phone}, \
          address = ${address}, \
          last_updated = ${last_updated} \
          WHERE name = ${name}";
  console.log('Last updated value of singular API response: '+promiseChain[1].last_updated)
  console.log('Results of SQL query of results that need to be updated: '+promiseChain[0][0].id+' Length of list: '+promiseChain[0].length)

})
.then(function(){

})
.catch(function (err){
    error.log(err);
});
// db.one(`SELECT * FROM restaurant \
//   WHERE yelp_id is NULL'`)
//   .then(function(result){
//     req.session.restaurant = result;
//     let last_updated = result.last_updated;
//     // if the last_updated field is NOT NULL and is < 7 days old (UTC)
//     if(last_updated && (Date.now() - last_updated) < 604800000) {
//       resp.redirect('/detail/');
//     } else {
//       // hit Yelp API
//       console.log("Contacting Yelp API");
//       yelp_client.search({
//         term: term,
//         location: 'houston, tx'
//       }).then(response => {
//         // save desired data from Yelp API's JSON response
//         let api_response = response.jsonBody.businesses[0];
//         fields = {
//           name: term,
//           last_updated: Date.now,
//           image_url: api_response.image_url,
//           yelp_id: api_response.id,
//           phone: api_response.phone,
//           address: api_response.location.display_address.join(', ')
//         };
//         // SQL statement to save fields to database
//         let query = "UPDATE restaurant \
//           SET image_url = ${image_url}, \
//           yelp_id = ${yelp_id}, \
//           phone = ${phone}, \
//           address = ${address}, \
//           last_updated = ${last_updated} \
//           WHERE name = ${name}";
//         db.result(query, fields)
//         .then(function (update_result) {
//           // Takes fields from API response and merges them with db result fields
//           result = Object.assign(result, fields);
//           req.session.restaurant = result;
//           // NOTE: Add redirect to detail page
//           resp.redirect('/detail/');
//           pgp.end();
//         });
//       }).catch(err => {
//         console.error(err);
//       });
//     }
//   })
//   .catch(function (next){
//     resp.send("Not found");
