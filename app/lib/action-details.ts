import type { ProcurementActionDetail } from "./requests-store";

export type ActionDetailFieldKind = "text" | "textarea" | "select";

export type ActionDetailField = {
  key: string;
  label: string;
  kind: ActionDetailFieldKind;
  placeholder?: string;
  options?: string[];
};

export type ActionCategoryKey =
  | "lighting"
  | "painting"
  | "ventilation"
  | "facade_shell"
  | "plumbing_heat"
  | "ground";

type ActionDetailsCarrier = {
  category: string;
  details?: string;
  extraDetails?: ProcurementActionDetail[];
};

const COMMON_DETAIL_FIELDS: ActionDetailField[] = [
  {
    key: "quantity_estimate",
    label: "Ungefärlig mängd",
    kind: "text",
    placeholder: "t.ex. 60 armaturer, 420 m² väggyta, 2 aggregat",
  },
  {
    key: "quantity_unit",
    label: "Enhet",
    kind: "select",
    options: ["st", "m²", "m", "lägenheter", "trapphus", "rum", "zoner", "annat"],
  },
  {
    key: "location_details",
    label: "Var ska åtgärden göras?",
    kind: "textarea",
    placeholder: "t.ex. Trapphus A-B, källarplan, hus 1 och 2",
  },
  {
    key: "existing_material",
    label: "Nuvarande material/utförande (ish)",
    kind: "textarea",
    placeholder: "t.ex. befintlig vägg i puts, armaturtyp T8, äldre ventilationskanaler",
  },
  {
    key: "target_material",
    label: "Önskat material/utförande (ish)",
    kind: "textarea",
    placeholder: "t.ex. LED-armatur 4000K, silikatfärg, galvaniserad kanal",
  },
  {
    key: "condition_note",
    label: "Skick/nuläge",
    kind: "textarea",
    placeholder: "Vad är problemet idag och varför behövs åtgärden nu?",
  },
];

const CATEGORY_DETAIL_FIELDS: Record<ActionCategoryKey, ActionDetailField[]> = {
  lighting: [
    {
      key: "fixture_type",
      label: "Typ av lampor/armaturer",
      kind: "text",
      placeholder: "t.ex. plafond, stolparmatur, nödbelysning",
    },
    {
      key: "fixture_count",
      label: "Antal lampor/armaturer",
      kind: "text",
      placeholder: "t.ex. 48 st",
    },
    {
      key: "lamp_placement",
      label: "Placering av lampor",
      kind: "textarea",
      placeholder: "t.ex. varje trappavsats, entréer, parkering väst",
    },
    {
      key: "control_system",
      label: "Styrning",
      kind: "text",
      placeholder: "t.ex. närvarostyrning, tidsstyrning, dagsljuskompensering",
    },
  ],
  painting: [
    {
      key: "wall_count",
      label: "Antal väggar/ytor",
      kind: "text",
      placeholder: "t.ex. 24 väggytor",
    },
    {
      key: "wall_area_m2",
      label: "Väggyta (m²)",
      kind: "text",
      placeholder: "t.ex. 380 m²",
    },
    {
      key: "ceiling_area_m2",
      label: "Takyta (m²)",
      kind: "text",
      placeholder: "t.ex. 120 m²",
    },
    {
      key: "surface_material",
      label: "Väggmaterial",
      kind: "text",
      placeholder: "t.ex. puts, betong, gips",
    },
    {
      key: "paint_finish",
      label: "Färg/system",
      kind: "text",
      placeholder: "t.ex. tvättbar akrylat, glans 7, kulör NCS S0502-Y",
    },
  ],
  ventilation: [
    {
      key: "unit_count",
      label: "Antal aggregat/delar",
      kind: "text",
      placeholder: "t.ex. 2 aggregat + 14 don",
    },
    {
      key: "airflow_target",
      label: "Målflöde",
      kind: "text",
      placeholder: "t.ex. 1.2 m3/s per aggregat",
    },
    {
      key: "served_spaces",
      label: "Betjänade utrymmen",
      kind: "textarea",
      placeholder: "t.ex. trapphus, källare, tvättstuga",
    },
    {
      key: "noise_limits",
      label: "Ljudkrav",
      kind: "text",
      placeholder: "t.ex. max 35 dB(A) i trapphus",
    },
  ],
  facade_shell: [
    {
      key: "affected_area_m2",
      label: "Berörd yta (m²)",
      kind: "text",
      placeholder: "t.ex. 950 m² fasad",
    },
    {
      key: "building_parts",
      label: "Byggnadsdelar",
      kind: "textarea",
      placeholder: "t.ex. södra fasaden, sockel, balkongfronter",
    },
    {
      key: "existing_shell_material",
      label: "Nuvarande material",
      kind: "text",
      placeholder: "t.ex. tegel, puts, plåt",
    },
    {
      key: "target_shell_solution",
      label: "Önskad lösning",
      kind: "textarea",
      placeholder: "t.ex. omfogning + hydrofobering",
    },
  ],
  plumbing_heat: [
    {
      key: "system_part",
      label: "Systemdel",
      kind: "text",
      placeholder: "t.ex. stam, undercentral, radiatornät",
    },
    {
      key: "apartment_count_affected",
      label: "Berörda lägenheter",
      kind: "text",
      placeholder: "t.ex. 36 lägenheter",
    },
    {
      key: "pipe_length",
      label: "Rörlängd / omfattning",
      kind: "text",
      placeholder: "t.ex. 180 m stammar",
    },
    {
      key: "wet_room_scope",
      label: "Våtutrymmen/zoner",
      kind: "textarea",
      placeholder: "t.ex. badrum i hus 1, köksstammar hus 2",
    },
  ],
  ground: [
    {
      key: "ground_area_m2",
      label: "Markyta (m²)",
      kind: "text",
      placeholder: "t.ex. 650 m²",
    },
    {
      key: "ground_locations",
      label: "Var på marken",
      kind: "textarea",
      placeholder: "t.ex. parkering öst, gångstråk norr",
    },
    {
      key: "ground_material",
      label: "Markmaterial",
      kind: "text",
      placeholder: "t.ex. asfalt, plattor, grus",
    },
    {
      key: "restoration_scope",
      label: "Återställning",
      kind: "textarea",
      placeholder: "t.ex. återställning av planteringar och kantsten",
    },
  ],
};

