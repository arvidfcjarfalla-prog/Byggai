"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import type {
  EntrepreneurRequest,
  ProcurementAction,
  ProcurementActionDetail,
} from "../../../lib/procurement";
import {
  PROCUREMENT_REQUESTS_KEY,
  readProcurementRequests,
  PROCUREMENT_UPDATED_EVENT,
} from "../../../lib/procurement";
import type { BrfFileRecord, BrfFileType } from "../../../lib/brf-workspace";
import {
  BRF_FILES_KEY,
  BRF_FILES_UPDATED_EVENT,
  getFileExtension,
  getFileTypeLabel,
  inferBrfFileType,
} from "../../../lib/brf-workspace";
import type { BrfPropertyProfile } from "../../../lib/workspace-profiles";
import {
  BRF_PROPERTY_PROFILE_KEY,
  BRF_PROPERTY_PROFILE_UPDATED_EVENT,
  DEFAULT_BRF_PROPERTY_PROFILE,
  completenessPercent,
  readStoredObject,
  toAddress,
  writeStoredObject,
} from "../../../lib/workspace-profiles";
import {
  formatSnapshotBudget,
  formatSnapshotTimeline,
  PROJECT_SNAPSHOT_KEY,
  PROJECT_SNAPSHOT_UPDATED_EVENT,
  readProjectSnapshotFromStorage,
  toSwedishRiskLabel,
  type ProjectSnapshot,
} from "../../../lib/project-snapshot";

type PropertyTab = "overview" | "components" | "files";

type ComponentRow = {
  id: string;
  group: string;
  name: string;
  componentType: string;
  building: string;
  location: string;
  quantity: string;
  status: ProcurementAction["status"];
  plannedYear: number;
};

const PROFILE_REQUIRED_FIELDS: Array<keyof BrfPropertyProfile> = [
  "propertyName",
  "associationName",
  "addressLine",
  "postalCode",
  "city",
  "buildingYear",
  "apartmentsCount",
  "buildingsCount",
  "boaM2",
  "ventilationSystem",
  "heatingSystem",
  "accessibilityLogistics",
  "procurementContact",
  "procurementEmail",
];

const PROFILE_FIELD_LABELS: Record<keyof BrfPropertyProfile, string> = {
  propertyName: "Fastighetsnamn",
  associationName: "Föreningsnamn",
  addressLine: "Adress",
  postalCode: "Postnummer",
  city: "Ort",
  buildingYear: "Byggår",
  apartmentsCount: "Antal lägenheter",
  buildingsCount: "Antal byggnader",
  boaM2: "BOA",
  loaM2: "LOA",
  grossM2: "Bruttoarea",
  floorsCount: "Antal våningar",
  elevatorsCount: "Antal hissar",
  heatingSystem: "Värmesystem",
  ventilationSystem: "Ventilation",
  facadeType: "Fasad",
  roofType: "Tak",
  accessibilityLogistics: "Logistik och framkomlighet",
  authorityConstraints: "Myndighetskrav / begränsningar",
  procurementContact: "Kontaktperson",
  procurementEmail: "Kontakt e-post",
  procurementPhone: "Kontakt telefon",
  notes: "Övriga noteringar",
};

const FALLBACK_FILES: BrfFileRecord[] = [
  {
    id: "fallback-underhall",
    name: "Underhallsplan-2026-2028.xlsx",
    fileType: "Underhallsplan",
    extension: "xlsx",
    sizeKb: 312,
    uploadedAt: "2026-02-08T11:38:00.000Z",
    sourceLabel: "Underhållsplan",
  },
  {
    id: "fallback-ritning",
    name: "Ritning-trapphus-A.pdf",
    fileType: "Ritning",
    extension: "pdf",
    sizeKb: 542,
    uploadedAt: "2026-02-07T08:22:00.000Z",
    sourceLabel: "Ritningsarkiv",
  },
  {
    id: "fallback-avtal",
    name: "ABT06-avrop-entreprenad.docx",
    fileType: "Avtal",
    extension: "docx",
    sizeKb: 198,
    uploadedAt: "2026-02-05T09:12:00.000Z",
    sourceLabel: "Styrelsearkiv",
  },
  {
    id: "fallback-myndighet",
    name: "Bygglovsbeslut-etapp2.pdf",
    fileType: "Myndighet",
    extension: "pdf",
    sizeKb: 422,
    uploadedAt: "2026-02-03T13:48:00.000Z",
    sourceLabel: "Kommununderlag",
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatInteger(value: string): string {
  const numeric = Number(value.replace(/\s+/g, "").replace(",", "."));
  if (!Number.isFinite(numeric) || value.trim().length === 0) return "—";
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(numeric);
}

function readBrfFiles(): BrfFileRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(BRF_FILES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BrfFileRecord[]) : [];
  } catch {
    return [];
  }
}

