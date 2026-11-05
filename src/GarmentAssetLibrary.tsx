import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Star, X, PackageOpen } from "lucide-react";
import {
  assetUrl,
  garmentAssets,
  garmentLayers,
  loadGarmentTrace,
  type GarmentAsset,
  type GarmentTrace,
} from "./garment-library";
import { vectorPath, type VectorLayer, type VectorView } from "./vector-pack";

function readFavorites(): string[] {
  try {
    const v = JSON.parse(
      localStorage.getItem("form-studio-garment-favorites") ?? "[]",
    );
    return Array.isArray(v)
      ? v.filter(
          (id) =>
            typeof id === "string" && garmentAssets.some((a) => a.id === id),
        )
      : [];
  } catch {
    return [];
  }
}
export function GarmentAssetLibrary({
  onPlace,
  busy,
  notify,
}: {
  onPlace: (layers: VectorLayer[], replace: boolean, name: string) => void;
  busy: boolean;
  notify: (message: string, error?: boolean) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [favorites, setFavorites] = useState(readFavorites);
  const [selected, setSelected] = useState<GarmentAsset>(
      garmentAssets.find((a) => a.id === "hoodie")!,
    ),
    [index, setIndex] = useState(0);
  const [trace, setTrace] = useState<GarmentTrace | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [placing, setPlacing] = useState(false),
    [preview, setPreview] = useState<"source" | "trace">("source");
  const [target, setTarget] = useState<VectorView>("front"),
    [replace, setReplace] = useState(false);
  const categories = ["All", ...new Set(garmentAssets.map((a) => a.category))];
  const shown = garmentAssets.filter(
    (a) =>
      (category === "All" ||
        (category === "Favorites" && favorites.includes(a.id)) ||
        a.category === category) &&
      `${a.name} ${a.category}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    const ac = new AbortController();
    setTrace(null);
    setError("");
    setLoading(true);
    loadGarmentTrace(selected, index, ac.signal)
      .then(setTrace)
      .catch((e) => {
        if (!ac.signal.aborted) setError(String(e));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [selected, index]);
  const previewLayers = useMemo(
    () => (trace ? garmentLayers(selected, index, trace, "front") : []),
    [selected, index, trace],
  );
  const choose = (a: GarmentAsset) => {
    setSelected(a);
    setIndex(0);
  };
  const favorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((v) => v !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(
        "form-studio-garment-favorites",
        JSON.stringify(next),
      );
    } catch {
      notify("Favorite is kept for this session; local storage is full.");
    }
  };
  const place = async (pair: boolean) => {
    setPlacing(true);
    try {
      if (!trace) throw new Error("Wait for the selected view to load.");
      let layers = garmentLayers(selected, index, trace, target);
      if (pair) {
        const parts = await Promise.all(
          selected.views
            .slice(0, 2)
            .map((_, i) => loadGarmentTrace(selected, i)),
        );
        const scale = Math.min(
          ...parts.map((t) => Math.min(420 / t.width, 510 / t.height)),
        );
        layers = parts.flatMap((t, i) =>
          garmentLayers(selected, i, t, i === 0 ? "front" : "back", scale),
        );
      }
      onPlace(layers, replace, selected.name);
    } catch (e) {
      notify(String(e), true);
    } finally {
      setPlacing(false);
    }
  };
  return (
    <section className="garment-library" aria-label="Garment asset library">
      <aside className="garment-categories">
        <span className="eyebrow">YOUR COLLECTION</span>
        <h3>Garment assets</h3>
        <p>
          112 source sheets.
          <br />
          Ready for your next design.
        </p>
        <nav aria-label="Asset categories">
          {[...categories, "Favorites"].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === "Favorites" ? <Star size={14} /> : null}
              {c}
              <span>
                {c === "All"
                  ? garmentAssets.length
                  : c === "Favorites"
                    ? favorites.length
                    : garmentAssets.filter((a) => a.category === c).length}
              </span>
            </button>
          ))}
        </nav>
        <div className="garment-collection-note">
          <PackageOpen size={20} />
          <strong>Imported collection</strong>
          <span>
            Original PNG sheets preserved. Editable traces included for each
            view.
          </span>
        </div>
      </aside>
      <div className="garment-gallery">
        <div className="garment-gallery-top">
          <div>
            <span className="eyebrow">BROWSE & BUILD</span>
            <h3>
              {category === "All" ? "Find your starting point" : category}
            </h3>
          </div>
          <span>{shown.length} assets</span>
        </div>
        <div className="garment-search">
          <Search size={17} />
          <input
            aria-label="Search garment assets"
            placeholder="Search hoodies, denim, hats…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              aria-label="Clear asset search"
              onClick={() => setQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="garment-card-grid">
          {shown.map((a) => (
            <article
              className={`garment-card ${selected.id === a.id ? "selected" : ""}`}
              key={a.id}
            >
              <button
                className="garment-card-main"
                aria-label={`Preview ${a.name}`}
                aria-pressed={selected.id === a.id}
                onClick={() => choose(a)}
              >
                <div className="garment-card-image">
                  <img
                    src={assetUrl(a.id, "preview.webp")}
                    alt=""
                    loading="lazy"
                  />
                </div>
                <div>
                  <strong>{a.name}</strong>
                  <span>
                    {a.category} · {a.views.length}{" "}
                    {a.views.length === 1 ? "view" : "views"}
                  </span>
                </div>
              </button>
              <button
                className={`garment-star ${favorites.includes(a.id) ? "saved" : ""}`}
                aria-label={`${favorites.includes(a.id) ? "Unfavorite" : "Favorite"} ${a.name}`}
                aria-pressed={favorites.includes(a.id)}
                onClick={() => favorite(a.id)}
              >
                <Star
                  size={14}
                  fill={favorites.includes(a.id) ? "currentColor" : "none"}
                />
              </button>
            </article>
          ))}
        </div>
        {!shown.length && (
          <div className="garment-no-results">
            <Search size={25} />
            <h4>No matching assets</h4>
            <p>Try a garment name or choose another category.</p>
            <button
              onClick={() => {
                setQuery("");
                setCategory("All");
              }}
            >
              Show all assets
            </button>
          </div>
        )}
      </div>
      <aside className="garment-detail" aria-label="Selected garment asset">
        <div>
          <span className="eyebrow">{selected.category}</span>
          <h3>{selected.name}</h3>
          <p>PNG source · editable vector trace</p>
        </div>
        <div className="garment-preview-tabs">
          <button
            aria-pressed={preview === "source"}
            className={preview === "source" ? "active" : ""}
            onClick={() => setPreview("source")}
          >
            Original
          </button>
          <button
            aria-pressed={preview === "trace"}
            className={preview === "trace" ? "active" : ""}
            onClick={() => setPreview("trace")}
          >
            Vector trace
          </button>
        </div>
        <div className="garment-large-preview">
          {preview === "source" ? (
            <img
              src={assetUrl(selected.id, selected.views[index].preview)}
              alt={`${selected.name}, ${selected.views[index].label}`}
            />
          ) : trace ? (
            <svg
              viewBox="0 0 480 640"
              role="img"
              aria-label={`${selected.name} editable trace`}
            >
              {previewLayers.map((l) => (
                <path
                  key={l.id}
                  d={vectorPath(l)}
                  fill={l.fill}
                  fillRule="evenodd"
                />
              ))}
            </svg>
          ) : (
            <p>{loading ? "Loading vector…" : error}</p>
          )}
        </div>
        <div className="garment-view-picks" aria-label="Source views">
          {selected.views.map((v, i) => (
            <button
              key={v.file}
              className={i === index ? "active" : ""}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              <img src={assetUrl(selected.id, v.preview)} alt="" />
              {v.label}
            </button>
          ))}
        </div>
        <label>
          Place on
          <select
            aria-label="Asset destination view"
            value={target}
            onChange={(e) => setTarget(e.target.value as VectorView)}
          >
            <option value="front">Front artboard</option>
            <option value="back">Back artboard</option>
          </select>
        </label>
        <label className="garment-replace">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
          />
          Replace drawings on destination
        </label>
        <button
          className="primary"
          disabled={busy || placing || loading || !trace}
          onClick={() => void place(false)}
        >
          {placing ? "Adding…" : "Add selected view"}
          <ArrowRight size={15} />
        </button>
        {selected.views.length === 2 && (
          <button
            disabled={busy || placing || loading || !trace}
            onClick={() => void place(true)}
          >
            Add pair to front & back
          </button>
        )}
        {error && <p role="alert">{error}</p>}
        <p className="garment-detail-note">
          Add, recolor and reshape the traced paths. Fine details may differ
          from the PNG. Placing is undoable; measurements and materials are
          retained.
        </p>
      </aside>
    </section>
  );
}
