// Vehicle: name at the top, then the image, the description (with Edit), and a box of
// maintenance history (type on the left, date on the right).
import { getVehicle, listTasks, listPhotos, deletePhoto, updateVehicle } from "../data.js";
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
  const [history, photos] = await Promise.all([
    listTasks({ vehicleId: vehicle.id, completed: true }),
    listPhotos(vehicle.id).catch(() => []),
  ]);
  if (!ctx.isCurrent()) return;

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
      <div class="content">
        <section class="gallery" style="${vehicleTint(vehicle.index)}">
          <div class="gallery-main">
            ${photo
              ? `<img src="${escapeHtml(photo.url ?? "")}" alt="Photo of ${escapeHtml(vehicle.label)}">
                 <button class="gallery-delete icon-btn" type="button" aria-label="Delete this photo">${icon("trash", 18, 2)}</button>`
              : `<a class="gallery-empty" href="#/vehicles/${vehicle.id}/photo">${vehicleIcon(vehicle, 72)}<span>${icon("camera", 16, 2)} Add a photo</span></a>`}
          </div>
          <div class="gallery-strip">
            ${photos.map((p, i) => `
              <button type="button" class="thumb ${i === selectedPhoto ? "on" : ""}" data-index="${i}" aria-label="Show photo ${i + 1}">
                <img src="${escapeHtml(p.url ?? "")}" alt="" loading="lazy">
              </button>`).join("")}
            <a class="thumb thumb-add" href="#/vehicles/${vehicle.id}/photo" aria-label="Add a photo">${icon("camera", 22, 1.9)}</a>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h3>Description</h3>
            ${editingDescription ? "" : `<button type="button" class="btn btn-soft btn-sm" id="edit-desc">${icon("edit", 15, 2)}Edit</button>`}
          </div>
          ${editingDescription ? `
            <form class="form" id="desc-form">
              <textarea name="description" rows="4" maxlength="1000" placeholder="Color, quirks, anything worth remembering">${escapeHtml(vehicle.description ?? "")}</textarea>
              <p class="form-error" role="alert" hidden></p>
              <div class="form-actions compact">
                <button type="button" class="btn btn-ghost btn-sm" id="cancel-desc">Cancel</button>
                <button type="submit" class="btn btn-sm">Save</button>
              </div>
            </form>`
            : `<p class="description">${vehicle.description ? escapeHtml(vehicle.description) : `<span class="tone-muted">No description yet. Tap Edit to add one.</span>`}</p>`}
        </section>

        <section class="card history">
          <div class="card-head">
            <h3>${icon("history", 18, 2)}Maintenance history</h3>
            <a class="link-sm" href="#/tasks">All tasks</a>
          </div>
          ${history.length ? `
            <ul class="history-list">
              ${history.map((t) => `
                <li>
                  <a href="#/tasks/${t.id}">
                    <span class="history-type">${escapeHtml(t.task_name)}${t.receipt_path ? ` <span class="tone-muted">${icon("receipt", 13, 2)}</span>` : ""}</span>
                    <span class="history-date">${formatDate(t.completed_date)}</span>
                  </a>
                </li>`).join("")}
            </ul>`
            : `<p class="muted-box">No maintenance recorded yet. Completed tasks show up here.</p>`}
        </section>
      </div>`;

    root.querySelectorAll(".thumb[data-index]").forEach((b) =>
      b.addEventListener("click", () => { selectedPhoto = Number(b.dataset.index); draw(); }));

    root.querySelector(".gallery-delete")?.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Delete photo?", body: "This permanently removes the photo.", confirmLabel: "Delete", danger: true });
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