function readProfile(): BrfPropertyProfile {
  return (
    readStoredObject<BrfPropertyProfile>(BRF_PROPERTY_PROFILE_KEY) ||
    DEFAULT_BRF_PROPERTY_PROFILE
  );
}

function findDetail(
  details: ProcurementActionDetail[] | undefined,
  labels: string[]
): string | null {
  if (!details || details.length === 0) return null;
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const match = details.find((detail) =>
    normalizedLabels.some((label) => detail.label.toLowerCase().includes(label))
  );
  return match?.value ?? null;
}

function toComponentRow(action: ProcurementAction, index: number): ComponentRow {
  const componentName =
    findDetail(action.extraDetails, ["komponent"]) ||
    findDetail(action.extraDetails, ["namn"]) ||
    action.title;
  const componentType =
    findDetail(action.extraDetails, ["komponenttyp", "kategori"]) || action.category;
  const amount = findDetail(action.extraDetails, ["antal"]);
  const unit = findDetail(action.extraDetails, ["enhet"]);

  return {
    id: `${action.id}-${index}`,
    group: action.category || "Övrigt",
    name: componentName,
    componentType,
    building: findDetail(action.extraDetails, ["byggnad"]) || "—",
    location: findDetail(action.extraDetails, ["läge", "plats"]) || "—",
    quantity: amount && unit ? `${amount} ${unit}` : amount || unit || "—",
    status: action.status,
    plannedYear: action.plannedYear,
  };
}

