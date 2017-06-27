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

/************** Autocomplete Request ****************/

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
  req.session.filtered = [];
  req.session.order = "";
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
                    // Send Yelp API request w/ restaurant name
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


/********* Calculate Distance ******/

// converts from degrees to radians
function toRadians(degrees)
{
var pi = Math.PI;
return degrees * (pi/180);
}

// receives two positions (lat and long for each) and calculate the distance a crow can fly
function calculateDistance(lat1, lon1, lat2, lon2){
var R = 6371e3; // metres
var φ1 = toRadians(lat1);
var φ2 = toRadians(lat2);
var Δφ = toRadians(lat2-lat1);
var Δλ = toRadians(lon2-lon1);

var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ/2) * Math.sin(Δλ/2);
var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));


var d = R * c / 1609.34;
// returns the distance in miles
return d
}

/************ Get user position ********************/

app.post("/update_location/", function(request, response, next){
  // updates the data with new coordinates into the session, if necessary
  if(request.body.lat && request.body.long){
    request.session["lat"] = request.body.lat;
    request.session["long"] = request.body.long;
  };
  // console.log(request.session.lat, request.session.long, "check");
})



/********* Moods Page ***********/

app.get('/moods/', function(request, response) {
  response.render('moods.hbs');
})


app.get('/moods_check/', function(request, response, next) {
  // console.log(request.session);
  // console.log(request.session.lat, request.session.long, "test");
  let mood = request.query.moods.toLowerCase();
  if(request.query.distance){
    try{
      var distance = parseInt(request.query.distance);
      if (distance === 20){
        distance = 100;
      }
    }
    catch(e){
      var distance = 100;
    }
  }
  else {
    var distance = 100;
  }
  let query = `SELECT restaurant.* FROM restaurant\
              JOIN mood_restaurant_join ON mood_restaurant_join.restaurant_id = restaurant.id\
              JOIN mood ON mood_restaurant_join.mood_id = mood.id\
              WHERE mood.name = '${mood}' ORDER BY restaurant.name`;
  db.query(query)
    .then(function(result){
    //   if(result){
    //     result.forEach(function(item){
    //       // stores the distance in the session in the distance field
    //       item["distance"] = calculateDistance(item.latitude, item.longitude, request.session.lat, request.session.long);
    //       // console.log(item.name + ":" + item.latitude + " " + item.longitude);
    //       // console.log(request.session.lat, request.session.long);
    //   })
    // }
    response.render("listing.hbs", {results: result, term: mood});
    })
})



/************ Restaurant Detail Page ***************/

