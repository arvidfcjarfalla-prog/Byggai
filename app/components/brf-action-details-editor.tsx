"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  applyActionDetailValues,
  getActionDetailFields,
  parseActionDetailValues,
  toActionCategoryKey,
  type ActionCategoryKey,
} from "../lib/action-details";
import {
  readBrfActionsDraft,
  writeBrfActionsDraft,
  type BrfActionDraft,
} from "../lib/brf-start";

type CatalogProduct = {
  id: string;
  categoryKey: ActionCategoryKey;
  name: string;
  sku: string;
  vendor: string;
  unit: string;
  unitPriceSek: number;
  url: string;
  tags: string[];
};

type SelectedProduct = {
  id: string;
  name: string;
  sku: string;
  vendor: string;
  unit: string;
  unitPriceSek: number;
  quantity: number;
  url?: string;
};

type GeneratedEstimate = {
  quantityBase: number;
  materialCostSek: number;
  labourHours: number;
  labourCostSek: number;
  totalCostSek: number;
  assumptions: string[];
};

const PRODUCT_JSON_LABEL = "Produktval (JSON)";
const PRODUCT_SUMMARY_LABEL = "Produktval";
const CALC_HOURS_LABEL = "Kalkyl normtid/enhet (h)";
const CALC_RATE_LABEL = "Kalkyl timpris (SEK/h)";
const CALC_WASTE_LABEL = "Kalkyl spill (%)";
const CALC_COMPLEXITY_LABEL = "Kalkyl komplexitet";
const INTERNAL_LABELS = new Set([
  PRODUCT_JSON_LABEL,
  PRODUCT_SUMMARY_LABEL,
  CALC_HOURS_LABEL,
  CALC_RATE_LABEL,
  CALC_WASTE_LABEL,
  CALC_COMPLEXITY_LABEL,
]);

const PRODUCT_CATALOG: CatalogProduct[] = [
  {
    id: "p-led-1",
    categoryKey: "lighting",
    name: "LED-panel 600x600 34W 4000K",
    sku: "LED-600-34-4K",
    vendor: "Ljusgrossisten",
    unit: "st",
    unitPriceSek: 980,
    url: "https://example.com/led-panel-600",
    tags: ["armatur", "kontor", "trapphus"],
  },
  {
    id: "p-led-2",
    categoryKey: "lighting",
    name: "Stolparmatur IP66 45W",
    sku: "STOLPE-IP66-45",
    vendor: "NordEl",
    unit: "st",
    unitPriceSek: 3200,
    url: "https://example.com/stolparmatur",
    tags: ["utomhus", "parkering"],
  },
  {
    id: "p-paint-1",
    categoryKey: "painting",
    name: "Interiörfärg matt vit 10L",
    sku: "FARG-MATT-10L",
    vendor: "Byggfärg AB",
    unit: "st",
    unitPriceSek: 790,
    url: "https://example.com/interior-matt-10l",
    tags: ["vägg", "tak"],
  },
  {
    id: "p-paint-2",
    categoryKey: "painting",
    name: "Silikatfärg fasad 15L",
    sku: "SILIKAT-15L",
    vendor: "FasadPro",
    unit: "st",
    unitPriceSek: 1490,
    url: "https://example.com/silikat-15l",
    tags: ["fasad", "puts"],
  },
  {
    id: "p-vent-1",
    categoryKey: "ventilation",
    name: "FTX-aggregat 1.2 m3/s",
    sku: "FTX-1200",
    vendor: "VentPartner",
    unit: "st",
    unitPriceSek: 78000,
    url: "https://example.com/ftx-1200",
    tags: ["aggregat", "energi"],
  },
  {
    id: "p-vvs-1",
    categoryKey: "plumbing_heat",
    name: "PEX-stamrör 25 mm",
    sku: "PEX-25",
    vendor: "Rorcenter",
    unit: "m",
    unitPriceSek: 69,
    url: "https://example.com/pex-25",
    tags: ["stam", "rör"],
  },
  {
    id: "p-ground-1",
    categoryKey: "ground",
    name: "Asfaltmassa ABT 11",
    sku: "AS-ABT11",
    vendor: "MarkMaterial",
    unit: "m²",
    unitPriceSek: 185,
    url: "https://example.com/asfalt-abt11",
    tags: ["mark", "asfalt"],
  },
  {
    id: "p-facade-1",
    categoryKey: "facade_shell",
    name: "Putsbruk C 25kg",
    sku: "PUTS-C-25",
    vendor: "FasadPro",
    unit: "st",
    unitPriceSek: 119,
    url: "https://example.com/putsbruk-c25",
    tags: ["fasad", "puts", "reparation"],
  },
];