export default function BrfFastighetPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [tab, setTab] = useState<PropertyTab>("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [requests, setRequests] = useState<EntrepreneurRequest[]>(() =>
    readProcurementRequests()
  );
  const [files, setFiles] = useState<BrfFileRecord[]>(() => readBrfFiles());
  const [projectSnapshot, setProjectSnapshot] = useState<ProjectSnapshot | null>(() =>
    readProjectSnapshotFromStorage()
  );
  const [profile, setProfile] = useState<BrfPropertyProfile>(() => readProfile());
  const [draftProfile, setDraftProfile] = useState<BrfPropertyProfile>(() => readProfile());

  const [componentQuery, setComponentQuery] = useState("");
  const [componentYearFilter, setComponentYearFilter] = useState("alla");
  const [fileQuery, setFileQuery] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<"Alla" | BrfFileType>("Alla");

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
      return;
    }
    if (user.role === "entreprenor") router.replace("/dashboard/entreprenor");
  }, [ready, router, user]);

  useEffect(() => {
    const onRequests = () => setRequests(readProcurementRequests());
    const onFiles = () => setFiles(readBrfFiles());
    const onProfile = () => setProfile(readProfile());
    const onSnapshot = () => setProjectSnapshot(readProjectSnapshotFromStorage());

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === PROCUREMENT_REQUESTS_KEY) onRequests();
      if (event.key === BRF_FILES_KEY) onFiles();
      if (event.key === BRF_PROPERTY_PROFILE_KEY) onProfile();
      if (event.key === PROJECT_SNAPSHOT_KEY) onSnapshot();
    };

    window.addEventListener(PROCUREMENT_UPDATED_EVENT, onRequests);
    window.addEventListener(BRF_FILES_UPDATED_EVENT, onFiles);
    window.addEventListener(BRF_PROPERTY_PROFILE_UPDATED_EVENT, onProfile);
    window.addEventListener(PROJECT_SNAPSHOT_UPDATED_EVENT, onSnapshot);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(PROCUREMENT_UPDATED_EVENT, onRequests);
      window.removeEventListener(BRF_FILES_UPDATED_EVENT, onFiles);
      window.removeEventListener(BRF_PROPERTY_PROFILE_UPDATED_EVENT, onProfile);
      window.removeEventListener(PROJECT_SNAPSHOT_UPDATED_EVENT, onSnapshot);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const latestRequest =
    requests.find((request) => request.audience === "brf") ?? null;
  const effectiveSnapshot =
    latestRequest?.snapshot?.audience === "brf"
      ? latestRequest.snapshot
      : projectSnapshot?.audience === "brf"
        ? projectSnapshot
        : null;
  const actions = latestRequest?.actions ?? [];
  const componentRows = actions.map(toComponentRow);
  const componentYearOptions = Array.from(
    new Set(componentRows.map((row) => row.plannedYear))
  ).sort((a, b) => a - b);

  const groupedComponents = (() => {
    const q = componentQuery.trim().toLowerCase();
    const filtered = componentRows.filter((row) => {
      const matchesQuery =
        q.length === 0 ||
        row.group.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.componentType.toLowerCase().includes(q) ||
        row.building.toLowerCase().includes(q);
      const matchesYear =
        componentYearFilter === "alla" || String(row.plannedYear) === componentYearFilter;
      return matchesQuery && matchesYear;
    });

    return filtered.reduce<Record<string, ComponentRow[]>>((acc, row) => {
      if (!acc[row.group]) acc[row.group] = [];
      acc[row.group].push(row);
      return acc;
    }, {});
  })();

  const snapshotFiles = effectiveSnapshot
    ? effectiveSnapshot.files.map((file, index) => ({
        id: file.id || `${file.name.toLowerCase()}-${index}`,
        name: file.name,
        fileType: inferBrfFileType(file.name),
        extension: getFileExtension(file.name),
        sizeKb: file.size ? Number((file.size / 1024).toFixed(1)) : 0,
        uploadedAt: effectiveSnapshot.createdAt,
        sourceLabel: "ProjectSnapshot",
        linkedActionTitle: undefined,
      }))
    : [];

  const manualFiles = [...(files.length > 0 ? files : FALLBACK_FILES)].sort((a, b) =>
    b.uploadedAt.localeCompare(a.uploadedAt)
  );
  const allFiles = [...snapshotFiles, ...manualFiles];

  const fileTypeOptions = Array.from(new Set(allFiles.map((file) => file.fileType))).sort((a, b) =>
    getFileTypeLabel(a).localeCompare(getFileTypeLabel(b), "sv")
  );

  const filteredSnapshotFiles = (() => {
    const q = fileQuery.trim().toLowerCase();
    return snapshotFiles.filter((file) => {
      const matchesType = fileTypeFilter === "Alla" || file.fileType === fileTypeFilter;
      const matchesQuery =
        q.length === 0 ||
        file.name.toLowerCase().includes(q) ||
        file.sourceLabel.toLowerCase().includes(q) ||
        (file.linkedActionTitle || "").toLowerCase().includes(q) ||
        getFileTypeLabel(file.fileType).toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  })();

  const filteredManualFiles = (() => {
    const q = fileQuery.trim().toLowerCase();
    return manualFiles.filter((file) => {
      const matchesType = fileTypeFilter === "Alla" || file.fileType === fileTypeFilter;
      const matchesQuery =
        q.length === 0 ||
        file.name.toLowerCase().includes(q) ||
        file.sourceLabel.toLowerCase().includes(q) ||
        (file.linkedActionTitle || "").toLowerCase().includes(q) ||
        getFileTypeLabel(file.fileType).toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  })();

  const fileTypeCounts = allFiles.reduce<Record<string, number>>((acc, file) => {
    const key = file.fileType;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const profileCompleteness = useMemo(() => {
    const required = PROFILE_REQUIRED_FIELDS.map((field) => field as string);
    return completenessPercent(profile as unknown as Record<string, string>, required);
  }, [profile]);

  const missingFields = useMemo(
    () =>
      PROFILE_REQUIRED_FIELDS.filter((field) => profile[field].trim().length === 0).map(
        (field) => PROFILE_FIELD_LABELS[field]
      ),
    [profile]
  );

  const addressText = toAddress([
    profile.addressLine,
    `${profile.postalCode} ${profile.city}`.trim(),
  ]);

  const handleDraftChange = <K extends keyof BrfPropertyProfile>(
    field: K,
    value: BrfPropertyProfile[K]
  ) => {
    setDraftProfile((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = () => {
    const normalized: BrfPropertyProfile = {
      ...draftProfile,
      addressLine: draftProfile.addressLine.trim(),
      postalCode: draftProfile.postalCode.trim(),
      city: draftProfile.city.trim(),
      procurementEmail: draftProfile.procurementEmail.trim(),
      procurementPhone: draftProfile.procurementPhone.trim(),
      procurementContact: draftProfile.procurementContact.trim(),
    };

    setProfile(normalized);
    writeStoredObject(
      BRF_PROPERTY_PROFILE_KEY,
      BRF_PROPERTY_PROFILE_UPDATED_EVENT,
      normalized
    );
    setIsEditing(false);
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || typeof window === "undefined") return;
    const additions: BrfFileRecord[] = Array.from(fileList).map((file) => ({
      id: `${file.name.toLowerCase()}-${file.size}`,
      name: file.name,
      fileType: inferBrfFileType(file.name),
      extension: getFileExtension(file.name),
      sizeKb: Number((file.size / 1024).toFixed(1)),
      uploadedAt: new Date().toISOString(),
      sourceLabel: "Manuell uppladdning",
    }));

    const updated = [...additions, ...files.filter((item) => !additions.some((a) => a.id === item.id))].slice(
      0,
      300
    );

    setFiles(updated);
    localStorage.setItem(BRF_FILES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(BRF_FILES_UPDATED_EVENT));
  };

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#F6F3EE] text-[#2A2520] antialiased">
        <div className="mx-auto flex min-h-screen max-w-[1400px] items-center justify-center px-6">
          <p className="rounded-xl border border-[#E6DFD6] bg-white px-4 py-2 text-sm text-[#6B5A47]">
            Laddar konto...
          </p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Bostadsrättsförening"
      heading={`Fastighet: ${profile.propertyName || "Ej namnsatt"}`}
      subheading="Samlad fastighetsyta för upphandling: strukturera fakta, komponenter och dokument så entreprenörer får rätt underlag från start."
      startProjectHref="/dashboard/brf/underhallsplan"
      startProjectLabel="Underhållsplan"
      navItems={[
        { href: "/dashboard/brf", label: "Översikt" },
        { href: "/dashboard/brf/fastighet", label: "Fastighet" },
        { href: "/dashboard/brf/underhallsplan", label: "Underhållsplan" },
        { href: "/brf/start", label: "Initiera BRF-projekt" },
      ]}
      cards={[]}
    >
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                Fastighetskort
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#2A2520]">
                {profile.propertyName}
              </h2>
              <p className="mt-1 text-sm text-[#6B5A47]">
                {profile.associationName || "Föreningsnamn saknas"}
              </p>
              <p className="text-sm text-[#6B5A47]">{addressText || "Adress saknas"}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isEditing) {
                  setDraftProfile(profile);
                }
                setIsEditing((prev) => !prev);
              }}
              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              {isEditing ? "Avbryt redigering" : "Redigera fastighet"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Byggår", value: profile.buildingYear || "—" },
              { label: "Lägenheter", value: profile.apartmentsCount || "—" },
              { label: "Byggnader", value: profile.buildingsCount || "—" },
              {
                label: "BOA / LOA",
                value: `${formatInteger(profile.boaM2)} / ${formatInteger(profile.loaM2)} m²`,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#2A2520]">{item.value}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            Offertunderlag
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#2A2520]">
            {profileCompleteness}% komplett
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EFE8DD]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8C7860] to-[#6B5A47]"
              style={{ width: `${profileCompleteness}%` }}
            />
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <p className="rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-[#314A60]">
              Entreprenören får bättre offertunderlag när byggdata, logistik, kontakt och
              dokumenttyper är ifyllda.
            </p>
            {missingFields.length > 0 && (
              <p className="rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-[#6B5A47]">
                Saknas: {missingFields.slice(0, 4).join(", ")}
                {missingFields.length > 4 ? ` +${missingFields.length - 4} till` : ""}.
              </p>
            )}
          </div>
          <div className="mt-4 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2 text-xs text-[#6B5A47]">
            Senast planuppdatering: {latestRequest ? formatDate(latestRequest.createdAt) : "Ingen ännu"}
          </div>
          {effectiveSnapshot && (
            <div className="mt-3 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2 text-xs text-[#6B5A47]">
              Snapshot: {effectiveSnapshot.completenessScore}% komplett · risk{" "}
              {toSwedishRiskLabel(effectiveSnapshot.riskProfile.level)}
            </div>
          )}
        </article>
      </section>

      <section className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { id: "overview" as const, label: "Om fastigheten" },
          { id: "components" as const, label: "Komponenter" },
          { id: "files" as const, label: "Filer" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === item.id
                ? "bg-[#8C7860] text-white"
                : "border border-[#D9D1C6] bg-white text-[#6B5A47] hover:bg-[#F6F0E8]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </section>

      {tab === "overview" && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          {!isEditing && (
            <>
              <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <article className="rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4">
                  <h3 className="text-lg font-bold text-[#2A2520]">Fastighetsfakta</h3>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ["Bruttoarea", `${formatInteger(profile.grossM2)} m²`],
                      ["Våningar", profile.floorsCount || "—"],
                      ["Hissar", profile.elevatorsCount || "—"],
                      ["Värmesystem", profile.heatingSystem || "—"],
                      ["Ventilation", profile.ventilationSystem || "—"],
                      ["Fasad", profile.facadeType || "—"],
                      ["Tak", profile.roofType || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                          {label}
                        </p>
                        <p className="mt-1 font-semibold text-[#2A2520]">{value}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4">
                  <h3 className="text-lg font-bold text-[#2A2520]">Entreprenörsviktig kontext</h3>
                  <div className="mt-3 space-y-2 text-sm text-[#2A2520]">
                    <p className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                      <span className="font-semibold">Logistik:</span>{" "}
                      {profile.accessibilityLogistics || "Ej angivet"}
                    </p>
                    <p className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                      <span className="font-semibold">Begränsningar:</span>{" "}
                      {profile.authorityConstraints || "Ej angivet"}
                    </p>
                    <p className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                      <span className="font-semibold">Kontakt:</span>{" "}
                      {profile.procurementContact || "Ej angivet"}
                      {profile.procurementEmail ? ` · ${profile.procurementEmail}` : ""}
                      {profile.procurementPhone ? ` · ${profile.procurementPhone}` : ""}
                    </p>
                    <p className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                      <span className="font-semibold">Noteringar:</span>{" "}
                      {profile.notes || "Ej angivet"}
                    </p>
                  </div>
                </article>
              </div>

              {effectiveSnapshot && (
                <article className="mt-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4">
                  <h3 className="text-lg font-bold text-[#2A2520]">Projektets sammanfattning</h3>
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                        Projekttyp
                      </p>
                      <p className="mt-1 font-semibold text-[#2A2520]">
                        {effectiveSnapshot.overview.projectType}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                        Budget
                      </p>
                      <p className="mt-1 font-semibold text-[#2A2520]">
                        {formatSnapshotBudget(effectiveSnapshot)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                        Startfönster
                      </p>
                      <p className="mt-1 font-semibold text-[#2A2520]">
                        {formatSnapshotTimeline(effectiveSnapshot)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                        Risk
                      </p>
                      <p className="mt-1 font-semibold text-[#2A2520]">
                        {toSwedishRiskLabel(effectiveSnapshot.riskProfile.level)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 rounded-xl border border-[#E8E3DC] bg-white px-3 py-2 text-sm text-[#2A2520]">
                    {effectiveSnapshot.overview.description}
                  </p>
                </article>
              )}
            </>
          )}

          {isEditing && (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-bold text-[#2A2520]">Basdata</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { key: "propertyName", label: "Fastighetsnamn" },
                    { key: "associationName", label: "Förening" },
                    { key: "addressLine", label: "Adress" },
                    { key: "postalCode", label: "Postnummer" },
                    { key: "city", label: "Ort" },
                    { key: "buildingYear", label: "Byggår" },
                    { key: "apartmentsCount", label: "Antal lägenheter" },
                    { key: "buildingsCount", label: "Antal byggnader" },
                    { key: "boaM2", label: "BOA (m²)" },
                    { key: "loaM2", label: "LOA (m²)" },
                    { key: "grossM2", label: "Bruttoarea (m²)" },
                    { key: "floorsCount", label: "Antal våningar" },
                    { key: "elevatorsCount", label: "Antal hissar" },
                  ].map((field) => (
                    <label key={field.key} className="block text-sm">
                      <span className="mb-1 block font-semibold text-[#2A2520]">{field.label}</span>
                      <input
                        value={draftProfile[field.key as keyof BrfPropertyProfile]}
                        onChange={(event) =>
                          handleDraftChange(
                            field.key as keyof BrfPropertyProfile,
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-[#2A2520]">Tekniska system</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[
                    { key: "heatingSystem", label: "Värmesystem" },
                    { key: "ventilationSystem", label: "Ventilation" },
                    { key: "facadeType", label: "Fasad" },
                    { key: "roofType", label: "Tak" },
                  ].map((field) => (
                    <label key={field.key} className="block text-sm">
                      <span className="mb-1 block font-semibold text-[#2A2520]">{field.label}</span>
                      <input
                        value={draftProfile[field.key as keyof BrfPropertyProfile]}
                        onChange={(event) =>
                          handleDraftChange(
                            field.key as keyof BrfPropertyProfile,
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-[#2A2520]">Upphandling och logistik</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[
                    {
                      key: "accessibilityLogistics",
                      label: "Logistik, framkomlighet och boendepåverkan",
                      multiline: true,
                    },
                    {
                      key: "authorityConstraints",
                      label: "Myndighetskrav eller kända begränsningar",
                      multiline: true,
                    },
                    { key: "procurementContact", label: "Kontaktperson" },
                    { key: "procurementEmail", label: "Kontakt e-post" },
                    { key: "procurementPhone", label: "Kontakt telefon" },
                    { key: "notes", label: "Övriga noteringar", multiline: true },
                  ].map((field) => (
                    <label
                      key={field.key}
                      className={`block text-sm ${field.multiline ? "md:col-span-2" : ""}`}
                    >
                      <span className="mb-1 block font-semibold text-[#2A2520]">{field.label}</span>
                      {field.multiline ? (
                        <textarea
                          value={draftProfile[field.key as keyof BrfPropertyProfile]}
                          onChange={(event) =>
                            handleDraftChange(
                              field.key as keyof BrfPropertyProfile,
                              event.target.value
                            )
                          }
                          rows={3}
                          className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                        />
                      ) : (
                        <input
                          value={draftProfile[field.key as keyof BrfPropertyProfile]}
                          onChange={(event) =>
                            handleDraftChange(
                              field.key as keyof BrfPropertyProfile,
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveProfile}
                  className="rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5A47]"
                >
                  Spara fastighetsdata
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftProfile(profile);
                    setIsEditing(false);
                  }}
                  className="rounded-xl border border-[#D2C5B5] bg-white px-5 py-2.5 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "components" && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={componentQuery}
              onChange={(event) => setComponentQuery(event.target.value)}
              placeholder="Sök komponent, kategori, byggnad eller typ"
              className="min-w-[280px] flex-1 rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
            />
            <select
              value={componentYearFilter}
              onChange={(event) => setComponentYearFilter(event.target.value)}
              className="rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
            >
              <option value="alla">Planerat år: Alla</option>
              {componentYearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {Object.entries(groupedComponents).map(([group, rows]) => (
              <div key={group} className="overflow-hidden rounded-2xl border border-[#E6DFD6]">
                <div className="flex items-center justify-between bg-[#355F86] px-4 py-2 text-sm font-semibold text-white">
                  <span>{group}</span>
                  <span>{rows.length} komponenter</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse bg-white text-sm">
                    <thead>
                      <tr className="border-b border-[#EFE8DD] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                        <th className="px-3 py-3">Komponent</th>
                        <th className="px-3 py-3">Typ</th>
                        <th className="px-3 py-3">Byggnad</th>
                        <th className="px-3 py-3">Läge</th>
                        <th className="px-3 py-3">Mängd</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Planerat år</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-b border-[#F1ECE5]">
                          <td className="px-3 py-3 font-semibold text-[#2A2520]">{row.name}</td>
                          <td className="px-3 py-3">{row.componentType}</td>
                          <td className="px-3 py-3">{row.building}</td>
                          <td className="px-3 py-3">{row.location}</td>
                          <td className="px-3 py-3">{row.quantity}</td>
                          <td className="px-3 py-3">
                            <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-1 text-xs font-semibold">
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">{row.plannedYear}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {Object.keys(groupedComponents).length === 0 && (
              <p className="rounded-xl border border-[#E6DFD6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B5A47]">
                Inga komponenter matchar filtret ännu. Ladda upp en underhållsplan för att fylla listan.
              </p>
            )}
          </div>
        </section>
      )}

      {tab === "files" && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={fileQuery}
              onChange={(event) => setFileQuery(event.target.value)}
              placeholder="Sök filnamn, filtyp, källa eller kopplad åtgärd"
              className="min-w-[280px] flex-1 rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
            />
            <select
              value={fileTypeFilter}
              onChange={(event) => setFileTypeFilter(event.target.value as "Alla" | BrfFileType)}
              className="rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
            >
              <option value="Alla">Filtyp: Alla</option>
              {fileTypeOptions.map((fileType) => (
                <option key={fileType} value={fileType}>
                  {getFileTypeLabel(fileType)}
                </option>
              ))}
            </select>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]">
              Lägg till filer
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {fileTypeOptions.map((fileType) => (
              <span
                key={`count-${fileType}`}
                className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-1 text-xs font-semibold text-[#6B5A47]"
              >
                {getFileTypeLabel(fileType)} · {fileTypeCounts[fileType] || 0}
              </span>
            ))}
          </div>

          <article className="rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4">
            <h3 className="text-sm font-semibold text-[#2A2520]">
              Filer från ProjectSnapshot ({filteredSnapshotFiles.length})
            </h3>
            {filteredSnapshotFiles.length === 0 && (
              <p className="mt-2 text-sm text-[#6B5A47]">
                Inga snapshot-filer matchar filtret ännu.
              </p>
            )}
            {filteredSnapshotFiles.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E6DFD6] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                      <th className="px-3 py-3">Namn</th>
                      <th className="px-3 py-3">Filtyp</th>
                      <th className="px-3 py-3">Format</th>
                      <th className="px-3 py-3">Filstorlek</th>
                      <th className="px-3 py-3">Källa</th>
                      <th className="px-3 py-3">Uppladdad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSnapshotFiles.map((file) => (
                      <tr key={file.id} className="border-b border-[#EFE8DD]">
                        <td className="px-3 py-3 font-semibold text-[#2A2520]">{file.name}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-1 text-xs font-semibold text-[#6B5A47]">
                            {getFileTypeLabel(file.fileType)}
                          </span>
                        </td>
                        <td className="px-3 py-3">{file.extension ? file.extension.toUpperCase() : "—"}</td>
                        <td className="px-3 py-3">{file.sizeKb > 0 ? `${file.sizeKb} KB` : "—"}</td>
                        <td className="px-3 py-3">{file.sourceLabel}</td>
                        <td className="px-3 py-3">{formatDate(file.uploadedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="mt-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4">
            <h3 className="text-sm font-semibold text-[#2A2520]">
              Manuellt uppladdade filer ({filteredManualFiles.length})
            </h3>
            {filteredManualFiles.length === 0 && (
              <p className="mt-2 text-sm text-[#6B5A47]">
                Inga manuella filer matchar filtret ännu.
              </p>
            )}
            {filteredManualFiles.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E6DFD6] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                      <th className="px-3 py-3">Namn</th>
                      <th className="px-3 py-3">Filtyp</th>
                      <th className="px-3 py-3">Format</th>
                      <th className="px-3 py-3">Filstorlek</th>
                      <th className="px-3 py-3">Källa</th>
                      <th className="px-3 py-3">Kopplad åtgärd</th>
                      <th className="px-3 py-3">Uppladdad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManualFiles.map((file) => (
                      <tr key={file.id} className="border-b border-[#EFE8DD]">
                        <td className="px-3 py-3 font-semibold text-[#2A2520]">{file.name}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-1 text-xs font-semibold text-[#6B5A47]">
                            {getFileTypeLabel(file.fileType)}
                          </span>
                        </td>
                        <td className="px-3 py-3">{file.extension ? file.extension.toUpperCase() : "—"}</td>
                        <td className="px-3 py-3">{file.sizeKb > 0 ? `${file.sizeKb} KB` : "—"}</td>
                        <td className="px-3 py-3">{file.sourceLabel}</td>
                        <td className="px-3 py-3">{file.linkedActionTitle || "—"}</td>
                        <td className="px-3 py-3">{formatDate(file.uploadedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      )}
    </DashboardShell>
  );
}