app.get("/detail/", function(req, resp, next) {
  // Restaurant selected by the user, assigned from GET params in search
  let restaurant = req.session.restaurant;
  // Select dishes etc. that correspond to the restaurant
   let query =`SELECT dish.id as id, dish.name as dishname, dish.adventurous as adventurous,
   dish.shareable as shareable, dish.price as price,
   dish.spice as spice, dish.description as description FROM dish
      WHERE dish.restaurant_id = ${restaurant.id};`
 //Select moods that correspond to the restaurant
    let mood_query = `SELECT * FROM mood_restaurant_join \
     WHERE restaurant_id = ${restaurant.id}`;
     //Select dietary restrictions from diet_rest_dish_join
     var promises = [db.any(query), db.any(mood_query)];
     var moods;
     var dishes;

     promise.all(promises)
      .then(function(results){
        moods = results[1];
        dishes = results[0];

        for (let i = 0; i < dishes.length; i++) {
          // console.log('Dish name of dish query '+dishes[i].dishname)
          db.query(`SELECT diet_rest.name as dietname FROM diet_rest JOIN diet_rest_dish_join ON \
            diet_rest.id = diet_rest_dish_join.diet_rest_id WHERE dish_id = ${dishes[i].id}`)
          .then(function(dietrestresults){
            var restrictionList = [];
            if(dietrestresults.length > 0){
              // console.log('Dietary list lenght: '+dietrestresults.length +'Dishname:' +dishes[i].dishname)
              dietrestresults.forEach(function(dietrestresults){
                // console.log(' Dishname: '+dishes[i].dishname);
                // console.log('dietrestresults for '+dishes[i].dishname+' '+dietrestresults.dietname);
                let x = [dietrestresults.dietname];
                restrictionList.push(x)
                // console.log('temp x is '+x)
                // console.log('restrictionList had this pushed to it: '+restrictionList)
              })
              // console.log('restrictionList for '+dishes[i].dishname+': '+restrictionList)
              restrictionList=restrictionList.toString();
              // console.log('Make sure dishes[i].diet_rest_name is properly loaded: '+dishes[i].diet_rest_name)
            }
          return restrictionList;
          })
          .then(function(restrictionList){
            // console.log('restrictionList for '+dishes[i].dishname+': '+restrictionList)
            dishes[i].diet_rest_name = restrictionList;
          })
          .then(function(){
            console.log('Make sure restrictionList is loaded into dish '+dishes[i].dishname+' '+dishes[i].diet_rest_name)
          })
        }
        return dishes;
      })
      .then(function(dishes){
        // for(let l = 0; l < dishes.length; l++){
        //   console.log('Make sure restrictionList is loaded into dish '+dishes[l].dishname+' '+dishes[l].diet_rest_name)
        // }
      })
      .then(function (results) {

        resp.render('detail.hbs', {
          restaurant: restaurant,
           dishes: dishes,
           moods: moods,
          map_key: process.env.GOOGLE_STATIC_MAP_KEY
        });
      });
})


// function to sort ascending or descending and return a list of objects ordered
function order (category, session, list){
  // if the user wants to order by distance
  if(category === "distance"){
    // calculates the distance for each restaurant from the user position
    list.forEach(function(item){
      // stores the distance in the session in the distance field
      item["distance"] = calculateDistance(item.latitude, item.longitude, session.lat, session.long);
      console.log(item.name + ":" + item.distance );
    })
  }
  var ordered = [];
  // sorts the objects
  list.forEach(function(item){
    var added = false;
    if (ordered.length === 0){
      ordered.push(item);
      added = true;
    }
    else{
      for(var i=0; i<ordered.length; i++){
        // if the user selects ratings, orders from higher to lower ratings
        if(category === "rating"){
          if(item[category] > ordered[i][category]){
            ordered.splice(i, 0, item);
            added = true;
            break;
          }
        }
        // if the user selects distance, orders from closer to farther
        else if(category === "distance"){
          if(item[category] < ordered[i][category]){
            ordered.splice(i, 0, item);
            added = true;
            break;
          }
        }
      }
    if(!added){
      ordered.push(item);
    }
    }
  })
  return ordered
}


  /********* Order By ****************/

app.post("/order_by/", function(request, response, next){
  request.session.order = request.body.order;
  // updates the data with new coordinates into the session, if necessary
  if(request.body.lat && request.body.long){
    request.session["lat"] = request.body.lat;
    request.session["long"] = request.body.long;
  };
  // execute the ordering function
  if (request.session.filtered.length > 0){
    var ordered = order(request.body.order, request.session, request.session.filtered);
  }
  else{
    var ordered = order(request.body.order, request.session, request.session.list);
  }
  // sends the data to the partial list and then sends the html text back to the frontend
  response.render('partials/list.hbs', {layout: false, results: ordered});
})


  /********* Filter Engine ***********/

