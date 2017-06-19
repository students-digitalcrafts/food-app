# Food for My Mood
## A Houston restaurant/food-finder app created by students at Digital Crafts

## Contributors
![logo-blue3](https://user-images.githubusercontent.com/13789291/27301823-3f40b39e-54fa-11e7-8d8b-9b8308c48922.png)
* [Ronda Wylie](http://wylieweb.io)
* [Ryan Leon](http://ryansimonleon.com)
* [Felipe Imanishi](http://www.fimanishi.com)
* [Aspen Hollyer](http://aspenhollyer.com)

-----

## Group Project Week: Jun 19-26
### Summary of Work
#### MVP (Minimum Viable Product)
* searchable database of local restaurants and dishes
* ability to search by food category (e.g. hot dog, taco)
* ability to search by restaurant (and receive recommendations from the menu)

#### Stretch Goals
* retrieve open/close hours from Google Places API, filter dishes by breakfast/lunch/dinner
* allow user to search by restaurants by mood
* add Google Maps to display restaurant locations
* add social media, SMS buttons to share restaurant location
* upvote/downvote buttons for restaurants, dishes
* description for each restaurant

### Monday, June 19th
We are all foodies who love to eat at local restaurants, but existing services such as Yelp are unreliable because:
  1. Reviews can be submitted by anyone, including restaurant employees (or competitors)
  2. Businesses can pay to improve their Yelp standing or remove negative reviews
  3. Even honest reviews may be left by non-foodies (e.g. five-star reviews for fast food restaurants and other ridiculousness)
Enter **Food for My Mood**. This is a curated restaurant-review app written *by local foodies, for local foodies*.

#### Goals for Tomorrow
* Basic home page with text input, search button
* Autocomplete API
* Database with appropriate fields
* Backend communicates with Yelp API and our database

#### Challenges
* Yelp API does not provide business hours, so we will have to access these using a separate API
* Defining the database structure was difficult. We went through several iterations, deciding which tables to use and what relationships should exist among them.
* UX: The design of the homepage was difficult. At first, we provided way too many options for the user. We realized it would be a better user experience to provide only a simple search bar

-----

## Technologies Used
Node
Express
Axios
Handlebars
Materialize
Bootstrap
HTML
CSS/Less
JavaScript
