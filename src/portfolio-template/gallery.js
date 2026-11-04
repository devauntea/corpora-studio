(() => {
  "use strict";
  const data = window.FORM_STUDIO_PORTFOLIO;
  if (!data || !Array.isArray(data.works)) return;
  document.title = (data.title || "Form Studio") + " — Selected Studies";
  const title = document.getElementById("title");
  title.textContent = data.title || "Studies in shape & surface.";
  document.getElementById("description").textContent = data.description || "";
  document.getElementById("count").textContent =
    String(data.works.length).padStart(2, "0") + " WORKS";
  for (const credit of data.credits || []) {
    const p = document.createElement("p");
    p.textContent = credit;
    document.getElementById("credits").append(p);
  }
  const gallery = document.getElementById("gallery"),
    dialog = document.getElementById("lightbox");
  let previous;
  for (const [i, work] of data.works.entries()) {
    if (!/^images\/[a-zA-Z0-9._-]+\.(png|jpg|jpeg|svg)$/.test(work.image))
      continue;
    const card = document.createElement("article");
    card.className = "study";
    card.dataset.category = work.category === "fashion" ? "fashion" : "tattoo";
    const button = document.createElement("button");
    button.setAttribute("aria-label", "View " + work.title);
    const img = document.createElement("img");
    img.src = work.image;
    img.alt = work.title;
    img.loading = i ? "lazy" : "eager";
    button.append(img);
    const caption = document.createElement("div");
    caption.className = "study-caption";
    const text = document.createElement("div"),
      h = document.createElement("h2"),
      p = document.createElement("p"),
      tag = document.createElement("small");
    h.textContent = work.title;
    p.textContent = work.note || "";
    tag.textContent =
      String(i + 1).padStart(2, "0") +
      " / " +
      card.dataset.category.toUpperCase();
    text.append(h, p);
    caption.append(text, tag);
    card.append(button, caption);
    gallery.append(card);
    button.onclick = () => {
      previous = button;
      document.getElementById("lightbox-image").src = work.image;
      document.getElementById("lightbox-image").alt = work.title;
      document.getElementById("lightbox-title").textContent = work.title;
      document.getElementById("lightbox-note").textContent = work.note || "";
      dialog.showModal();
      document.getElementById("close-lightbox").focus();
    };
  }
  document.getElementById("close-lightbox").onclick = () => dialog.close();
  dialog.addEventListener("close", () => previous?.focus());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  for (const button of document.querySelectorAll("[data-filter]"))
    button.onclick = () => {
      for (const b of document.querySelectorAll("[data-filter]"))
        b.setAttribute("aria-pressed", String(b === button));
      let count = 0;
      for (const c of gallery.children) {
        c.hidden =
          button.dataset.filter !== "all" &&
          c.dataset.category !== button.dataset.filter;
        if (!c.hidden) count++;
      }
      document.getElementById("empty").hidden = count > 0;
    };
})();
