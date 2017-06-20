# Food for My Mood
## A Houston restaurant/food-finder app created by students at Digital Crafts

## Contributors
![logo-blue3](https://user-images.githubusercontent.com/13789291/27301823-3f40b39e-54fa-11e7-8d8b-9b8308c48922.png)
* [Ronda Wylie](http://wylieweb.io)
* [Ryan Leon](http://ryansimonleon.com)
* [Felipe Imanishi](http://www.fimanishi.com)
* [Aspen Hollyer](http://aspenhollyer.com)

-----

### Summary
We are a team of foodies who love to eat at local restaurants. Our app caters to like-minded folks.

We know what you're thinking: *Another food app? Seriously?*

Yes! You see, existing services such as Yelp and Urbanspoon are untrustworthy and unhelpful. Here's why:
  1. Reviews can be submitted by anyone, including restaurant employees (or competitors).
  2. Businesses can pay to improve their Yelp standing or remove negative reviews.
  3. Even honest reviews may be left by non-foodies (e.g. five-star reviews for fast food restaurants and other ridiculousness).

Existing services such as Zagat alleviate these problems, but they cater to well-known, high-end restaurants (and feature lots of snobby food critics). What about folks who want to know about the amazing tacos at the little dive across the street?

Enter **Food for My Mood**, an app written *by local foodies, for local foodies*. We take the positive crowdsourcing features of large apps like Yelp, and combine those with our own carefully curated database of restaurants and dishes. The result is the stuff foodie dreams are made of.

------

## Group Project Week: Jun 19-26
### Monday, June 19th
Last week, we carried out a discovery meeting and did some basic project planning. Today, we set goals and decided on a high-level structure for our app.

#### MVP (Minimum Viable Product)
- [ ] searchable database of local restaurants and dishes
- [ ] ability to search by food category (e.g. hot dog, taco)
- [ ] ability to search by restaurant (and receive recommendations of the best dishes on the menu)

#### Stretch Goals
- [ ] retrieve open/close hours from Google Places API, filter dishes by breakfast/lunch/dinner
- [ ] allow user to search restaurants by mood
- [ ] allow user to filter data in various ways (distance, dietary restrictions, etc.)
- [ ] add Google Maps to display restaurant locations
- [ ] add social media, SMS buttons to share restaurant location
- [ ] upvote/downvote buttons for restaurants, dishes
- [ ] description for each restaurant

#### Goals for Tomorrow
- [ ] Basic home page with text input, search button
- [ ] Autocomplete API
- [ ] Database with appropriate fields
- [ ] Backend communicates with Yelp API and our database

#### Challenges
* We discovered Yelp API does not provide business hours, so we will have to access these using a separate API
* Defining the database structure was difficult. We went through several iterations, deciding which tables to use and what relationships should exist among them.
* UX: The design of the homepage was difficult. At first, we provided way too many options for the user. We realized it would be a better user experience to have just a search bar on the home page. Then, users can select various options to further filter and sort data on the listing display page.

-----

## Technologies Used
Node.js
Express
Axios
Handlebars
Materialize
Bootstrap
HTML
CSS/Less
JavaScript