export function toActionCategoryKey(category: string): ActionCategoryKey {
  const value = category.toLowerCase();
  if (value.includes("el") || value.includes("belys")) return "lighting";
  if (value.includes("vent")) return "ventilation";
  if (value.includes("måla") || value.includes("invändig")) return "painting";
  if (value.includes("vvs") || value.includes("värme") || value.includes("stam")) {
    return "plumbing_heat";
  }
  if (value.includes("mark")) return "ground";
  if (value.includes("fasad") || value.includes("tak") || value.includes("skal")) {
    return "facade_shell";
  }
  return "painting";
}

export function getActionDetailFields(category: string): ActionDetailField[] {
  const categoryKey = toActionCategoryKey(category);
  return [...COMMON_DETAIL_FIELDS, ...(CATEGORY_DETAIL_FIELDS[categoryKey] || [])];
}

export function parseActionDetailValues(
  action: ActionDetailsCarrier,
  fields: ActionDetailField[]
): Record<string, string> {
  const values: Record<string, string> = {};
  const byLabel = new Map(fields.map((field) => [field.label, field.key]));
  const byKey = new Map(fields.map((field) => [field.key, field.key]));

  (action.extraDetails || []).forEach((detail) => {
    const mappedKey = byLabel.get(detail.label) || byKey.get(detail.label);
    if (mappedKey) values[mappedKey] = detail.value || "";
  });

  if (action.details && action.details.trim().length > 0 && !values.condition_note) {
    values.condition_note = action.details.trim();
  }

  fields.forEach((field) => {
    if (typeof values[field.key] !== "string") values[field.key] = "";
  });

  return values;
}

export function applyActionDetailValues<T extends ActionDetailsCarrier>(
  action: T,
  fields: ActionDetailField[],
  values: Record<string, string>
): T {
  const fieldLabels = new Map(fields.map((field) => [field.label, field.key]));
  const fieldKeys = new Set(fields.map((field) => field.key));

  const preserved =
    action.extraDetails?.filter((detail) => {
      const key = fieldLabels.get(detail.label) || detail.label;
      return !fieldKeys.has(key);
    }) || [];

  const generated = fields
    .map((field) => {
      const value = (values[field.key] || "").trim();
      if (!value) return null;
      return { label: field.label, value };
    })
    .filter((entry): entry is ProcurementActionDetail => entry !== null);

  const summaryCandidates = [
    values.quantity_estimate,
    values.location_details,
    values.target_material,
  ]
    .map((value) => (value || "").trim())
    .filter((value) => value.length > 0);

  return {
    ...action,
    details: summaryCandidates.length > 0 ? summaryCandidates.join(" · ") : action.details,
    extraDetails: [...preserved, ...generated],
  };
}
