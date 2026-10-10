// Camera / Upload Photo. On phones the picker offers the camera; photos are
// downscaled to keep uploads fast before they go to the private bucket.
import { getVehicle, uploadPhoto } from "../data.js";
import { prepareUpload } from "../components.js";
import { appBar, escapeHtml, icon, loading, toast, errorMessage, withBusy } from "../ui.js";

export default async function render(root, ctx) {
  root.innerHTML = loading();
  const vehicle = await getVehicle(ctx.params.id);
  if (!ctx.isCurrent()) return;
  if (!vehicle) return ctx.navigate("#/garage", { replace: true });

  let prepared = null; // { blob, ext, url }

  root.innerHTML = `
    ${appBar({ title: "Add Photo", sub: vehicle.label, back: { href: `#/vehicles/${vehicle.id}`, label: vehicle.label } })}
    <div class="content">
      <label class="capture">
        <input type="file" accept="image/*" capture="environment" hidden>
        <span class="capture-preview">
          <span class="capture-empty">${icon("camera", 48, 1.5)}<strong>Take or choose a photo</strong><small>JPG, PNG, WebP or HEIC up to 10 MB</small></span>
        </span>
      </label>
      <p class="form-error" role="alert" hidden></p>
    </div>
    <div class="footer-cta">
      <button class="btn" type="button" id="upload" disabled>${icon("image", 18, 2)}Upload Photo</button>
    </div>`;

  const input = root.querySelector("input[type=file]");
  const preview = root.querySelector(".capture-preview");
  const uploadBtn = root.querySelector("#upload");
  const errEl = root.querySelector(".form-error");

  input.addEventListener("change", async () => {
    errEl.hidden = true;
    const file = input.files?.[0];
    if (!file) return;
    if (prepared?.url) URL.revokeObjectURL(prepared.url);
    prepared = null;
    uploadBtn.disabled = true;
    try {
      const out = await prepareUpload(file);
      prepared = { ...out, url: URL.createObjectURL(out.blob) };
    } catch (err) {
      errEl.textContent = errorMessage(err);
      errEl.hidden = false;
      return;
    }
    preview.innerHTML = `<img src="${escapeHtml(prepared.url)}" alt="Selected photo preview"><span class="capture-change">Tap to change</span>`;
    uploadBtn.disabled = false;
  });

  uploadBtn.addEventListener("click", () =>
    withBusy(uploadBtn, async () => {
      try {
        await uploadPhoto(vehicle.id, prepared.blob, prepared.ext);
        toast("Photo uploaded", "ok");
        ctx.navigate(`#/vehicles/${vehicle.id}`, { replace: true });
      } catch (err) {
        errEl.textContent = errorMessage(err);
        errEl.hidden = false;
      }
    }));

  return () => { if (prepared?.url) URL.revokeObjectURL(prepared.url); };
}
