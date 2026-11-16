// Vehicle: name at the top, then the image, "Your Car in 3D" (customize its look), a "car care at a glance" summary (status,
// completed tasks, total spent, next up, spending by month), how much the car is driven
// (which times its mileage-based tasks), the description (with Edit),
// and a box of maintenance history (type on the left, date on the right).
import { getVehicle, getSettings, listTasks, listPhotos, deletePhoto, updateVehicle, hasNewColumns } from "../data.js";
import { careSummary, careCard, bindCareCard } from "../carCare.js";
import { lookCard, openCustomizer } from "../carCustomizer.js";
import { drivingLabel } from "../driving.js";
import {
  appBar, escapeHtml, icon, loading, formatDate, formatMileage, vehicleIcon, vehicleSpec, vehicleTint,
  toast, confirmDialog, errorMessage, withBusy,
} from "../ui.js";

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const vehicle = await getVehicle(ctx.params.id);
  if (!ctx.isCurrent()) return;
  if (!vehicle) {
    toast("That vehicle doesn't exist anymore.", "error");
    return ctx.navigate("#/garage", { replace: true });
  }
  const [history, open, photos, settings] = await Promise.all([
    listTasks({ vehicleId: vehicle.id, completed: true }),
    listTasks({ vehicleId: vehicle.id, completed: false }),
    listPhotos(vehicle.id).catch(() => []),
    getSettings().catch(() => ({ reminder_days_before: 7 })),
  ]);
  if (!ctx.isCurrent()) return;
  const remindDays = settings?.reminder_days_before ?? 7;
  const care = careSummary({ open, done: history, remindDays });

  let selectedPhoto = 0;
  let editingDescription = false;

  const draw = () => {
    const photo = photos[selectedPhoto];
    root.innerHTML = `
      ${appBar({
        title: vehicle.label,
        sub: [vehicleSpec(vehicle), formatMileage(vehicle.current_mileage)].filter(Boolean).join(" · "),
        back: { href: "#/garage", label: "Garage" },
        action: `<a class="icon-btn" href="#/vehicles/${vehicle.id}/edit" aria-label="Edit vehicle details">${icon("edit", 20, 2)}</a>`,
      })}
      <div class="content vehicle-detail-page">
        
      <section class="card vehicle-photo-card">
        <div class="vehicle-photo-overview">
          <div class="vehicle-photo-preview"
            style="${vehicleTint(vehicle.index)}">

            ${photo
              ? `<img src="${escapeHtml(photo.url ?? "")}"
                  alt="Photo of ${escapeHtml(vehicle.label)}">
                <button class="gallery-delete icon-btn"
                  type="button" aria-label="Delete this photo">
                  ${icon("trash", 18, 2)}
                </button>`
              : vehicleIcon(vehicle, 48)}
          </div>

          <div class="vehicle-photo-info">
            <h3>Vehicle Photos</h3>
            <p class="hint">
              ${photos.length
                ? `${photos.length} photo${photos.length === 1 ? "" : "s"} added`
                : "Add pictures of your car"}
            </p>

            <a class="btn btn-soft btn-sm"
              href="#/vehicles/${vehicle.id}/photo">
              ${icon("camera", 16, 2)} Add Photo
            </a>
          </div>
        </div>

        ${photos.length > 1 ? `
          <div class="gallery-strip">
            ${photos.map((p, i) => `
              <button type="button"
                class="thumb ${i === selectedPhoto ? "on" : ""}"
                data-index="${i}"
                aria-label="Show photo ${i + 1}">
                <img src="${escapeHtml(p.url ?? "")}"
                  alt="" loading="lazy">
              </button>
            `).join("")}
          </div>
        ` : ""}
      </section>


      ${careCard(vehicle, care, { remindDays })}

     
    <details class="vehicle-dropdown">
      <summary class="vehicle-dropdown-heading">
        <span class="vehicle-dropdown-title">
          ${icon("history", 18, 2)}
          Maintenance History
        </span>
        <span class="vehicle-dropdown-arrow"></span>
      </summary>

      <div class="vehicle-dropdown-content">
        ${history.length ? `
          <ul class="history-list">
            ${history.map((t) => `
              <li>
                <a href="#/tasks/${t.id}">
                  <span class="history-type">
                    ${escapeHtml(t.task_name)}
                    ${t.receipt_path ? `<span class="tone-muted">${icon("receipt", 13, 2)}</span>` : ""}
                  </span>
                  <span class="history-date">
                    ${formatDate(t.completed_date)}
                  </span>
                </a>
              </li>
            `).join("")}
          </ul>
        ` : `
          <p class="muted-box">
            No maintenance recorded yet. Completed tasks show up here.
          </p>
        `}

        <a class="btn btn-soft btn-sm" href="#/tasks">
          View All Tasks
        </a>
      </div>
    </details>

      <details class="vehicle-dropdown">
        <summary class="vehicle-dropdown-heading">
          <span class="vehicle-dropdown-title">
            ${icon("car", 18, 2)}
            Your Car in 3D
          </span>
          <span class="vehicle-dropdown-arrow"></span>
        </summary>
      
        <div class="vehicle-dropdown-content">
          ${lookCard(vehicle)}
        </div>
      </details>


      ${hasNewColumns("vehicles") ? `
        <details class="vehicle-dropdown">
          <summary class="vehicle-dropdown-heading">
          <span class="vehicle-dropdown-title">
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19a10 10 0 1 1 16 0"/>
              <path d="m12 14 4-5"/>
              <circle cx="12" cy="14" r="1"/>
              <path d="M4 19h16"/>
            </svg>
            How Much You Drive
          </span>
            <span class="vehicle-dropdown-arrow"></span>
          </summary>
      
          <div class="vehicle-dropdown-content">
            ${vehicle.miles_per_year == null
              ? `<p>Tell AutoPal how much you drive this car so oil changes, tire rotations and filters come due when you actually need them.</p>`
              : `<p><span class="drive-level">${escapeHtml(drivingLabel(vehicle.miles_per_year))}</span></p>
                 <p class="hint">Maintenance is timed by mileage or months, whichever comes first.</p>`}
      
            <a class="btn btn-soft btn-sm"
              href="#/vehicles/${vehicle.id}/edit">
              ${icon("edit", 15, 2)}
              ${vehicle.miles_per_year == null ? "Set Driving Habits" : "Change Driving Habits"}
            </a>
          </div>
        </details>
      ` : ""}      
       
        <details class="vehicle-dropdown"
          ${editingDescription ? "open" : ""}>

          <summary class="vehicle-dropdown-heading">
          <span class="vehicle-dropdown-title">
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M8 13h8M8 17h8"/>
            </svg>
            Description
          </span>
            <span class="vehicle-dropdown-arrow"></span>
          </summary>

          <div class="vehicle-dropdown-content">
            ${editingDescription ? `
              <form class="form" id="desc-form">
                <textarea name="description" rows="4"
                  maxlength="1000"
                  placeholder="Color, quirks, anything worth remembering">${escapeHtml(vehicle.description ?? "")}</textarea>

                <p class="form-error" role="alert" hidden></p>

                <div class="form-actions compact">
                  <button type="button"
                    class="btn btn-ghost btn-sm"
                    id="cancel-desc">Cancel</button>

                  <button type="submit"
                    class="btn btn-sm">Save</button>
                </div>
              </form>
            ` : `
              <p class="description">
                ${vehicle.description
                  ? escapeHtml(vehicle.description)
                  : `<span class="tone-muted">No description yet.</span>`}
              </p>

              <button type="button"
                class="btn btn-soft btn-sm" id="edit-desc">
                ${icon("edit", 15, 2)} Edit Description
              </button>
            `}
          </div>
        </details>

      </div>`;

    bindCareCard(root);
    root.querySelector("#customize-look").addEventListener("click", () => openCustomizer(vehicle, { onSaved: draw }));

    root.querySelectorAll(".thumb[data-index]").forEach((b) =>
      b.addEventListener("click", () => { selectedPhoto = Number(b.dataset.index); draw(); }));

    root.querySelector(".gallery-delete")?.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Delete Photo?", body: "This permanently removes the photo.", confirmLabel: "Delete", danger: true });
      if (!ok) return;
      try {
        await deletePhoto(photos[selectedPhoto]);
        photos.splice(selectedPhoto, 1);
        selectedPhoto = 0;
        toast("Photo deleted", "ok");
        draw();
      } catch (err) {
        toast(errorMessage(err), "error");
      }
    });

    root.querySelector("#edit-desc")?.addEventListener("click", () => {
      editingDescription = true;
      draw();
      root.querySelector("#desc-form textarea").focus();
    });
    root.querySelector("#cancel-desc")?.addEventListener("click", () => { editingDescription = false; draw(); });
    root.querySelector("#desc-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const value = form.elements.description.value.trim() || null;
      withBusy(form.querySelector("button[type=submit]"), async () => {
        try {
          const saved = await updateVehicle(vehicle.id, { description: value });
          vehicle.description = saved.description;
          editingDescription = false;
          toast("Description saved", "ok");
          draw();
        } catch (err) {
          const errEl = form.querySelector(".form-error");
          errEl.textContent = errorMessage(err);
          errEl.hidden = false;
        }
      });
    });
  };

  draw();
}
