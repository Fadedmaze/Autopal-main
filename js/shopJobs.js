// Typical U.S. prices (2026, parts + labor at independent shops) for common jobs, so the
// shop page can show what a job usually costs for the person's car. Not a quote:
// Google doesn't publish shop prices. Brand factors come from js/repairs.js.
import { vehicleFactor } from "./repairs.js";

export const JOBS = [
  { name: "Synthetic oil change", service: "Oil change", low: 70, high: 125 },
  { name: "Tire rotation", service: "Tires", low: 25, high: 50 },
  { name: "Wheel alignment", service: "Alignment", low: 100, high: 200 },
  { name: "Front brake pads", service: "Brakes", low: 150, high: 300 },
  { name: "Brake pads and rotors (one axle)", service: "Brakes", low: 300, high: 600 },
  { name: "Check engine light diagnosis", service: "Engine", low: 90, high: 180 },
  { name: "Battery replacement", service: "Electrical", low: 150, high: 350 },
  { name: "Transmission fluid service", service: "Transmission", low: 150, high: 300 },
  { name: "State inspection / emissions test", service: "Inspection", low: 20, high: 60 },
];

const round5 = (n) => Math.round(n / 5) * 5;

// Jobs this shop does, priced for the car (or for a typical car without one).
export function jobsFor(shop, vehicle) {
  const f = vehicleFactor(vehicle);
  const services = new Set(shop.services ?? []);
  return JOBS
    .filter((j) => services.has(j.service))
    .map((j) => ({ ...j, low: round5(j.low * f), high: round5(j.high * f) }));
}