app.post("/filter/", function(request, response, next){
  // generates an object that will store the filter attributes
  var toFilter = {};
  // check for the length of toFilter
  var bodyLength = 0;
  // list of restaruant ids that were rendered in the listing page
  var restId = [];
  // pulls the restaurants objects from the session.list and pushes the restaurant id to the restId list
  request.session.list.forEach(function(item){
    restId.push(item.id);
  });
  var list_to_string = restId.toString()
  // creates a query that queries the restaurants by id from the restId list
  var restIdQuery = `id IN (${list_to_string}) AND `;
  let query = `SELECT * FROM restaurant WHERE ${restIdQuery}`;
  // generates an object that will store the filter attributes sent through a POST internal api
  for(var key in request.body){
    if (request.body[key].length > 0){
      toFilter[key] = request.body[key];
      bodyLength += 1;
    }
  }
  // if the user filters by any dietary restrition, creates a query that will query for all of them using the logical operator OR
  if(toFilter["diet_rest"]){
    var diet_restQuery = `id IN (SELECT DISTINCT restaurant_id FROM restaurant_diet_rest_join WHERE `;
    toFilter["diet_rest"].forEach(function(item){
      diet_restQuery += `diet_rest_id=${item} OR `;
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
    list_to_string = toFilter["atmosphere"].toString();
    // add single quotes to each element to be used in the query
    list_to_string = list_to_string.replace(/,/g, "\',\'");
    var atmosphereQuery = `atmosphere IN ('${list_to_string}')`;
    // if there is filter by food_quickness, adds AND to the end of the query
    if(toFilter["food_quickness"]){
       atmosphereQuery += " AND ";
    }
    // console.log(toFilter);
  }
  // if it doesn't filter by atmosphere, sets the query to an empty string
  else{
    var atmosphereQuery = "";
  }

  // If user filters by food quickness, creates a query that will find all restaurants
  // within the desired service speed range
  //
  // Food quickness is defined on a scale of 1-3, 1 being the fastest service
  if(toFilter["food_quickness"]){
     // converts the food_quickness integer input to a query string
     var int_to_string = toFilter["food_quickness"].toString();
     var food_quicknessQuery = `food_quickness <= ${int_to_string}`;
  }
  // // if it doesn't filter by atmosphere, sets the query to an empty string
  else{
     var food_quicknessQuery = "";
  }


  // if toFilter is an empty object (the user hasn't filtered), returns the list from the previous search, that was stored in sessions.list
  if(Object.keys(toFilter).length === 0 && toFilter.constructor === Object){
    // sends the list from the previous search to a partial, sends the partial html text to the frontend to be rendered
    response.render('partials/list.hbs', {layout: false, results: request.session.list});
  }
  else{
    ////////////////////////////////////////////////
    // Arrays for keeping track of Yelp API queries
    ////////////////////////////////////////////////
    //
    // keep track of promises from querying Yelp API
    let promises = [];
    // keep track of restaurants being queried
    let restaurants = [];
    // list of results that meet the 'open now' criteria
    let open_results = [];
    ///////////////////////////////////////////////

    // if the user filtered, apply the query
    db.any(query+diet_restQuery+atmosphereQuery+food_quicknessQuery)
      .then(function (result){
        // if the user filters by open now, queries Yelp-Fusion Business API
        // NOTE: This filter should be applied last to minimize API hits

        if(toFilter["open_now"]){
          result.forEach(function(restaurant) {
            console.log(restaurant.yelp_id);
            // For each restaurant, create a promise to check if open now
            var p = yelp_client.business(restaurant.yelp_id);
            // Create an array of promises
            promises.push(p);
            // Create an array of restaurants queried
            restaurants.push(restaurant);
          });

          // Wait for all promises to return
          promise.all(promises).then(yelps => {
            yelps.forEach(function (yelp_response, index) {
              // api_response is a boolean value
              let is_open = yelp_response.jsonBody.hours[0].is_open_now;
              if(is_open) {
                // add restaurant to list of open restaurants
                // index for restaurants array matches index for promises array
                open_results.push(restaurants[index]);
              }
            });
            // sends the query results to a partial, sends the partial html text to the frontend to be rendered
            if (request.session.order){
              open_results = order(request.body.order, request.session, open_results);
            }
            request.session.filtered = open_results;

            response.render('partials/list.hbs', {layout: false, results: open_results});
          })
          .catch(next);
        }
        // sends the query results to a partial, sends the partial html text to the frontend to be rendered
        console.log(request.session.order);
        if (request.session.order){
            console.log("test")
            result = order(request.session.order, request.session, result);
            console.log(result);
        }
        request.session.filtered = result;
        response.render('partials/list.hbs', {layout: false, results: result});
      })
      .catch(function(error){
        console.error(error);
      })
  }
})

/********* Form to Add Items to Database ***********/
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
    .then(function() {
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
    console.log('Insert this dish: '+req.body.name)
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
    //If there are any checked categories, insert them here in join table
    .then(function(newDishId){
      if(req.body.category) {
        console.log("req.body.category.length: "+req.body.category.length)
        for (let i = 0; i < req.body.category.length; i++) {
          console.log('req.body.category, should only trigger if there are any checked categories: '+req.body.category)
          db.query(`INSERT INTO category_dish_join \
            (dish_id, category_id) VALUES (${newDishId}, ${req.body.category[i]});`)
        }
      }

      return newDishId;
    })
    //Add new Category if user added
    .then(function(newDishId){
    console.log("req.body.category: "+req.body.category)
      if(req.body.add_category=="") {
      }
      else {
        db.query(`INSERT INTO category (name) VALUES ('${req.body.add_category}')`)
    //Get ID of newly added category
        .then(function(){
          return db.query(`SELECT id FROM category ORDER BY id DESC LIMIT 1;`)
        })
    //Insert new category ID in to join table with new dish ID
        .then(function(newCatId){
          console.log('newCatId[0].id, should only trigger if a new category is entered: '+newCatId[0].id)
          db.query(`INSERT INTO category_dish_join (dish_id, category_id) \
            VALUES (${newDishId}, ${newCatId[0].id})`)
      })}
      return newDishId;
    })
    //Add new Cuisine Type if user added
    .then(function(newDishId){
    //I don't know why I couldn't get the opposite of this to work !=""
      if(req.body.add_cuisine == "") {
      }
      else {
        console.log('This should only trigger if user inputted a new Cuisine Type')
        db.query(`INSERT INTO cuisine_type (name) VALUES ('${req.body.add_cuisine}')`)
    //Get ID of newly added cuisine
        .then(function(){
          return db.query(`SELECT id FROM cuisine_type ORDER BY id DESC LIMIT 1;`)
        })
    //Insert new cuisine ID in to dish table in the new dish's row
        .then(function(newCusId){
          console.log('New Cuisine ID:'+newCusId[0].id)
          db.query(`UPDATE dish SET cuisine_type_id=${newCusId[0].id} WHERE id =${newDishId}`)
        })
      }
      return newDishId;
    })
    //If there are any checked diet restrictions, insert them here in join table
    .then(function(newDishId){
      console.log(req.body.diet_rest);
      if(req.body.diet_rest) {
        console.log('req.body.diet_rest, should only trigger when there are dietary restriction accommodations'+req.body.diet_rest)
        for (let i = 0; i < req.body.diet_rest.length; i++) {
          db.query(`INSERT INTO diet_rest_dish_join \
            (dish_id, diet_rest_id) VALUES (${newDishId}, ${req.body.diet_rest[i]});`)
        }
      }
      return newDishId;
    })
    .then(function(){
      add_dish_func(req, resp);
    })
    .catch(next);
  }
  insert_rest(req, resp);
});

//Get user location
var getPosition = function (options) {
  return new Promise(function (resolve, reject) {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}
//Sample promise chain for coordinates
  // getPosition()
  //   .then((position) => {
  //     return position;
  //   })
  //   .then((position) => {
  //     console.log(position.coords.latitude+', ' +position.coords.longitude)
  //   })
  //   .catch((err) => {
  //     console.error(err.message);
  //   });



let PORT = process.env.PORT || 9000;
app.listen(PORT, function () {
  console.log('Listening on port ' + PORT);

});
