import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const recipes = [
  {
    keyword: "creamy garlic tuscan chicken",
    slug: "creamy-garlic-tuscan-chicken",
    title: "Creamy Garlic Tuscan Chicken",
    meta_description: "Tender chicken breasts smothered in a rich, creamy garlic sauce with sun-dried tomatoes and spinach. Ready in 30 minutes!",
    content_mdx: `## Why You'll Love This Recipe

This creamy garlic tuscan chicken is the kind of dish that looks like you spent hours in the kitchen, but it comes together in just 30 minutes. The sauce is incredibly rich and flavorful, with roasted garlic, sun-dried tomatoes, and fresh spinach all melting together in a creamy parmesan base.

## Ingredients

- 4 boneless, skinless chicken breasts
- 2 tablespoons olive oil
- 4 cloves garlic, minced
- 1 cup heavy cream
- 1/2 cup chicken broth
- 1/2 cup sun-dried tomatoes, chopped
- 2 cups fresh spinach
- 1/2 cup parmesan cheese, grated
- 1 teaspoon Italian seasoning
- Salt and pepper to taste

## Instructions

1. Season chicken breasts with salt, pepper, and Italian seasoning.
2. Heat olive oil in a large skillet over medium-high heat. Cook chicken for 6-7 minutes per side until golden and cooked through. Set aside.
3. In the same pan, add garlic and cook for 30 seconds until fragrant.
4. Pour in heavy cream and chicken broth. Bring to a gentle simmer.
5. Add sun-dried tomatoes and parmesan cheese, stirring until the cheese melts.
6. Add spinach and cook until wilted, about 2 minutes.
7. Return chicken to the pan and spoon sauce over the top.

## Tips & Variations

- **Make it lighter:** Substitute half-and-half for heavy cream
- **Add pasta:** Serve over fettuccine for a complete meal
- **Spice it up:** Add red pepper flakes to the sauce

## Storage & Reheating

Store leftovers in an airtight container for up to 3 days. Reheat gently on the stovetop with a splash of cream to keep the sauce smooth.`,
    recipe_json_ld: JSON.stringify({
      name: "Creamy Garlic Tuscan Chicken",
      description: "Tender chicken in a rich creamy garlic sauce with sun-dried tomatoes and spinach",
      prepTime: "PT10M",
      cookTime: "PT20M",
      totalTime: "PT30M",
      recipeYield: "4 servings",
      recipeCategory: "Main Course",
      recipeCuisine: "Italian",
      recipeIngredient: ["4 chicken breasts", "2 tbsp olive oil", "4 cloves garlic", "1 cup heavy cream", "1/2 cup sun-dried tomatoes", "2 cups spinach", "1/2 cup parmesan"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Season and cook chicken" }, { "@type": "HowToStep", text: "Make the cream sauce" }, { "@type": "HowToStep", text: "Combine and serve" }],
      nutrition: { "@type": "NutritionInformation", calories: "420 calories" },
    }),
    hero_image_url: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80",
  },
  {
    keyword: "lemon herb salmon",
    slug: "lemon-herb-salmon",
    title: "Lemon Herb Baked Salmon",
    meta_description: "Perfectly baked salmon fillets with a bright lemon herb butter. A healthy, elegant dinner ready in just 20 minutes.",
    content_mdx: `## Why You'll Love This Recipe

There is something magical about the combination of fresh lemon, fragrant herbs, and perfectly cooked salmon. This recipe is my go-to for weeknight dinners when I want something that feels special but takes minimal effort.

## Ingredients

- 4 salmon fillets (6 oz each)
- 3 tablespoons butter, melted
- 2 tablespoons fresh lemon juice
- 2 cloves garlic, minced
- 1 tablespoon fresh dill, chopped
- 1 tablespoon fresh parsley, chopped
- 1 teaspoon lemon zest
- Salt and pepper to taste
- Lemon slices for garnish

## Instructions

1. Preheat your oven to 400°F (200°C). Line a baking sheet with parchment paper.
2. Mix melted butter with lemon juice, garlic, dill, parsley, and lemon zest.
3. Place salmon fillets skin-side down on the baking sheet.
4. Brush the herb butter generously over each fillet.
5. Bake for 12-15 minutes until the salmon flakes easily with a fork.
6. Garnish with fresh lemon slices and extra herbs.

## Tips & Variations

- **Don't overcook:** Salmon continues cooking after you remove it from the oven
- **Crispy skin:** Start skin-side up for the last 2 minutes under the broiler
- **Side dishes:** Pairs beautifully with roasted asparagus or rice pilaf

## Storage & Reheating

Leftover salmon keeps for 2 days in the fridge. Reheat gently at 275°F for 10 minutes to avoid drying out.`,
    recipe_json_ld: JSON.stringify({
      name: "Lemon Herb Baked Salmon",
      description: "Perfectly baked salmon with bright lemon herb butter",
      prepTime: "PT5M",
      cookTime: "PT15M",
      totalTime: "PT20M",
      recipeYield: "4 servings",
      recipeCategory: "Main Course",
      recipeCuisine: "American",
      recipeIngredient: ["4 salmon fillets", "3 tbsp butter", "2 tbsp lemon juice", "2 cloves garlic", "fresh dill", "fresh parsley"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Prepare herb butter" }, { "@type": "HowToStep", text: "Bake salmon at 400F for 12-15 min" }],
      nutrition: { "@type": "NutritionInformation", calories: "350 calories" },
    }),
    hero_image_url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80",
  },
  {
    keyword: "chocolate lava cake",
    slug: "chocolate-lava-cake",
    title: "Chocolate Lava Cake",
    meta_description: "Decadent individual chocolate cakes with a molten center. An impressive dessert that's surprisingly easy to make at home.",
    content_mdx: `## Why You'll Love This Recipe

Few desserts are as dramatic and satisfying as a perfectly baked chocolate lava cake. When you break through the delicate outer shell and that warm, molten chocolate flows out — it is pure magic. And the best part? It only takes 6 ingredients and 15 minutes.

## Ingredients

- 4 oz dark chocolate (70% cocoa), chopped
- 1/2 cup (1 stick) unsalted butter
- 2 large eggs
- 2 egg yolks
- 1/4 cup sugar
- 2 tablespoons all-purpose flour
- Pinch of salt
- Butter and cocoa powder for ramekins

## Instructions

1. Preheat oven to 425°F (220°C). Butter four 6-oz ramekins and dust with cocoa powder.
2. Melt chocolate and butter together in a microwave or double boiler. Stir until smooth.
3. Whisk eggs, egg yolks, and sugar until thick and pale, about 2 minutes.
4. Fold the chocolate mixture into the egg mixture. Add flour and salt, fold gently.
5. Divide batter among the prepared ramekins.
6. Bake for exactly 12-14 minutes — the edges should be firm but the center still jiggly.
7. Let cool for 1 minute, then invert onto plates. Serve immediately.

## Tips & Variations

- **Timing is everything:** Every oven is different — test one cake first to nail the timing
- **Make ahead:** Prepare the batter and refrigerate for up to 24 hours. Add 1-2 minutes to baking time
- **Flavor variations:** Add espresso powder, orange zest, or a raspberry in the center

## Storage & Reheating

Best served immediately. Unbaked batter can be refrigerated overnight in the ramekins.`,
    recipe_json_ld: JSON.stringify({
      name: "Chocolate Lava Cake",
      description: "Decadent chocolate cakes with a molten center",
      prepTime: "PT10M",
      cookTime: "PT14M",
      totalTime: "PT24M",
      recipeYield: "4 servings",
      recipeCategory: "Dessert",
      recipeCuisine: "French",
      recipeIngredient: ["4 oz dark chocolate", "1/2 cup butter", "2 eggs", "2 egg yolks", "1/4 cup sugar", "2 tbsp flour"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Melt chocolate and butter" }, { "@type": "HowToStep", text: "Mix with eggs and sugar" }, { "@type": "HowToStep", text: "Bake at 425F for 12-14 min" }],
      nutrition: { "@type": "NutritionInformation", calories: "380 calories" },
    }),
    hero_image_url: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800&q=80",
  },
  {
    keyword: "thai basil stir fry",
    slug: "thai-basil-stir-fry",
    title: "Thai Basil Chicken Stir Fry",
    meta_description: "A quick and aromatic Thai basil chicken stir fry with bold flavors of garlic, chili, and fresh basil. Better than takeout in 15 minutes.",
    content_mdx: `## Why You'll Love This Recipe

This Thai basil chicken, known as Pad Krapow Gai, is one of the most popular street food dishes in Thailand for good reason. It is bold, aromatic, slightly spicy, and comes together faster than you can order delivery.

## Ingredients

- 1 lb ground chicken
- 4 cloves garlic, minced
- 2-4 Thai chilies, sliced (adjust to taste)
- 2 tablespoons soy sauce
- 1 tablespoon oyster sauce
- 1 tablespoon fish sauce
- 1 teaspoon sugar
- 2 cups fresh Thai basil leaves
- 2 tablespoons vegetable oil
- Steamed jasmine rice for serving
- Fried egg on top (optional but recommended)

## Instructions

1. Heat oil in a wok or large skillet over high heat until smoking.
2. Add garlic and chilies, stir fry for 30 seconds.
3. Add ground chicken, breaking it apart. Cook for 4-5 minutes until no longer pink.
4. Add soy sauce, oyster sauce, fish sauce, and sugar. Toss to combine.
5. Remove from heat and fold in the fresh Thai basil — it will wilt from the residual heat.
6. Serve over steamed jasmine rice with a fried egg on top.

## Tips & Variations

- **Holy basil vs Thai basil:** Holy basil is traditional, but Thai basil works great
- **Protein swap:** Use ground pork, shrimp, or tofu instead
- **Heat level:** Remove chili seeds for less spice, or add more for extra kick

## Storage & Reheating

Keeps for 2-3 days in the fridge. Reheat in a hot wok or skillet for best results.`,
    recipe_json_ld: JSON.stringify({
      name: "Thai Basil Chicken Stir Fry",
      description: "Quick aromatic Thai basil chicken with bold garlic and chili flavors",
      prepTime: "PT5M",
      cookTime: "PT10M",
      totalTime: "PT15M",
      recipeYield: "4 servings",
      recipeCategory: "Main Course",
      recipeCuisine: "Thai",
      recipeIngredient: ["1 lb ground chicken", "4 cloves garlic", "Thai chilies", "soy sauce", "oyster sauce", "fish sauce", "Thai basil"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Stir fry garlic and chilies" }, { "@type": "HowToStep", text: "Cook chicken with sauces" }, { "@type": "HowToStep", text: "Add basil and serve over rice" }],
      nutrition: { "@type": "NutritionInformation", calories: "310 calories" },
    }),
    hero_image_url: "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=800&q=80",
  },
  {
    keyword: "classic banana bread",
    slug: "classic-banana-bread",
    title: "Classic Banana Bread",
    meta_description: "Moist, perfectly sweet banana bread with a golden crust. Uses overripe bananas and pantry staples for the easiest bake ever.",
    content_mdx: `## Why You'll Love This Recipe

Every home cook needs a reliable banana bread recipe, and this is the one. It is incredibly moist, naturally sweet from ripe bananas, and has that perfect golden crust that makes your kitchen smell amazing.

## Ingredients

- 3 very ripe bananas, mashed
- 1/3 cup melted butter
- 3/4 cup sugar
- 1 egg, beaten
- 1 teaspoon vanilla extract
- 1 teaspoon baking soda
- Pinch of salt
- 1 1/2 cups all-purpose flour
- Optional: 1/2 cup walnuts or chocolate chips

## Instructions

1. Preheat oven to 350°F (175°C). Grease a 9x5 inch loaf pan.
2. Mash the bananas in a large bowl until smooth.
3. Mix in melted butter, sugar, egg, and vanilla.
4. Sprinkle baking soda and salt over the mixture and stir.
5. Add flour and mix until just combined — do not overmix!
6. Fold in walnuts or chocolate chips if using.
7. Pour into prepared pan and bake for 55-65 minutes.
8. The bread is done when a toothpick inserted in the center comes out clean.

## Tips & Variations

- **The riper the better:** Bananas should be very brown and spotty
- **Chocolate banana bread:** Add 1/4 cup cocoa powder and chocolate chips
- **Muffins:** Divide into a muffin tin and bake for 20-25 minutes instead

## Storage & Reheating

Wrap tightly and store at room temperature for 3-4 days, or freeze for up to 3 months.`,
    recipe_json_ld: JSON.stringify({
      name: "Classic Banana Bread",
      description: "Moist, sweet banana bread with a golden crust",
      prepTime: "PT10M",
      cookTime: "PT60M",
      totalTime: "PT70M",
      recipeYield: "1 loaf (10 slices)",
      recipeCategory: "Dessert",
      recipeCuisine: "American",
      recipeIngredient: ["3 ripe bananas", "1/3 cup butter", "3/4 cup sugar", "1 egg", "1 tsp vanilla", "1 tsp baking soda", "1.5 cups flour"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Mash bananas and mix wet ingredients" }, { "@type": "HowToStep", text: "Add dry ingredients" }, { "@type": "HowToStep", text: "Bake at 350F for 55-65 min" }],
      nutrition: { "@type": "NutritionInformation", calories: "220 calories" },
    }),
    hero_image_url: "https://images.unsplash.com/photo-1605090930601-82c3fcecbca2?w=800&q=80",
  },
  {
    keyword: "mediterranean quinoa bowl",
    slug: "mediterranean-quinoa-bowl",
    title: "Mediterranean Quinoa Bowl",
    meta_description: "A fresh and colorful Mediterranean quinoa bowl loaded with cucumbers, tomatoes, feta, and a zesty lemon dressing. Perfect for meal prep.",
    content_mdx: `## Why You'll Love This Recipe

This Mediterranean quinoa bowl is my favorite lunch — it is fresh, filling, and gets better as it sits (making it perfect for meal prep). The combination of fluffy quinoa, crisp vegetables, creamy feta, and a bright lemon dressing is endlessly satisfying.

## Ingredients

- 1 cup quinoa, rinsed
- 1 English cucumber, diced
- 1 pint cherry tomatoes, halved
- 1/2 red onion, finely diced
- 1/2 cup kalamata olives, halved
- 1/2 cup crumbled feta cheese
- 1/4 cup fresh parsley, chopped
- **Dressing:**
- 3 tablespoons olive oil
- 2 tablespoons lemon juice
- 1 clove garlic, minced
- 1 teaspoon dried oregano
- Salt and pepper to taste

## Instructions

1. Cook quinoa according to package directions. Let cool to room temperature.
2. While quinoa cools, whisk together all dressing ingredients.
3. In a large bowl, combine cooled quinoa, cucumber, tomatoes, red onion, olives, and parsley.
4. Pour dressing over the bowl and toss to combine.
5. Top with crumbled feta cheese.
6. Serve immediately or refrigerate for meal prep.

## Tips & Variations

- **Add protein:** Grilled chicken, chickpeas, or shrimp are all great additions
- **Make it vegan:** Skip the feta or use a plant-based alternative
- **Grain swap:** Use couscous, farro, or bulgur wheat instead of quinoa

## Storage & Reheating

Keeps for 4-5 days in the fridge. Best served cold or at room temperature. Add dressing just before serving if meal prepping.`,
    recipe_json_ld: JSON.stringify({
      name: "Mediterranean Quinoa Bowl",
      description: "Fresh quinoa bowl with cucumbers, tomatoes, feta, and lemon dressing",
      prepTime: "PT15M",
      cookTime: "PT15M",
      totalTime: "PT30M",
      recipeYield: "4 servings",
      recipeCategory: "Salad",
      recipeCuisine: "Mediterranean",
      recipeIngredient: ["1 cup quinoa", "1 cucumber", "cherry tomatoes", "red onion", "kalamata olives", "feta cheese", "olive oil", "lemon juice"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Cook quinoa and cool" }, { "@type": "HowToStep", text: "Prepare vegetables and dressing" }, { "@type": "HowToStep", text: "Combine and top with feta" }],
      nutrition: { "@type": "NutritionInformation", calories: "290 calories" },
    }),
    hero_image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80",
  },
];

async function seed() {
  console.log("Seeding keywords and articles...");

  for (const recipe of recipes) {
    // Insert keyword
    const [kw] = await sql`
      INSERT INTO keywords (keyword, region, trend_type, pinterest_trend_score, status)
      VALUES (${recipe.keyword}, 'US', 'growing', ${Math.floor(Math.random() * 90) + 10}, 'completed')
      ON CONFLICT (keyword) DO NOTHING
      RETURNING id
    `;

    if (!kw) {
      console.log(`Skipping "${recipe.keyword}" (already exists)`);
      continue;
    }

    // Insert article
    await sql`
      INSERT INTO articles (
        keyword_id, slug, title, meta_description, content_mdx,
        recipe_json_ld, status, hero_image_url, published_url, published_at
      ) VALUES (
        ${kw.id}, ${recipe.slug}, ${recipe.title}, ${recipe.meta_description},
        ${recipe.content_mdx}, ${recipe.recipe_json_ld}::jsonb, 'published',
        ${recipe.hero_image_url},
        ${"https://cookwithyara.com/recipes/" + recipe.slug},
        NOW()
      )
      ON CONFLICT (slug) DO NOTHING
    `;

    console.log(`Seeded: ${recipe.title}`);
  }

  // Insert default pipeline config
  await sql`
    INSERT INTO pipeline_config (key, value)
    VALUES ('pipeline_enabled', 'true')
    ON CONFLICT (key) DO NOTHING
  `;
  await sql`
    INSERT INTO pipeline_config (key, value)
    VALUES ('max_articles_per_day', '5')
    ON CONFLICT (key) DO NOTHING
  `;
  await sql`
    INSERT INTO pipeline_config (key, value)
    VALUES ('target_region', 'US')
    ON CONFLICT (key) DO NOTHING
  `;

  console.log("Done! Seeded", recipes.length, "recipes + pipeline config.");
  await sql.end();
}

seed().catch(console.error);
