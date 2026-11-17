// Shop page (#/shops/:id): everything about one repair shop from Google Places — photo,
// rating, open now and hours, what it specializes in, call / website / directions, typical
// prices for the person's car, Google's description and recent reviews.
// Opened from Find a Mechanic (map pin popup or the shop list). Google's terms: shown with
// Google attribution, and not stored beyond this visit.
import { listVehicles, getProfile } from "../data.js";
import { shopDetails } from "../places.js";
import { specialties, evidenceText, brandsMentioned } from "../shopSpecialties.js";
import { jobsFor } from "../shopJobs.js";
import { escapeHtml, icon, stars, formatDistance, errorMessage, loading, appBar } from "../ui.js";

const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const carName = (v) => (v ? (v.vehicle_nickname?.trim() || [v.model_year, v.brand, v.make].filter(Boolean).join(" ")) : "");

export default async function render(root, ctx) {
  const id = ctx.params.id;
  const problem = ctx.query.get("problem");
  const back = { href: `#/mechanics${problem ? `?problem=${encodeURIComponent(problem)}` : ""}`, label: "Map" };
  root.innerHTML = `${appBar({ title: "Shop Details", back })}<div class="content">${loading()}</div>`;

  let shop, vehicles, profile;
  try {
    [shop, vehicles, profile] = await Promise.all([
      shopDetails(id),
      listVehicles().catch(() => []),
      getProfile().catch(() => null),
    ]);
  } catch (err) {
    if (!ctx.isCurrent()) return;
    root.innerHTML = `${appBar({ title: "Shop Details", back })}
      <div class="content"><p class="muted-box">${escapeHtml(errorMessage(err))}</p>
      <a class="btn btn-soft" href="${back.href}">Back to the Map</a></div>`;
    return;
  }
  if (!ctx.isCurrent()) return;

  let vehicle = vehicles.find((v) => v.id === profile?.active_vehicle_id) ?? vehicles[0] ?? null;
  const today = (new Date().getDay() + 6) % 7; // Google lists hours Monday first
  const specs = specialties(shop);
  const brands = brandsMentioned(shop).slice(0, 6);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${shop.shop_name}, ${shop.address}`)}&destination_place_id=${encodeURIComponent(shop.id)}`;

  const priceBlock = () => {
    const jobs = jobsFor(shop, vehicle);
    if (!jobs.length) return `<p class="hint">This shop doesn't list the common repair jobs AutoPal prices. Call them for a quote.</p>`;
    return `
      <ul class="shop-jobs">
        ${jobs.map((j) => `<li><span>${escapeHtml(j.name)}</span><strong>${money(j.low)}–${money(j.high)}</strong></li>`).join("")}
      </ul>
      <p class="hint small">Typical U.S. prices${vehicle ? ` for a ${escapeHtml(carName(vehicle))}` : ""}, parts and labor. Not a quote from this shop: call to confirm.</p>`;
  };

  root.innerHTML = `
    ${appBar({ title: shop.shop_name, back })}
    <div class="content shop-page">
      ${shop.photo ? `
        <figure class="shop-photo">
          <img src="${escapeHtml(shop.photo.uri)}" alt="Photo of ${escapeHtml(shop.shop_name)}" loading="lazy" referrerpolicy="no-referrer">
          ${shop.photo.attributions?.length ? `<figcaption>Photo: ${shop.photo.attributions.map((a) => a.uri
            ? `<a href="${escapeHtml(a.uri)}" target="_blank" rel="noopener">${escapeHtml(a.name ?? "")}</a>`
            : escapeHtml(a.name ?? "")).join(", ")}</figcaption>` : ""}
        </figure>` : ""}

      <section class="card shop-head">
        <div class="shop-head-rating">
          ${shop.average_rating != null
            ? `${stars(shop.average_rating)} <span>(${Number(shop.review_count).toLocaleString()} Google reviews)</span>`
            : `<span>No Google reviews yet</span>`}
        </div>
        <p class="shop-head-meta">
          ${shop.primary_type_label ? `<span>${escapeHtml(shop.primary_type_label)}</span>` : ""}
          ${shop.open_now == null ? "" : `<span class="open-now ${shop.open_now ? "yes" : "no"}">${shop.open_now ? "Open now" : "Closed now"}</span>`}
          ${shop.business_status === "CLOSED_TEMPORARILY" ? `<span class="open-now no">Temporarily closed</span>` : ""}
        </p>
        <p class="shop-address">${icon("pin", 16, 2)}<span>${escapeHtml(shop.address)}</span></p>
        <div class="shop-buttons">
          ${shop.phone ? `<a class="btn" href="${telHref(shop.phone)}">${icon("phone", 17, 2)}Call ${escapeHtml(shop.phone)}</a>` : ""}
          <a class="btn btn-soft" href="${directions}" target="_blank" rel="noopener">${icon("directions", 17, 2)}Directions</a>
          ${shop.website ? `<a class="btn btn-soft" href="${escapeHtml(shop.website)}" target="_blank" rel="noopener">${icon("globe", 17, 2)}Website</a>` : ""}
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">${icon("wrench", 18, 2)}What They Specialize In</h3>
        ${specs.length ? `
          <ul class="spec-list">
            ${specs.slice(0, 8).map((sp) => `
              <li><strong>${escapeHtml(sp.label)}</strong><small>${escapeHtml(evidenceText(sp, shop.reviews.length))}</small></li>`).join("")}
          </ul>` : `<p class="hint">A general repair shop: nothing in its Google listing or recent reviews points to one specialty.</p>`}
        ${brands.length ? `<p class="spec-brands"><span>Customers mention:</span> ${brands.map((b) => `<span class="chip">${escapeHtml(b)}</span>`).join(" ")}</p>` : ""}
        <p class="hint small">Based on the shop's name, Google's description and its most recent reviews.</p>
      </section>

      <section class="card">
        <h3 class="card-title">${icon("dollar", 18, 2)}Typical Prices${vehicle ? " for Your Car" : ""}</h3>
          ${vehicles.length > 1 ? `
            <select id="shop-car" class="filter-select shop-car" aria-label="Car to price for">
              ${vehicles.map((v) => `<option value="${v.id}" ${v.id === vehicle?.id ? "selected" : ""}>${escapeHtml(carName(v))}</option>`).join("")}
            </select>` : ""}
        <div id="shop-prices">${priceBlock()}</div>
      </section>

      ${shop.weekday_hours.length ? `
        <section class="card">
          <h3 class="card-title">${icon("clock", 18, 2)}Hours</h3>
          <ul class="shop-hours">
            ${shop.weekday_hours.map((line, i) => {
              const [day, ...rest] = line.split(": ");
              return `<li class="${i === today ? "today" : ""}"><span>${escapeHtml(day)}</span><span>${escapeHtml(rest.join(": "))}</span></li>`;
            }).join("")}
          </ul>
        </section>` : ""}

      ${shop.summary ? `
        <section class="card">
          <h3 class="card-title">${icon("info", 18, 2)}About</h3>
          <p>${escapeHtml(shop.summary)}</p>
        </section>` : ""}

      ${shop.reviews.length ? `
        <section class="card">
          <h3 class="card-title">${icon("star", 18, 2)}Recent Reviews</h3>
          <ul class="shop-reviews-list">
            ${shop.reviews.map((r) => `
              <li>
                <div class="review-head">
                  ${r.author_photo ? `<img src="${escapeHtml(r.author_photo)}" alt="" width="28" height="28" referrerpolicy="no-referrer">` : ""}
                  ${r.author_uri ? `<a href="${escapeHtml(r.author_uri)}" target="_blank" rel="noopener">${escapeHtml(r.author)}</a>` : `<span>${escapeHtml(r.author)}</span>`}
                  <small>${escapeHtml(r.when)}</small>
                </div>
                ${r.rating != null ? `<div>${stars(r.rating)}</div>` : ""}
                ${r.text ? `<p>${escapeHtml(r.text)}</p>` : ""}
              </li>`).join("")}
          </ul>
          ${shop.google_maps_uri ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(shop.google_maps_uri)}" target="_blank" rel="noopener">${icon("external", 15, 2)}All Reviews on Google Maps</a>` : ""}
        </section>` : ""}

      <p class="google-attrib">Shop information from <span class="google-attrib-mark">Google Maps</span></p>
    </div>`;

  root.querySelector("#shop-car")?.addEventListener("change", (e) => {
    vehicle = vehicles.find((v) => v.id === Number(e.target.value)) ?? vehicle;
    root.querySelector("#shop-prices").innerHTML = priceBlock();
  });
}
