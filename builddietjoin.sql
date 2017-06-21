INSERT INTO diet_rest_dish_join (dish_id)
    SELECT dietary_rest.dish_id as dish_id from dietary_rest 
    WHERE dietary_rest.gluten_free is true;
UPDATE diet_rest_dish_join SET diet_rest_id=1 WHERE diet_rest_id is null;
INSERT INTO  (dish_id)
    SELECT dietary_rest.dish_id as dish_id from dietary_rest 
    WHERE vegetarian_possible is true;
UPDATE diet_rest_dish_join SET diet_rest_id=2 WHERE diet_rest_id is null;
INSERT INTO diet_rest_dish_join (dish_id)
    SELECT dietary_rest.dish_id as dish_id from dietary_rest 
    WHERE vegan is true;
UPDATE diet_rest_dish_join SET diet_rest_id=3 WHERE diet_rest_id is null;
INSERT INTO diet_rest_dish_join (dish_id)
    SELECT dietary_rest.dish_id as dish_id from dietary_rest 
    WHERE halal_kosher is true;
UPDATE diet_rest_dish_join SET diet_rest_id=4 WHERE diet_rest_id is null;
INSERT INTO diet_rest_dish_join (dish_id)
    SELECT dietary_rest.dish_id as dish_id from dietary_rest 
    WHERE low_carb is true;
UPDATE diet_rest_dish_join SET diet_rest_id=5 WHERE diet_rest_id is null;