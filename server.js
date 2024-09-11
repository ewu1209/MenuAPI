const http = require('http');
const https = require('https');
const PORT = 8080;

// API details
const authorizationToken = `Bearer ${process.env.SQUARE}`;
const squareVersion = '2024-08-21';
const apiEndpoint = 'https://connect.squareup.com/v2/catalog/list';

const options = {
  hostname: new URL(apiEndpoint).hostname,
  port: 443,
  path: new URL(apiEndpoint).pathname,
  method: 'GET',
  headers: {
    'Square-Version': squareVersion,
    'Authorization': authorizationToken,
    'Content-Type': 'application/json',
  },
};

// Helper function to format price by rounding to nearest dollar (no dollar sign, no cents)
function formatPrice(amount) {
  return Math.round(amount / 100); // Rounds the price to the nearest dollar
}

// Create an HTTP server
http.createServer((req, res) => {
  if (req.url === '/') {
    // Make a GET request to the Square API to fetch catalog data
    const request = https.request(options, (apiRes) => {
      let data = '';

      // Collect data as it comes in
      apiRes.on('data', (chunk) => {
        data += chunk;
      });

      // Process the complete response
      apiRes.on('end', () => {
        const responseJson = JSON.parse(data);

        // Extract catalog data from the response (assumes response includes a "objects" array)
        const catalog = responseJson;

        // Desired category order
        const categoryOrder = [
          'Red Wine', 
          'White Wine', 
          'Sparkling Wine', 
          'Craft Beer', 
          'Beer', 
          'Seltzer & Cider', 
          'No Alcohol'
        ];

        // Create a lookup for category IDs and their names
        let categoryLookup = {};
        catalog.objects.filter(item => item.type === 'CATEGORY').forEach(category => {
          categoryLookup[category.id] = category.category_data.name;
        });

        // Group items by category id, filtering out archived items (is_archived: true)
        let groupedItems = {};
        catalog.objects
          .filter(item => item.type === 'ITEM' && !item.item_data.is_archived)  // Exclude archived items
          .forEach(item => {
            if (item.item_data.categories) {
              if (item.item_data.categories.length > 0 && item.item_data.categories[0].id) {
                let categoryId = item.item_data.categories[0].id;

                if (!groupedItems[categoryId]) {
                  groupedItems[categoryId] = [];
                }
                groupedItems[categoryId].push(item);
              }
            }
          });

        // Sort categories based on predefined categoryOrder
        let sortedCategoryIds = Object.keys(groupedItems).sort((a, b) => {
          let categoryNameA = categoryLookup[a];
          let categoryNameB = categoryLookup[b];

          let indexA = categoryOrder.indexOf(categoryNameA);
          let indexB = categoryOrder.indexOf(categoryNameB);

          return indexA - indexB;
        });

        // Start generating the HTML response
        let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="viewport" content="width=device-width, initial-scale=1.0">
            <title>Menu</title>
            <style>
                /* Load the LEMONMILK-Regular font */
                @font-face {
                    font-family: 'LEMONMILK';
                    src: url('https://ewu1209.github.io/MenuApp/fonts/LEMONMILK-Regular.otf') format('opentype');
                    font-weight: normal;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'LEMONMILKLIGHT';
                    src: url('https://ewu1209.github.io/MenuApp/fonts/LEMONMILK-Light.otf') format('opentype');
                    font-weight: normal;
                    font-style: normal;
                }

                /* Apply the LEMONMILK font to the entire body */
                body {
                    font-family: 'LEMONMILK', sans-serif;
                    margin-bottom: 0px;
                }

                .menu-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 20px;
                    margin: 20px;
                }
                .menu-column {
                    border-left: 0px solid #ccc;
                    padding-left: 20px;
                }
                .menu-category {
                    font-size: 55px;
                    font-weight: bold;
                    margin-top: 20px;
                    font-family: 'LEMONMILKLIGHT', sans-serif;

                }
                .menu-item {
                    font-size: 16px;
                    line-height: 25px;
                }
                .menu-item-price {
                    float: right;
                }
                .discount {
                    width: 100%;
                    padding: 30px;
                    text-align:center;
                    background-color: black;
                    color: white;
                    position: absolute;
                    bottom: 0px;
                    left: 0px;
                }
            </style>
        </head>
        <body>
        <div class="menu-grid">
          <!-- Column 1: Red Wine and Sparkling Wine -->
          <div id="column1" class="menu-column">`;

        // Reference to the 3 columns
        let column1 = '', column2 = '', column3 = '';

        // Process each category and its items
        sortedCategoryIds.forEach(categoryId => {
          let categoryName = categoryLookup[categoryId];
          let categorySection = `<div class="menu-category">${categoryName}</div>`;

          // Sort items by their lowest price
          let categoryItems = groupedItems[categoryId].sort((a, b) => {
            // Get the lowest price of each item
            let priceA = Math.min(...a.item_data.variations
              .filter(variation => !variation.item_variation_data.name.toLowerCase().includes("member"))
              .map(variation => variation.item_variation_data.price_money.amount));

            let priceB = Math.min(...b.item_data.variations
              .filter(variation => !variation.item_variation_data.name.toLowerCase().includes("member"))
              .map(variation => variation.item_variation_data.price_money.amount));

            return priceA - priceB;
          }).map(item => {
            let menuItem = `<div class="menu-item">${item.item_data.name}`;

            // Get all non-member prices and combine them with a slash
            let prices = item.item_data.variations
              .filter(variation => !variation.item_variation_data.name.toLowerCase().includes("member"))
              .map(variation => formatPrice(variation.item_variation_data.price_money.amount));

            // Special treatment for items containing "Caymus 50th"
            let priceText = prices.join(' / ');
            if (item.item_data.name.toLowerCase().includes("50th")) {
              priceText += " Per Glass"; // Append "Per Glass" to the price
            }

            // Price display
            menuItem += `<span class="menu-item-price">${priceText}</span></div>`;
            return menuItem;
          }).join('');

          // Append category and items to the appropriate column
          if (categoryName === "Red Wine" || categoryName === "Sparkling Wine") {
            column1 += categorySection + categoryItems;
          } else if (categoryName === "White Wine" || categoryName === "Craft Beer") {
            column2 += categorySection + categoryItems;
          } else {
            column3 += categorySection + categoryItems;
          }
        });

        // Complete the HTML structure for all columns
        html += `${column1}</div>
          <!-- Column 2: White Wine and Craft Beer -->
          <div id="column2" class="menu-column">${column2}</div>
          <!-- Column 3: Everything else -->
          <div id="column3" class="menu-column">${column3}</div>
        </div>
        <div class="discount">EMPIRE MEMBERS TAKE 25% OFF EVERYTHING</div>

        </body>
        </html>`;

        // Send the generated HTML as the response
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      });
    });

    request.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    });

    // End the request
    request.end();

  } else {
    // Handle 404 - Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
