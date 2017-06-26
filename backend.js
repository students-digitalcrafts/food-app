'use strict';
const express = require('express');
const app = express();
const body_parser = require('body-parser');
const session = require('express-session');

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
// yelp_client.search({
//   term:'villa arcos',
//   location: 'houston, tx'
// }).then(response => {
//   console.log(response.jsonBody.businesses[0]);
// }).catch(err => {
//   console.error(err);
// });

/*********** App Configuration **************/
var hbs = require('hbs');
app.set('view engine', 'hbs');
hbs.registerPartials('views/partials');

app.use('/static', express.static('static'));
app.use('/axios', express.static('node_modules/axios/dist'));
app.use(body_parser.urlencoded({extended: false}));
app.use(body_parser.json());
app.use(session({
  secret: process.env.SECRET_KEY || 'dev',
  resave: true,
  saveUninitialized: false,
  cookie: {maxAge: 900000}
}));

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
  selection = selection.replace("'","''");
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
// Accepts GET parameters from search input and returns matching result
// from database NOTE: rendering a new page (needs to be done)

// To test on your dev server: localhost:9000/search?search_term=piola
app.get('/search/', function (req, resp, next) {
  let term = req.query.search_term.toLowerCase();
  // replace ' with '' for querying purposes
  let termquote = term.replace("'","''");
  let fields;
  // Checks if the user input is a cuisine_type, if it is, pass it to the frontend
  db.many(`SELECT DISTINCT restaurant.* FROM restaurant \
          JOIN dish ON dish.restaurant_id = restaurant.id \
          JOIN cuisine_type ON dish.cuisine_type_id = cuisine_type.id \
          WHERE cuisine_type.name = '${termquote}' ORDER BY restaurant.name`)
    .then(function(result){
      req.session.list = result;
      // Pass search term to display on Listings page
      resp.render("listing.hbs", {results: result, term: term});
    })
    .catch(function (next){
      // Checks if the user input is a category, if it is, pass it to the frontend
      db.many(`SELECT DISTINCT restaurant.* FROM restaurant \
              JOIN dish ON dish.restaurant_id = restaurant.id \
              JOIN category_dish_join ON category_dish_join.dish_id = dish.id \
              JOIN category ON category_dish_join.category_id = category.id \
              WHERE category.name = '${termquote}' ORDER BY restaurant.name`)
        .then(function(result){
          req.session.list = result;
          resp.render("listing.hbs", {results: result, term: term});
        })
        .catch(function (next){
          // Checks if the user input is a diet_rest, if it is, pass it to the frontend
          db.many(`SELECT DISTINCT restaurant.* FROM restaurant \
                  JOIN dish ON dish.restaurant_id = restaurant.id \
                  JOIN diet_rest_dish_join ON diet_rest_dish_join.dish_id = dish.id \
                  JOIN diet_rest ON diet_rest_dish_join.diet_rest_id = diet_rest.id \
                  WHERE diet_rest.name = '${termquote}' ORDER BY restaurant.name`)
            .then(function(result){
              req.session.list = result;
              resp.render("listing.hbs", {results: result, term: term});
            })
            .catch(function (next){
              // Checks if the user input is a restaurant, if it is, pass it to the frontend

              db.one(`SELECT * FROM restaurant \
                WHERE name = '${termquote}'`)
                .then(function(result){
                  req.session.restaurant = result;
                  let last_updated = result.last_updated;
                  // if the last_updated field is NOT NULL and is < 7 days old (UTC)
                  if(last_updated && (Date.now() - last_updated) < 604800000) {
                    resp.redirect('/detail/');
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
                        req.session.restaurant = result;
                        // NOTE: Add redirect to detail page
                        resp.redirect('/detail/');
                        pgp.end();
                      });
                    }).catch(err => {
                      console.error(err);
                    });
                  }
                })
                .catch(function (next){
                  resp.send("Not found");
                })
            })
        })
    })
  });