function toFiniteNumber(value: string): number | undefined {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return undefined;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function toFiniteYear(value: string, fallback: number): number {
  const parsed = Number(value.trim());
  if (Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100) return parsed;
  return fallback;
}

function parseNumeric(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;
  const match = value.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return undefined;
  const fallback = Number(match[0].replace(",", "."));
  return Number.isFinite(fallback) ? fallback : undefined;
}

function formatSek(value: number): string {
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value)} kr`;
}

function formatHours(value: number): string {
  return `${new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} h`;
}

function sumProductMaterialCost(products: SelectedProduct[]): number {
  return products.reduce((sum, product) => sum + product.quantity * product.unitPriceSek, 0);
}

function parseStoredProducts(action: BrfActionDraft): SelectedProduct[] {
  const jsonEntry = (action.extraDetails || []).find(
    (detail) => detail.label === PRODUCT_JSON_LABEL
  )?.value;
  if (!jsonEntry) return [];
  try {
    const parsed = JSON.parse(jsonEntry) as SelectedProduct[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: typeof item?.id === "string" ? item.id : `custom-${Date.now()}`,
        name: typeof item?.name === "string" ? item.name : "Produkt",
        sku: typeof item?.sku === "string" ? item.sku : "",
        vendor: typeof item?.vendor === "string" ? item.vendor : "",
        unit: typeof item?.unit === "string" && item.unit.trim().length > 0 ? item.unit : "st",
        unitPriceSek:
          Number.isFinite(item?.unitPriceSek) && (item?.unitPriceSek ?? 0) >= 0
            ? item.unitPriceSek
            : 0,
        quantity:
          Number.isFinite(item?.quantity) && (item?.quantity ?? 0) > 0 ? item.quantity : 1,
        url: typeof item?.url === "string" ? item.url : "",
      }))
      .slice(0, 40);
  } catch {
    return [];
  }
}

function getStoredValue(action: BrfActionDraft, label: string, fallback = ""): string {
  const value = (action.extraDetails || []).find((detail) => detail.label === label)?.value;
  return typeof value === "string" ? value : fallback;
}

function defaultLabourHoursPerUnit(categoryKey: ActionCategoryKey): number {
  if (categoryKey === "lighting") return 0.7;
  if (categoryKey === "painting") return 0.25;
  if (categoryKey === "ventilation") return 2.8;
  if (categoryKey === "plumbing_heat") return 2.3;
  if (categoryKey === "ground") return 0.45;
  return 0.55;
}

function resolveQuantityBase(values: Record<string, string>, products: SelectedProduct[]): number | undefined {
  const candidates = [
    values.quantity_estimate,
    values.fixture_count,
    values.wall_area_m2,
    values.affected_area_m2,
    values.ground_area_m2,
    values.unit_count,
    values.pipe_length,
    values.apartment_count_affected,
  ];
  for (const candidate of candidates) {
    const numeric = parseNumeric(candidate);
    if (numeric && numeric > 0) return numeric;
  }
  const fallback = products.reduce((sum, product) => sum + product.quantity, 0);
  return fallback > 0 ? fallback : undefined;
}

function calculateEstimate({
  quantityBase,
  products,
  labourHoursPerUnit,
  labourRate,
  wastePercent,
  complexity,
}: {
  quantityBase: number;
  products: SelectedProduct[];
  labourHoursPerUnit: number;
  labourRate: number;
  wastePercent: number;
  complexity: "Låg" | "Normal" | "Hög";
}): GeneratedEstimate {
  const assumptions: string[] = [];
  const baseMaterial = sumProductMaterialCost(products);
  const materialCostSek = baseMaterial * (1 + wastePercent / 100);
  const labourHours = quantityBase * labourHoursPerUnit;
  const labourCostSek = labourHours * labourRate;
  const riskMultiplier = complexity === "Låg" ? 0.92 : complexity === "Hög" ? 1.2 : 1;
  const totalCostSek = (materialCostSek + labourCostSek) * riskMultiplier;

  assumptions.push(`Komplexitet: ${complexity} (${riskMultiplier.toFixed(2)}x).`);
  assumptions.push(`Materialspill: ${wastePercent.toFixed(1)}%.`);
  assumptions.push(`Normtid: ${labourHoursPerUnit.toFixed(2)} h/enhet.`);

  return {
    quantityBase,
    materialCostSek,
    labourHours,
    labourCostSek,
    totalCostSek,
    assumptions,
  };
}

export function BrfActionDetailsEditor({
  actionId,
  backHref,
}: {
  actionId: string;
  backHref: string;
}) {
  const [actions, setActions] = useState<BrfActionDraft[]>(() => readBrfActionsDraft());
  const action = useMemo(
    () => actions.find((item) => item.id === actionId),
    [actionId, actions]
  );
  const fields = useMemo(
    () => getActionDetailFields(action?.category || "Övrigt underhåll"),
    [action?.category]
  );
  const categoryKey = useMemo(
    () => toActionCategoryKey(action?.category || "Övrigt underhåll"),
    [action?.category]
  );

  const [values, setValues] = useState<Record<string, string>>(() =>
    action ? parseActionDetailValues(action, fields) : {}
  );
  const [status, setStatus] = useState<"Planerad" | "Eftersatt" | "Genomförd">(
    action?.status || "Planerad"
  );
  const [plannedYear, setPlannedYear] = useState(action ? String(action.plannedYear || "") : "");
  const [estimatedPriceSek, setEstimatedPriceSek] = useState(
    action && typeof action.estimatedPriceSek === "number"
      ? String(action.estimatedPriceSek)
      : ""
  );
  const [emissionsKgCo2e, setEmissionsKgCo2e] = useState(
    action && typeof action.emissionsKgCo2e === "number"
      ? String(action.emissionsKgCo2e)
      : ""
  );

  const [products, setProducts] = useState<SelectedProduct[]>(() =>
    action ? parseStoredProducts(action) : []
  );
  const [productSearch, setProductSearch] = useState("");
  const [labourHoursPerUnit, setLabourHoursPerUnit] = useState(() =>
    action
      ? getStoredValue(
          action,
          CALC_HOURS_LABEL,
          String(defaultLabourHoursPerUnit(categoryKey))
        )
      : String(defaultLabourHoursPerUnit(categoryKey))
  );
  const [labourRate, setLabourRate] = useState(() =>
    action ? getStoredValue(action, CALC_RATE_LABEL, "650") : "650"
  );
  const [wastePercent, setWastePercent] = useState(() =>
    action ? getStoredValue(action, CALC_WASTE_LABEL, "8") : "8"
  );
  const [complexity, setComplexity] = useState<"Låg" | "Normal" | "Hög">(() => {
    const stored = action ? getStoredValue(action, CALC_COMPLEXITY_LABEL, "Normal") : "Normal";
    return stored === "Låg" || stored === "Hög" ? stored : "Normal";
  });

  const [generatedEstimate, setGeneratedEstimate] = useState<GeneratedEstimate | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const mappedLabels = useMemo(() => new Set(fields.map((field) => field.label)), [fields]);
  const sourceDetails = useMemo(
    () =>
      (action?.extraDetails || []).filter(
        (item) => !mappedLabels.has(item.label) && !INTERNAL_LABELS.has(item.label)
      ),
    [action?.extraDetails, mappedLabels]
  );
  const productSuggestions = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return PRODUCT_CATALOG.filter((product) => {
      if (product.categoryKey !== categoryKey) return false;
      if (!query) return true;
      const haystack = `${product.name} ${product.sku} ${product.vendor} ${product.tags.join(" ")}`.toLowerCase();
      return haystack.includes(query);
    }).slice(0, 10);
  }, [categoryKey, productSearch]);

  const quantityBase = useMemo(() => resolveQuantityBase(values, products), [values, products]);
  const canGenerateBudget = useMemo(() => {
    return Boolean(
      quantityBase &&
        quantityBase > 0 &&
        products.length > 0 &&
        toFiniteNumber(labourHoursPerUnit) &&
        toFiniteNumber(labourRate)
    );
  }, [labourHoursPerUnit, labourRate, products.length, quantityBase]);

  const updateValue = (key: string, value: string) => {
    setSavedNotice(null);
    setValues((current) => ({ ...current, [key]: value }));
  };

  const addProduct = (product: CatalogProduct) => {
    setSavedNotice(null);
    setProducts((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          vendor: product.vendor,
          unit: product.unit,
          unitPriceSek: product.unitPriceSek,
          quantity: 1,
          url: product.url,
        },
      ];
    });
  };

  const updateProduct = (
    id: string,
    field: "quantity" | "unitPriceSek",
    value: string
  ) => {
    setProducts((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (field === "quantity") {
          const next = toFiniteNumber(value);
          return { ...item, quantity: next && next > 0 ? next : item.quantity };
        }
        const nextPrice = toFiniteNumber(value);
        return { ...item, unitPriceSek: nextPrice && nextPrice >= 0 ? nextPrice : 0 };
      })
    );
  };

  const removeProduct = (id: string) => {
    setProducts((current) => current.filter((item) => item.id !== id));
  };

  const onGenerateBudget = () => {
    if (!canGenerateBudget || !quantityBase) return;
    const estimate = calculateEstimate({
      quantityBase,
      products,
      labourHoursPerUnit: toFiniteNumber(labourHoursPerUnit) || 0,
      labourRate: toFiniteNumber(labourRate) || 0,
      wastePercent: toFiniteNumber(wastePercent) || 0,
      complexity,
    });
    setGeneratedEstimate(estimate);
    setEstimatedPriceSek(String(Math.round(estimate.totalCostSek)));
    setSavedNotice("Budget genererad och uppdaterad i budgetfältet.");
  };

  const onSave = () => {
    if (!action) return;
    const updatedActions = actions.map((item) => {
      if (item.id !== action.id) return item;
      const updatedWithDetails = applyActionDetailValues(item, fields, values);
      const keptExtra =
        updatedWithDetails.extraDetails?.filter((detail) => !INTERNAL_LABELS.has(detail.label)) ||
        [];
      const nextExtra = [...keptExtra];
      if (products.length > 0) {
        nextExtra.push({
          label: PRODUCT_SUMMARY_LABEL,
          value: `${products.length} valda produkter`,
        });
        nextExtra.push({
          label: PRODUCT_JSON_LABEL,
          value: JSON.stringify(products),
        });
      }
      nextExtra.push({ label: CALC_HOURS_LABEL, value: labourHoursPerUnit.trim() || "0.7" });
      nextExtra.push({ label: CALC_RATE_LABEL, value: labourRate.trim() || "650" });
      nextExtra.push({ label: CALC_WASTE_LABEL, value: wastePercent.trim() || "8" });
      nextExtra.push({ label: CALC_COMPLEXITY_LABEL, value: complexity });

      return {
        ...updatedWithDetails,
        status,
        plannedYear: toFiniteYear(plannedYear, item.plannedYear),
        estimatedPriceSek: toFiniteNumber(estimatedPriceSek),
        emissionsKgCo2e: toFiniteNumber(emissionsKgCo2e),
        extraDetails: nextExtra,
      };
    });

    setActions(updatedActions);
    writeBrfActionsDraft(updatedActions);
    setSavedNotice("Åtgärden är uppdaterad och sparad i underhållsplanen.");
  };

  if (!action) {
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#2A2520]">Åtgärden kunde inte hittas</h2>
        <p className="mt-2 text-sm text-[#6B5A47]">
          Den här åtgärden finns inte längre i ditt underlag. Gå tillbaka och välj en ny rad.
        </p>
        <Link
          href={backHref}
          className="mt-4 inline-flex rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
        >
          Tillbaka till underhållsplan
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
              Åtgärdsprofil
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#2A2520]">
              {action.title}
            </h2>
            <p className="mt-1 text-sm text-[#6B5A47]">
              {action.category} · {action.status} · Planerat år {action.plannedYear}
            </p>
          </div>
          <Link
            href={backHref}
            className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Tillbaka till underhållsplan
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-[#2A2520]">Detaljer för offertunderlag</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <label
              key={field.key}
              className={`block text-sm ${field.kind === "textarea" ? "md:col-span-2" : ""}`}
            >
              <span className="mb-1 block font-semibold text-[#2A2520]">{field.label}</span>
              {field.kind === "textarea" ? (
                <textarea
                  value={values[field.key] || ""}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  rows={3}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              ) : field.kind === "select" ? (
                <select
                  value={values[field.key] || ""}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                >
                  <option value="">Välj</option>
                  {(field.options || []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={values[field.key] || ""}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-[#2A2520]">Produkter (valfritt)</h3>
        <p className="mt-1 text-sm text-[#6B5A47]">
          Lägg till en eller flera produkter för mer exakt kalkyl. Om tomt fungerar förfrågan ändå.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Sök produkt..."
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
            />
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#EFE8DD] bg-[#FAF8F5]">
              {productSuggestions.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="block w-full border-b border-[#EFE8DD] px-3 py-2 text-left last:border-b-0 hover:bg-white"
                >
                  <p className="text-sm font-semibold text-[#2A2520]">{product.name}</p>
                  <p className="text-xs text-[#6B5A47]">
                    {product.vendor} · {product.sku} · {formatSek(product.unitPriceSek)}/
                    {product.unit}
                  </p>
                </button>
              ))}
              {productSuggestions.length === 0 && (
                <p className="px-3 py-2 text-sm text-[#766B60]">Inga träffar.</p>
              )}
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
            {products.length === 0 && (
              <p className="text-sm text-[#766B60]">Inga produkter valda ännu.</p>
            )}
            {products.map((product) => (
              <article key={product.id} className="rounded-lg border border-[#E3DBCF] bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#2A2520]">{product.name}</p>
                    <p className="text-xs text-[#6B5A47]">
                      {product.vendor} · {product.sku}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(product.id)}
                    className="text-xs font-semibold text-[#8C7860] hover:underline"
                  >
                    Ta bort
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-[#6B5A47]">
                    Antal ({product.unit})
                    <input
                      defaultValue={String(product.quantity)}
                      onBlur={(event) =>
                        updateProduct(product.id, "quantity", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-[#D9D1C6] px-2 py-1"
                    />
                  </label>
                  <label className="text-xs text-[#6B5A47]">
                    Enhetspris
                    <input
                      defaultValue={String(product.unitPriceSek)}
                      onBlur={(event) =>
                        updateProduct(product.id, "unitPriceSek", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-[#D9D1C6] px-2 py-1"
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-[#2A2520]">Kalkylinställningar</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#2A2520]">Normtid/enhet (h)</span>
            <input
              value={labourHoursPerUnit}
              onChange={(event) => setLabourHoursPerUnit(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#2A2520]">Timpris (SEK/h)</span>
            <input
              value={labourRate}
              onChange={(event) => setLabourRate(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#2A2520]">Spill (%)</span>
            <input
              value={wastePercent}
              onChange={(event) => setWastePercent(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#2A2520]">Komplexitet</span>
            <select
              value={complexity}
              onChange={(event) =>
                setComplexity(event.target.value as "Låg" | "Normal" | "Hög")
              }
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
            >
              <option value="Låg">Låg</option>
              <option value="Normal">Normal</option>
              <option value="Hög">Hög</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onGenerateBudget}
            disabled={!canGenerateBudget}
            className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Generera budget
          </button>
          {!canGenerateBudget && (
            <p className="text-sm text-[#766B60]">
              Kräver mängd, minst en produkt, normtid och timpris.
            </p>
          )}
        </div>

        {generatedEstimate && (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <article className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                Material
              </p>
              <p className="mt-1 text-lg font-bold text-[#2A2520]">
                {formatSek(generatedEstimate.materialCostSek)}
              </p>
            </article>
            <article className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                Arbete
              </p>
              <p className="mt-1 text-lg font-bold text-[#2A2520]">
                {formatSek(generatedEstimate.labourCostSek)}
              </p>
              <p className="text-xs text-[#766B60]">{formatHours(generatedEstimate.labourHours)}</p>
            </article>
            <article className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                Total preliminär
              </p>
              <p className="mt-1 text-lg font-bold text-[#2A2520]">
                {formatSek(generatedEstimate.totalCostSek)}
              </p>
            </article>
            <article className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                Budgetfält
              </p>
              <p className="mt-1 text-lg font-bold text-[#2A2520]">
                {estimatedPriceSek ? formatSek(Number(estimatedPriceSek)) : "-"}
              </p>
            </article>
            <ul className="md:col-span-4 list-disc space-y-1 pl-5 text-sm text-[#6B5A47]">
              {generatedEstimate.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-[#2A2520]">Nyckeldata för åtgärden</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#2A2520]">Status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "Planerad" | "Eftersatt" | "Genomförd")
              }
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
            >
              <option value="Planerad">Planerad</option>
              <option value="Eftersatt">Eftersatt</option>
              <option value="Genomförd">Genomförd</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#2A2520]">Planerat år</span>
            <input
              value={plannedYear}
              onChange={(event) => setPlannedYear(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#2A2520]">Budget (SEK)</span>
            <input
              value={estimatedPriceSek}
              onChange={(event) => setEstimatedPriceSek(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#2A2520]">CO₂e (kg)</span>
            <input
              value={emissionsKgCo2e}
              onChange={(event) => setEmissionsKgCo2e(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
            />
          </label>
        </div>
      </section>

      {(sourceDetails.length > 0 || action.rawRow) && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">Inläst bakgrund från fil</h3>
          {sourceDetails.length > 0 && (
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              {sourceDetails.map((detail) => (
                <div
                  key={`${detail.label}-${detail.value}`}
                  className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3"
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                    {detail.label}
                  </dt>
                  <dd className="mt-1 text-sm text-[#2A2520]">{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {action.rawRow && (
            <p className="mt-4 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B5A47]">
              <span className="font-semibold text-[#2A2520]">Rådatarad:</span> {action.rawRow}
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          className="rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5A47]"
        >
          Spara åtgärd
        </button>
        <Link
          href={backHref}
          className="rounded-xl border border-[#D2C5B5] bg-white px-5 py-2.5 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
        >
          Tillbaka
        </Link>
      </div>

      {savedNotice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {savedNotice}
        </p>
      )}
    </div>
  );
}
