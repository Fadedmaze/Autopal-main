// Photos section on the task page (views/taskForm.js). Editing a task: photos
// upload as soon as they're picked. New task: they're held here and uploaded
// right after the task is created (uploadStaged). Tap a photo to see it full
// screen and delete it. Up to MAX_TASK_PHOTOS per task.
import { listTaskPhotos, uploadTaskPhoto, deleteTaskPhoto, MAX_TASK_PHOTOS } from "./data.js";
import { prepareUpload } from "./components.js";
import { escapeHtml, icon, toast, confirmDialog, errorMessage } from "./ui.js";

export function mountTaskPhotos(el, { task = null } = {}) {
  const saved = Boolean(task);
  let photos = [];        // saved photos: { id, url, storage_path, ... }
  const staged = [];      // new task: { blob, ext, preview }
  let unavailable = null; // message when the database isn't set up
  let busy = false;

  const count = () => (saved ? photos.length : staged.length);
  const items = () => (saved
    ? photos.map((p, i) => ({ i, url: p.url }))
    : staged.map((s, i) => ({ i, url: s.preview })));

  const draw = () => {
    if (unavailable) {
      el.innerHTML = `<span class="field-label">Photos</span><p class="hint">${escapeHtml(unavailable)}</p>`;
      return;
    }
    const full = count() >= MAX_TASK_PHOTOS;
    el.innerHTML = `
      <span class="field-label">Photos <em>(Optional, up to ${MAX_TASK_PHOTOS})</em></span>
      <div class="task-photos">
        ${items().map(({ i, url }) => `
          <button type="button" class="thumb task-photo" data-photo="${i}" aria-label="View photo ${i + 1}">
            ${url ? `<img src="${escapeHtml(url)}" alt="">` : icon("camera", 20, 1.8)}
          </button>`).join("")}
        ${full ? "" : `
          <label class="task-photo-upload ${busy ? "busy" : ""}">
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              ${busy ? "disabled" : ""}
            >

            <span class="task-photo-upload-icon">
              ${icon("camera", 24, 1.8)}
            </span>

            <span class="task-photo-upload-title">
              ${busy ? "Adding Photos..." : "Add Photos"}
            </span>

            <span class="task-photo-upload-description">
              Upload photos of repairs, parts, or your odometer
            </span>

            <span class="task-photo-upload-count">
              ${count()} of ${MAX_TASK_PHOTOS} photos added
            </span>
          </label>`}
      </div>
      <p class="hint">${saved
        ? "Before and after shots, the part you bought, the odometer… Photos save as soon as you add them."
        : "Before and after shots, the part you bought, the odometer… They're saved when you add the task."}</p>`;
    el.querySelector("input[type=file]")?.addEventListener("change", (e) => {
      const files = [...e.target.files];
      e.target.value = "";
      if (files.length) add(files);
    });
    el.querySelectorAll("[data-photo]").forEach((b) => b.addEventListener("click", () => view(Number(b.dataset.photo))));
  };

  async function add(files) {
    const room = MAX_TASK_PHOTOS - count();
    if (files.length > room) toast(`Only ${room} more photo${room === 1 ? "" : "s"} fit on this task.`, "info");
    busy = true;
    draw();
    let added = 0;
    for (const file of files.slice(0, room)) {
      try {
        const { blob, ext } = await prepareUpload(file, { maxEdge: 1600 });
        if (saved) {
          await uploadTaskPhoto(task, blob, ext);
        } else {
          staged.push({ blob, ext, preview: URL.createObjectURL(blob) });
        }
        added += 1;
      } catch (err) {
        toast(`Couldn't add ${file.name || "a photo"}: ${errorMessage(err)}`, "error");
      }
    }
    if (saved) await refresh();
    busy = false;
    draw();
    if (saved && added) toast(added === 1 ? "Photo added" : `${added} photos added`, "ok");
  }

  async function refresh() {
    try {
      photos = await listTaskPhotos(task.id);
    } catch (err) {
      if (err.notConfigured) unavailable = err.message;
      else toast(errorMessage(err), "error");
    }
  }

  function view(i) {
    const url = saved ? photos[i]?.url : staged[i]?.preview;
    if (!url) return;
    const dlg = document.createElement("dialog");
    dlg.className = "ins-viewer photo-viewer";
    dlg.setAttribute("aria-label", `Photo ${i + 1}`);
    dlg.innerHTML = `
      <img src="${escapeHtml(url)}" alt="Task photo ${i + 1}">
      <button type="button" class="ins-viewer-close" aria-label="Close">${icon("close", 22, 2.4)}</button>
      <button type="button" class="photo-viewer-delete" data-delete>${icon("trash", 18, 2)}${saved ? "Delete Photo" : "Remove"}</button>`;
    document.body.append(dlg);
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector(".ins-viewer-close").addEventListener("click", close);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.querySelector("[data-delete]").addEventListener("click", async () => {
      if (!saved) {
        URL.revokeObjectURL(staged[i].preview);
        staged.splice(i, 1);
        close();
        draw();
        return;
      }
      const ok = await confirmDialog({ title: "Delete Photo?", body: "This permanently removes the photo from this task.", confirmLabel: "Delete", danger: true });
      if (!ok) return;
      try {
        await deleteTaskPhoto(photos[i]);
        close();
        await refresh();
        draw();
        toast("Photo deleted", "ok");
      } catch (err) {
        toast(errorMessage(err), "error");
      }
    });
    dlg.showModal();
  }

  // New task: upload what was picked, once the task exists. Returns how many failed.
  async function uploadStaged(createdTask) {
    let failed = 0;
    for (const s of staged) {
      try {
        await uploadTaskPhoto(createdTask, s.blob, s.ext);
      } catch {
        failed += 1;
      }
      URL.revokeObjectURL(s.preview);
    }
    staged.length = 0;
    return failed;
  }

  (async () => {
    if (saved) {
      el.innerHTML = `<span class="field-label">Photos</span><p class="hint">Loading photos…</p>`;
      await refresh();
    }
    draw();
  })();

  return { uploadStaged, hasStaged: () => staged.length > 0 };
}
