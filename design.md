Rubber Duck Store
My Duck Store is an online shop that sells rubber ducks. Each duck comes in a specific color and size.
Implement the following requirements using React for the Frontend and Express JS or Nest JS for the
Backend. You can use MongoDB or MySQL for the database.
Warehouse Module: Create, List, Delete, and Update ducks. Implement Backend and Frontend. a. The
Duck entity has the following attributes:
i. Id -> Integer ii.
Color -> String iii.
Size -> String iv.
Price -> Double
v. Quantity -> Integer vi.
Deleted -> Boolean
b. Available Color values are Red, Green, Yellow, and Black.
c. Available sizes are XLarge, Large, Medium, Small, and XSmall.
d. List ducks in a table with columns: Id, color, size, price, quantity.
i. Sort by quantity.
ii. Follow the specified design. Edit and Delete are links or buttons. See picture below 



e. Add duck.
i. Collect Color, Size, and Quantity.
ii. If a duck with the same price, color, and size already exists in the database, keep the existing
duck and only add quantities (current + new).
iii. If no duck with the same price, color, and size as the new duck exists in the database, create
a new record.
iv. The duck addition form should follow the specified design.
f. Delete ducks.
i. Duck deletion occurs from the duck listing.
ii. Show an alert to confirm whether to delete a duck or not.
iii. Implement logical deletion, meaning the database record is not deleted, only the Deleted
value is set to true.
iv. Ducks with Deleted equal to true are not included in the listing. g. Edit ducks.
g. Edit Duck
i. Only quantity and price can be edited. Color and Size are read-only.
ii. Use the same duck addition form for editing.
Store Module: Implement only in the Backend
a. Provide REST endpoints for adding updating deleting and getting ducks from and to the database.
b. In addition to the CRUD endpoints. Provide a REST endpoint that receives an order with the following
data:
i. Color, Size, and Quantity of ducks.
ii. Destination country.
iii. Shipping mode: Land, Air, or Sea.
c. Implement the following requirement using one or more design patterns and applying good
programming practices. Depending on the size and shipping mode, decide how the ducks will be
packaged.
i. If ducks are XLarge or Large, the package should be made of wood.
ii. If ducks are medium-sized, the package should be made of cardboard. iii. If ducks are small or
xsmall, the package should be made of plastic. iv. If the shipment is by air and the package is
made of wood or cardboard, introduce polystyrene balls inside the package.
v. If the shipment is by air and the package is made of plastic, fill it with bubble wrap bags. vi. If
the shipment is by land for any package, fill it with polystyrene balls.
vii. If the shipment is by sea, fill it with moisture-absorbing beads and bubble wrap bags for any
type of package.
d. Implement the following requirement using one or more design patterns and applying good
programming practices. According to the destination country, shipping mode, quantity, and type of
package, calculate the total amount to pay following the rules:
i. The total cost is calculated as quantity * price.
ii. If the order is greater than 100 units, apply a 20% discount to the total cost. iii. If the package
is made of wood, add 5% of the total cost. iv. If the package is made of plastic, add 10% of
the total cost.
v. If the package is made of cardboard, apply a 1% discount to the total cost.
vi.If the destination country is the USA, add 18% of the total cost. vii. If the
destination country is Bolivia, add 13% of the total cost. viii. If the destination
country is India, add 19% of the total cost. ix. For any other country, add 15% of
the total cost.
x. If the shipment is by sea, add 400 US dollars.
xi. If the shipment is by land, add 10 US dollars per order quantity.
xii.If the shipment is by air, add 30 US dollars per order quantity minus 15% if the order exceeds
1000 units.
e. The endpoint should respond with the following information:
i. Package type.
ii. Protection type (polystyrene balls, bubble wrap, moisture-absorbing beads). iii. Total to pay.
iv. Details of discounts and increments.