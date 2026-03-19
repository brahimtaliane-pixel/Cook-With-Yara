import { computePinScore } from "@/lib/services/intel-scoring";

// Simulate different pin scenarios
const scenarios = [
  { label: "1 save, brand new, food title", saves: 1, velocity: 1, instantVelocity: 0, acceleration: 0, baselineMultiple: 0, pinCreatedAt: new Date(), title: "Easy Chicken Recipe", description: "", creatorFollowers: 1000 },
  { label: "5 saves, 2 days old, food title", saves: 5, velocity: 3, instantVelocity: 0, acceleration: 0, baselineMultiple: 0, pinCreatedAt: new Date(Date.now() - 2 * 86400000), title: "Best Pasta Recipe", description: "A delicious pasta recipe for the whole family", creatorFollowers: 5000 },
  { label: "50 saves, 3 days old, accelerating", saves: 50, velocity: 17, instantVelocity: 25, acceleration: 10, baselineMultiple: 30, pinCreatedAt: new Date(Date.now() - 3 * 86400000), title: "Air Fryer Chicken Wings Recipe", description: "Crispy air fryer wings in 20 minutes", creatorFollowers: 10000 },
  { label: "200 saves, 5 days old, accelerating fast", saves: 200, velocity: 40, instantVelocity: 60, acceleration: 30, baselineMultiple: 50, pinCreatedAt: new Date(Date.now() - 5 * 86400000), title: "Viral TikTok Pasta Bake", description: "The trending pasta bake everyone is making", creatorFollowers: 50000 },
  { label: "500 saves, 7 days old, steady", saves: 500, velocity: 71, instantVelocity: 70, acceleration: 0, baselineMultiple: 20, pinCreatedAt: new Date(Date.now() - 7 * 86400000), title: "Easy Dinner Recipe 30 Minutes", description: "Quick weeknight dinner idea", creatorFollowers: 100000 },
  { label: "5000 saves, 14 days old, declining", saves: 5000, velocity: 357, instantVelocity: 100, acceleration: -50, baselineMultiple: 15, pinCreatedAt: new Date(Date.now() - 14 * 86400000), title: "Chocolate Lava Cake Recipe", description: "Best chocolate cake recipe", creatorFollowers: 200000 },
  { label: "50000 saves, 25 days old, dead", saves: 50000, velocity: 2000, instantVelocity: 5, acceleration: -100, baselineMultiple: 5, pinCreatedAt: new Date(Date.now() - 25 * 86400000), title: "Best Cookie Recipe Ever", description: "Classic chocolate chip cookies", creatorFollowers: 500000 },
  { label: "30 saves, 1 day old, EARLY TREND", saves: 30, velocity: 30, instantVelocity: 30, acceleration: 20, baselineMultiple: 80, pinCreatedAt: new Date(Date.now() - 1 * 86400000), title: "New Trending Breakfast Bowl Recipe", description: "The breakfast bowl taking over Pinterest", creatorFollowers: 3000 },
];

console.log("=== SCORING SCENARIOS ===\n");
for (const s of scenarios) {
  const result = computePinScore(s);
  console.log(`${result.score.toString().padStart(3)} (${result.tier.padEnd(12)}) | ${s.label}`);
}