/********* restaurant a-z page ***********/
//list of restaurants a-z that link to the individual restaurant pages.
app.get('/restaurants/', function (request, response, next) {
  db.query(`SELECT name FROM restaurant ORDER BY name`)
  .then(function(results) {
    // console.log(results);
    // console.log(results[0].name);
    for (let x = 0; x < results.length; x++) {

      results[x].namehtml = results[x].name.replace(/'/g,"%27");
      results[x].namehtml = results[x].name.replace(/ /g, "+");
    }
    var sorted = {};
    var htmlname = [];
results.forEach(function (item){
  if(sorted[item.name[0]]){
    sorted[item.name[0]].push({name: item.name, html: item.namehtml});
  }
  else{
    sorted[item.name[0]] = [];
    sorted[item.name[0]].push({name: item.name, html: item.namehtml});
  }
  console.log(sorted);
})
    response.render('restaurants.hbs', {results: results, sorted: sorted});
  })
  .catch(next);

});
/********* About Page ***********/
//A lovely page describing the wonderful creators of foodformymood

app.get('/about/', function(request, response) {
  response.render('about.hbs');
});

/********* Contribute Page ***********/
//coming soon
app.get('/contribute/', function(request, response) {
  response.render('contribute.hbs');
});

/********* Moods Page ***********/

app.get('/moods/', function(request, response) {
  response.render('moods.hbs');
})

/************ Restaurant Detail Page ***************/

// NOTE: Fix this page to use slug rather than GET params
// NOTE: Unnecessary -- extended session length to 15 mins instead

app.get("/detail/", function(req, resp, next) {
  // Restaurant selected by the user, assigned from GET params in search
  let restaurant = req.session.restaurant;
  // Select dishes that correspond to the restaurant
  let query = `SELECT * FROM dish \
    WHERE restaurant_id = ${restaurant.id}`;
  db.any(query)
    .then(function(result) {
      resp.render('detail.hbs', {
        restaurant: restaurant,
        dishes: result,
        map_key: process.env.GOOGLE_STATIC_MAP_KEY});
    })
})

  /********* Calculate Distance ******/
function degrees_to_radians(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}

function calculateDistance(lat1, lat2){
  var R = 6371e3; // metres
  var φ1 = lat1.toRadians();
  var φ2 = lat2.toRadians();
  var Δφ = (lat2-lat1).toRadians();
  var Δλ = (lon2-lon1).toRadians();

  var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ/2) * Math.sin(Δλ/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  var d = R * c;
  return d
}


  /********* Order By ****************/

app.post("/order_by/", function(request, response, next){
  if(request.body.order === "ratings"){
    var ordered = [];
    request.session.list.forEach(function(item){
      var added = false;
      if (ordered.length === 0){
        ordered.push(item);
        added = true;
      }
      else{
        for(var i=0; i<ordered.length; i++){
          if(item.ratings > ordered[i].ratings){
            ordered.splice(i, 0, item);
            added = true;
            break;
          }
        }
      if(!added){
        ordered.push(item);
      }
      }
    })
  }
  if (ordered.length === 0){

  }
  else{
    response.render('partials/list.hbs', {layout: false, results: ordered});
  }
})


  /********* Filter Engine ***********/

app.post("/filter/", function(request, response, next){
  // generates an object that will store the filter attributes
  var toFilter = {};
  // check for the length of toFilter
  var bodyLength = 0;
  // list of restaruant ids that were rendered in the listing page
  var restId = []
  // pulls the restaurants objects from the session.list and pushes the restaurant id to the restId list
  request.session.list.forEach(function(item){
    restId.push(item.id);
  });
  // creates a query that queries the restaurants by id from the restId list
  var restIdQuery = "id IN (" + restId.toString() + ") AND ";
  let query = `SELECT * FROM restaurant WHERE ` + restIdQuery;
  // generates an object that will store the filter attributes sent through a POST internal api
  for(var key in request.body){
    if (request.body[key].length > 0){
      toFilter[key] = request.body[key];
      bodyLength += 1;
    }
  }
  // if the user filters by any dietary restrition, creates a query that will query for all of them using the logical operator OR
  if(toFilter["diet_rest"]){
    var diet_restQuery = "id IN (SELECT DISTINCT restaurant_id FROM restaurant_diet_rest_join WHERE ";
    toFilter["diet_rest"].forEach(function(item){
      diet_restQuery += "diet_rest_id=" + item + " OR ";
    })
    // removes the OR from the last adition in the forEach
    diet_restQuery = diet_restQuery.slice(0,-4) + ")";
    // if there is filter by atmosphere or food_quickness, adds AND to the end of the query
    if(bodyLength > 1){
      diet_restQuery += " AND ";
    }
  }
  // if it doesn't filter by dietary restriction, sets the query to an empty string
  else{
    var diet_restQuery = "";
  }
  // if the user filters by any atmosphere, creates a query that will query for all of them through a tuple of cases
  if(toFilter["atmosphere"]){
    // converts the list of atmosphere options selected by the user into a string
    var atmosphereQuery = "atmosphere IN ('" + toFilter["atmosphere"].toString() + "')";
    // add single quotes to each element to be used in the query
    atmosphereQuery = atmosphereQuery.replace(",", "\',\'");
    // if there is filter by food_quickness, adds AND to the end of the query
    if(toFilter["food_quickness"]){
      atmosphereQuery += " AND ";
    }
  }
  // if it doesn't filter by atmosphere, sets the query to an empty string
  else{
    var atmosphereQuery = "";
  }
  // if the user filters by open now, queries YELP's api to check and return a boolean value
  if(toFilter["open_now"]){
    // NOTE: add promise for yelp open now
    // restId is a list with all the rendered restaurants
  }
  else{
    var open_nowQuery = ""; // to be deleted
  }
  // if toFilter is an empty object (the user hasn't filtered), returns the list from the previous search, that was stored in sessions.list
  if(Object.keys(toFilter).length === 0 && toFilter.constructor === Object){
    // sends the list from the previous search to a partial, sends the partial html text to the frontend to be rendered
    response.render('partials/list.hbs', {layout: false, results: request.session.list});
  }
  // if the user filtered, apply the query
  else{
    db.any(query+diet_restQuery+atmosphereQuery)
      .then(function (result){
        // sends the query results to a partial, sends the partial html text to the frontend to be rendered
        response.render('partials/list.hbs', {layout: false, results: result});
      })
      .catch(function(error){
        console.error(error);
      })
  }
})


//Function to Generate Add Restaurant form
function addRestaurant(request, response){
  var queryResults = [];
  queryResults.push(request)
  var moodQuery = "SELECT name, id FROM mood ORDER BY name ASC";
  db.query(moodQuery)
  .then(dbresults =>{
    queryResults.push(dbresults);
    return queryResults;
  })
  .then(function(queryResults){
    response.render('add_restaurant.hbs', {title:'Add New Restaurant',
      mood:queryResults[1],layout:false, req:queryResults[0]});
  })

}

//Add restaurant form

app.get('/add_restaurant/', function (req, resp) {
  addRestaurant(req, resp);
});

app.post('/add_restaurant/', function (request, resp, next) {
  var req = request;
  //Escape out of single quotes and convert restaurant name to lowercase
  req.body.name = req.body.name.replace(/'/g,"''");
  req.body.name = req.body.name.toLowerCase();
  req.body.description = req.body.description.replace(/'/g,"''");
  function insert_rest(req) {
  // Insert in to Restaurant table
  //Attempt at sanitizing inputs (not working)
  // var submit_restaurantValues = JSON.stringify(req.body);
  // console.log('Submit: '+submit_restaurantValues.name);
  var restaurantInsert = `INSERT INTO restaurant \
    (name, atmosphere, parking, busy, food_quickness, description) \
    VALUES ('${req.body.name}', '${req.body.atmosphere}', '${req.body.parking}', \
      '${req.body.busy}', '${req.body.food_quickness}', '${req.body.description}');`
    db.result(restaurantInsert)
    .then(function(result0){
  //Give id of newly inserted restaurant
      return db.query(`SELECT id FROM restaurant ORDER BY id DESC LIMIT 1;`);
    })
  //Insert in to diet restriction join table
    .then(function(result1){
      if (req.body.diet_rest) {
        for (let i = 0; i < req.body.diet_rest.length; i++) {
          db.query(`INSERT INTO restaurant_diet_rest_join \
            (restaurant_id, diet_rest_id) VALUES (${result1[0].id}, \
              ${req.body.diet_rest[i]});`)
        }
          }
      return result1;
    })
  //Insert in to mood join table
    .then(function(result1){
      if (req.body.mood) {
        for (let i = 0; i < req.body.mood.length; i++) {
          db.query(`INSERT INTO mood_restaurant_join \
            (restaurant_id, mood_id) VALUES (${result1[0].id}, \
              ${req.body.mood[i]});`)
        }
      }
    })
    .then(function(result2) {
      addRestaurant(req, resp);
      // resp.render('add_restaurant.hbs', {req: req, titlelayout:false})
    })
    .catch(next);
  }
  insert_rest(req);
});


//Generate dish form function, pulling most recent values from database
function add_dish_func (req, resp) {
  var queryResults = [];
  queryResults.push(req);
  //Query for restaurant name and id and push to output array
  var restaurantQuery = "SELECT name, id FROM restaurant ORDER BY name ASC";
  db.query(restaurantQuery)
  .then(dbresults =>{
    queryResults.push(dbresults);
  })
  .then(function(){
  //Query for cuisine type and id and push to output array
    var cuisineQuery = "SELECT name, id FROM cuisine_type ORDER BY name ASC";
    return db.query(cuisineQuery);
  })
  .then(function(cuisineQuery) {
    queryResults.push(cuisineQuery);
  })
  //Query for category and id and push to output array
  .then(function(){
    var categoryQuery = "SELECT name, id from category ORDER BY name ASC";
    return db.query(categoryQuery)
  })
  .then(function(categoryQuery){
    queryResults.push(categoryQuery);
    return queryResults;
  })
  .then(function(queryResults){
    resp.render('add_dish.hbs', {title:'Add New Dish', req:queryResults[0],
      restaurantName:queryResults[1], cuisineType:queryResults[2],
      category:queryResults[3], layout:false});
  })
}
//Add dish form GET

app.get('/add_dish/', function (request, resp) {
  add_dish_func(request, resp);
})

app.post('/add_dish/', function (request, resp, next) {
  var req = request;
  var resp = resp;
  req.body.name = req.body.name.replace(/'/g,"''");
  req.body.name = req.body.name.toLowerCase();
  req.body.description = req.body.description.replace(/'/g,"''");
  function insert_rest(req, resp) {
    //Add one to one values in the Dish table
    db.query(`INSERT INTO dish (name, description, restaurant_id, price, dish_type, \
      spice, adventurous, shareable) \
      VALUES ('${req.body.name}', '${req.body.description}', ${req.body.restaurantId}, \
      ${req.body.price}, '${req.body.type}', ${req.body.spicy}, ${req.body.adventurous}, \
      ${req.body.shareable});`)
    // Get the newly added dish ID
    .then(function(){
      return db.query('SELECT id FROM dish ORDER BY id DESC LIMIT 1;');
    })
    //If an existing cuisine type is selected, insert here by new dish ID
    .then(function(newDishId){
      if (req.body.cuisineTypeId){
        db.query(`UPDATE dish SET cuisine_type_id=${req.body.cuisineTypeId} WHERE id=${newDishId[0].id}`)
      }
      return newDishId[0].id;
    })
    //If there are dietary restrictions, insert them here in the join table
    .then(function(newDishId){
      if (req.body.diet_rest) {
        for (let i = 0; i < req.body.diet_rest.length; i++) {
          db.query(`INSERT INTO diet_rest_dish_join \
            (dish_id, diet_rest_id) VALUES (${newDishId}, ${req.body.diet_rest[i]});`)
        }
          }
      return newDishId
    })
    //If there are any checked categories, insert them here in join table
    .then(function(newDishId){
      if(req.body.category) {
        for (let i = 0; i < req.body.category.length; i++) {
          db.query(`INSERT INTO category_dish_join \
            (dish_id, category_id) VALUES (${newDishId}, ${req.body.category[i]});`)
        }
      }
      return newDishId;
    })
    //Add new Category if user added
    .then(function(newDishId){
    console.log("req.body.category: "+req.body.category)
      if(req.body.add_category) {
        db.query(`INSERT INTO category (name) VALUES ('${req.body.add_category}')`)
    //Get ID of newly added category
        .then(function(){
          return db.query(`SELECT id FROM category ORDER BY id DESC LIMIT 1;`)
        })
    //Insert new category ID in to join table with new dish ID
        .then(function(newCatId){
          db.query(`INSERT INTO category_dish_join (dish_id, category_id) \
            VALUES (${newDishId}, ${newCatId[0].id})`)
        })
      }
      return newDishId;
    })
    //Add new Cuisine Type if user added
    .then(function(newDishId){
      if(req.body.add_category == "") {
        console.log("blank add cat:"+req.body.add_category)
        db.query(`INSERT INTO cuisine_type (name) VALUES ('${req.body.add_cuisine}')`)
    //Get ID of newly added cuisine
        .then(function(){
          return db.query(`SELECT id FROM cuisine_type ORDER BY id DESC LIMIT 1;`)
        })
    //Insert new cuisine ID in to join table with new dish ID
        .then(function(newCusId){
          console.log('New Cuisine ID:'+newCusId[0].id)
          db.query(`INSERT INTO category_dish_join (dish_id, category_id) \
            VALUES (${newDishId}, ${newCusId[0].id})`)
        })
      }
      return newDishId;
    })
    //Add Dietary Restrictions
    //If there are any checked categories, insert them here in join table
    .then(function(newDishId){
      if(req.body.diet_rest) {
        for (let i = 0; i < req.body.diet_rest.length; i++) {
          db.query(`INSERT INTO diet_rest_dish_join \
            (dish_id, diet_rest_id) VALUES (${newDishId}, ${req.body.diet_rest[i]});`)
        }
      }
      return newDishId;
    })
    // Render add dish page again with input results
    .then(function(){
      add_dish_func(req, resp);
    })
    .catch(next);
  }
  insert_rest(req, resp);
});





let PORT = process.env.PORT || 9000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);

});
