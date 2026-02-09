"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { SchedulePreviewCard } from "../../../components/gantt/SchedulePreviewCard";
import type { BrfFileRecord, BrfFileType } from "../../../lib/brf-workspace";
import {
  PRIVATE_FILES_KEY,
  PRIVATE_FILES_UPDATED_EVENT,
  clearWorkspaceFiles,
  getFileExtension,
  getFileTypeLabel,
  hasWorkspaceFilePayload,
  inferBrfFileType,
  inferContentGroup,
  normalizeWorkspaceFileRecord,
  openWorkspaceFile,
  readWorkspaceFiles,
  removeWorkspaceFile,
  storeWorkspaceFilePayload,
  structureWorkspaceFiles,
  writeWorkspaceFiles,
} from "../../../lib/brf-workspace";
import type { PrivateHomeProfile } from "../../../lib/workspace-profiles";
import {
  DEFAULT_PRIVATE_HOME_PROFILE,
  PRIVATE_HOME_PROFILE_KEY,
  PRIVATE_HOME_PROFILE_UPDATED_EVENT,
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
import type { ScheduleProjectContext } from "../../../lib/schedule";

type PrivateTab = "home" | "project" | "files" | "timeline";

const PRIVATE_REQUIRED_FIELDS: Array<keyof PrivateHomeProfile> = [
  "projectName",
  "homeType",
  "addressLine",
  "postalCode",
  "city",
  "livingAreaM2",
  "accessAndParking",
  "budgetRange",
  "desiredStart",
  "contactName",
  "contactEmail",
];

const PRIVATE_FIELD_LABELS: Record<keyof PrivateHomeProfile, string> = {
  projectName: "Projektnamn",
  homeType: "Bostadstyp",
  addressLine: "Adress",
  postalCode: "Postnummer",
  city: "Ort",
  buildYear: "Byggår",
  livingAreaM2: "Boyta",
  lotAreaM2: "Tomtyta",
  floorsCount: "Våningar",
  bathroomsCount: "Badrum",
  kitchenCount: "Kök",
  residentsDuringWork: "Kvarboende",
  accessAndParking: "Tillgång och parkering",
  permitStatus: "Bygglovsläge",
  budgetRange: "Budget",
  desiredStart: "Önskad start",
  contactName: "Kontaktperson",
  contactEmail: "Kontakt e-post",
  contactPhone: "Kontakt telefon",
  notes: "Övrigt",
};

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

function readPrivateProfile(): PrivateHomeProfile {
  return (
    readStoredObject<PrivateHomeProfile>(PRIVATE_HOME_PROFILE_KEY) ||
    DEFAULT_PRIVATE_HOME_PROFILE
  );
}

function readPrivateFiles(): BrfFileRecord[] {
  return readWorkspaceFiles("privat");
}

function mapSnapshotFiles(snapshot: ProjectSnapshot | null): BrfFileRecord[] {
  if (!snapshot || snapshot.files.length === 0) return [];
  return snapshot.files.slice(0, 100).map((file, index) => ({
    id: file.id || `${file.name.toLowerCase()}-${index}`,
    name: file.name,
    fileType: inferBrfFileType(file.name),
    extension: getFileExtension(file.name),
    sizeKb: file.size ? Number((file.size / 1024).toFixed(1)) : 0,
    uploadedAt: snapshot.createdAt,
    sourceLabel: "ProjectSnapshot",
  })).map(normalizeWorkspaceFileRecord);
}

function readPrivateSnapshot(): ProjectSnapshot | null {
  const snapshot = readProjectSnapshotFromStorage();
  if (!snapshot || snapshot.audience !== "privat") return null;
  return snapshot;
}

export default function PrivatUnderlagPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [tab, setTab] = useState<PrivateTab>("home");
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<PrivateHomeProfile>(() => readPrivateProfile());
  const [draftProfile, setDraftProfile] = useState<PrivateHomeProfile>(() => readPrivateProfile());
  const [projectSnapshot, setProjectSnapshot] = useState<ProjectSnapshot | null>(() =>
    readPrivateSnapshot()
  );
  const [files, setFiles] = useState<BrfFileRecord[]>(() => readPrivateFiles());
  const [fileQuery, setFileQuery] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<"Alla" | BrfFileType>("Alla");
  const [fileActionNotice, setFileActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=privat");
      return;
    }
    if (user.role === "brf") {
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
    }
  }, [ready, router, user]);

  useEffect(() => {
    const onProfile = () => setProfile(readPrivateProfile());
    const onFiles = () => setFiles(readPrivateFiles());
    const onSnapshot = () => setProjectSnapshot(readPrivateSnapshot());
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === PRIVATE_HOME_PROFILE_KEY) onProfile();
      if (event.key === PRIVATE_FILES_KEY) onFiles();
      if (event.key === PROJECT_SNAPSHOT_KEY) onSnapshot();
    };

    window.addEventListener(PRIVATE_HOME_PROFILE_UPDATED_EVENT, onProfile);
    window.addEventListener(PRIVATE_FILES_UPDATED_EVENT, onFiles);
    window.addEventListener(PROJECT_SNAPSHOT_UPDATED_EVENT, onSnapshot);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(PRIVATE_HOME_PROFILE_UPDATED_EVENT, onProfile);
      window.removeEventListener(PRIVATE_FILES_UPDATED_EVENT, onFiles);
      window.removeEventListener(PROJECT_SNAPSHOT_UPDATED_EVENT, onSnapshot);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const snapshotFiles = useMemo(
    () => mapSnapshotFiles(projectSnapshot),
    [projectSnapshot]
  );
  const manualFiles = useMemo(() => files.map(normalizeWorkspaceFileRecord), [files]);
  const allFiles = useMemo(
    () => [...snapshotFiles, ...manualFiles],
    [manualFiles, snapshotFiles]
  );

  const fileTypeOptions = useMemo(() => {
    const unique = Array.from(new Set(allFiles.map((file) => file.fileType)));
    return unique.sort((a, b) => getFileTypeLabel(a).localeCompare(getFileTypeLabel(b), "sv"));
  }, [allFiles]);

  const filteredSnapshotFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    return snapshotFiles.filter((file) => {
      const matchesType = fileTypeFilter === "Alla" || file.fileType === fileTypeFilter;
      const matchesQuery =
        q.length === 0 ||
        file.name.toLowerCase().includes(q) ||
        getFileTypeLabel(file.fileType).toLowerCase().includes(q) ||
        file.sourceLabel.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [fileQuery, fileTypeFilter, snapshotFiles]);

  const filteredManualFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    return manualFiles.filter((file) => {
      const matchesType = fileTypeFilter === "Alla" || file.fileType === fileTypeFilter;
      const matchesQuery =
        q.length === 0 ||
        file.name.toLowerCase().includes(q) ||
        getFileTypeLabel(file.fileType).toLowerCase().includes(q) ||
        file.sourceLabel.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [fileQuery, fileTypeFilter, manualFiles]);

  const fileTypeCounts = useMemo(
    () =>
      allFiles.reduce<Record<string, number>>((acc, file) => {
        const key = file.fileType;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [allFiles]
  );

  const groupedManualFiles = useMemo(
    () =>
      filteredManualFiles.reduce<Record<string, BrfFileRecord[]>>((acc, file) => {
        const group = file.contentGroup || inferContentGroup(file.fileType);
        if (!acc[group]) acc[group] = [];
        acc[group].push(file);
        return acc;
      }, {}),
    [filteredManualFiles]
  );

  const completeness = useMemo(() => {
    const required = PRIVATE_REQUIRED_FIELDS.map((field) => field as string);
    return completenessPercent(profile as unknown as Record<string, string>, required);
  }, [profile]);

  const missingFields = useMemo(
    () =>
      PRIVATE_REQUIRED_FIELDS.filter((field) => profile[field].trim().length === 0).map(
        (field) => PRIVATE_FIELD_LABELS[field]
      ),
    [profile]
  );

  const addressText = toAddress([
    profile.addressLine,
    `${profile.postalCode} ${profile.city}`.trim(),
  ]);
  const timelineContext = useMemo<ScheduleProjectContext>(
    () => ({
      projectId: projectSnapshot?.id || "privat-underlag-active",
      title: profile.projectName || projectSnapshot?.overview.title || "Privat projekt",
      audience: "privat",
      snapshot: projectSnapshot || undefined,
    }),
    [profile.projectName, projectSnapshot]
  );

  const handleDraftChange = <K extends keyof PrivateHomeProfile>(
    field: K,
    value: PrivateHomeProfile[K]
  ) => {
    setDraftProfile((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = () => {
    const normalized: PrivateHomeProfile = {
      ...draftProfile,
      addressLine: draftProfile.addressLine.trim(),
      postalCode: draftProfile.postalCode.trim(),
      city: draftProfile.city.trim(),
      contactName: draftProfile.contactName.trim(),
      contactEmail: draftProfile.contactEmail.trim(),
      contactPhone: draftProfile.contactPhone.trim(),
    };

    setProfile(normalized);
    writeStoredObject(
      PRIVATE_HOME_PROFILE_KEY,
      PRIVATE_HOME_PROFILE_UPDATED_EVENT,
      normalized
    );
    setIsEditing(false);
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || typeof window === "undefined") return;

    const additions: BrfFileRecord[] = Array.from(fileList).map((file) => {
      const id = `${file.name.toLowerCase()}-${file.size}`;
      const fileType = inferBrfFileType(file.name);
      return normalizeWorkspaceFileRecord({
        id,
        name: file.name,
        fileType,
        extension: getFileExtension(file.name),
        sizeKb: Number((file.size / 1024).toFixed(1)),
        uploadedAt: new Date().toISOString(),
        sourceLabel: "Manuell uppladdning",
        mimeType: file.type || undefined,
      });
    });

    const updated = [
      ...additions,
      ...files.filter((item) => !additions.some((a) => a.id === item.id)),
    ].slice(0, 300);

    setFiles(updated);
    writeWorkspaceFiles("privat", updated);
    await Promise.all(
      Array.from(fileList).map((file) =>
        storeWorkspaceFilePayload("privat", `${file.name.toLowerCase()}-${file.size}`, file)
      )
    );
    setFileActionNotice("Filer uppladdade och strukturerade.");
  };

  const openFile = (fileId: string) => {
    const ok = openWorkspaceFile("privat", fileId);
    if (!ok) {
      setFileActionNotice(
        "Filen kan inte öppnas lokalt ännu. Ladda upp den igen om du vill förhandsvisa."
      );
      return;
    }
    setFileActionNotice(null);
  };

  const deleteFile = (fileId: string) => {
    removeWorkspaceFile("privat", fileId);
    setFileActionNotice("Fil borttagen.");
  };

  const clearManualFiles = () => {
    clearWorkspaceFiles("privat");
    setFiles([]);
    setFileActionNotice("Alla manuellt uppladdade filer rensades.");
  };

  const structureManualFiles = () => {
    const structured = structureWorkspaceFiles("privat");
    setFiles(structured);
    setFileActionNotice("Filerna strukturerades efter innehåll.");
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
      roleLabel="Privatperson"
      heading="Bostad och projektunderlag"
      subheading="Samla bostadsfakta, underlag och kontaktinformation så entreprenörer kan lämna jämförbara offerter snabbare."
      startProjectHref="/start"
      startProjectLabel="Fortsätt wizard"
      navItems={[
        { href: "/dashboard/privat", label: "Översikt" },
        { href: "/dashboard/privat/underlag", label: "Bostad & underlag" },
        { href: "/timeline", label: "Timeline" },
        { href: "/dashboard/privat/forfragningar", label: "Mina förfrågningar" },
        { href: "/start", label: "Initiera / fortsätt projekt" },
      ]}
      cards={[]}
    >
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Projekt</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#2A2520]">
                {profile.projectName}
              </h2>
              <p className="mt-1 text-sm text-[#6B5A47]">{profile.homeType || "Bostadstyp saknas"}</p>
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
              {isEditing ? "Avbryt redigering" : "Redigera underlag"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Byggår", value: profile.buildYear || "—" },
              { label: "Boyta", value: `${formatInteger(profile.livingAreaM2)} m²` },
              { label: "Tomtyta", value: `${formatInteger(profile.lotAreaM2)} m²` },
              { label: "Våningar", value: profile.floorsCount || "—" },
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
            Underlagskvalitet
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#2A2520]">{completeness}% komplett</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EFE8DD]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8C7860] to-[#6B5A47]"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="mt-3 rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
            Tydlig bostadsdata, budget och filer minskar oklarheter när du begär offert.
          </p>
          {missingFields.length > 0 && (
            <p className="mt-3 rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
              Saknas: {missingFields.slice(0, 4).join(", ")}
              {missingFields.length > 4 ? ` +${missingFields.length - 4} till` : ""}.
            </p>
          )}
        </article>
      </section>

      <section className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { id: "home" as const, label: "Om bostaden" },
          { id: "project" as const, label: "Projektdata" },
          { id: "files" as const, label: "Filer" },
          { id: "timeline" as const, label: "Timeline" },
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

      {tab === "home" && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          {!isEditing && (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <article className="rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4">
                <h3 className="text-lg font-bold text-[#2A2520]">Bostadsfakta</h3>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  {[
                    ["Badrum", profile.bathroomsCount || "—"],
                    ["Kök", profile.kitchenCount || "—"],
                    ["Bygglov", profile.permitStatus || "—"],
                    ["Kvarboende", profile.residentsDuringWork || "—"],
                    ["Budget", profile.budgetRange || "—"],
                    ["Önskad start", profile.desiredStart || "—"],
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
                <h3 className="text-lg font-bold text-[#2A2520]">Kontakt och logistik</h3>
                <div className="mt-3 space-y-2 text-sm text-[#2A2520]">
                  <p className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                    <span className="font-semibold">Tillgång:</span> {profile.accessAndParking || "Ej angivet"}
                  </p>
                  <p className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                    <span className="font-semibold">Kontakt:</span>{" "}
                    {profile.contactName || "Ej angivet"}
                    {profile.contactEmail ? ` · ${profile.contactEmail}` : ""}
                    {profile.contactPhone ? ` · ${profile.contactPhone}` : ""}
                  </p>
                  <p className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                    <span className="font-semibold">Notering:</span> {profile.notes || "Ej angivet"}
                  </p>
                </div>
              </article>
            </div>
          )}

          {isEditing && (
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-bold text-[#2A2520]">Basdata</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { key: "projectName", label: "Projektnamn" },
                    { key: "homeType", label: "Bostadstyp" },
                    { key: "addressLine", label: "Adress" },
                    { key: "postalCode", label: "Postnummer" },
                    { key: "city", label: "Ort" },
                    { key: "buildYear", label: "Byggår" },
                    { key: "livingAreaM2", label: "Boyta (m²)" },
                    { key: "lotAreaM2", label: "Tomtyta (m²)" },
                    { key: "floorsCount", label: "Våningar" },
                    { key: "bathroomsCount", label: "Badrum" },
                    { key: "kitchenCount", label: "Kök" },
                  ].map((field) => (
                    <label key={field.key} className="block text-sm">
                      <span className="mb-1 block font-semibold text-[#2A2520]">{field.label}</span>
                      <input
                        value={draftProfile[field.key as keyof PrivateHomeProfile]}
                        onChange={(event) =>
                          handleDraftChange(
                            field.key as keyof PrivateHomeProfile,
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
                <h3 className="text-lg font-bold text-[#2A2520]">Projekt och kontakt</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[
                    { key: "residentsDuringWork", label: "Kvarboende under byggtid" },
                    { key: "permitStatus", label: "Bygglovsläge" },
                    { key: "budgetRange", label: "Budget" },
                    { key: "desiredStart", label: "Önskad start" },
                    { key: "contactName", label: "Kontaktperson" },
                    { key: "contactEmail", label: "Kontakt e-post" },
                    { key: "contactPhone", label: "Kontakt telefon" },
                    { key: "accessAndParking", label: "Tillgång, logistik och parkering", multiline: true },
                    { key: "notes", label: "Övrigt", multiline: true },
                  ].map((field) => (
                    <label
                      key={field.key}
                      className={`block text-sm ${field.multiline ? "md:col-span-2" : ""}`}
                    >
                      <span className="mb-1 block font-semibold text-[#2A2520]">{field.label}</span>
                      {field.multiline ? (
                        <textarea
                          value={draftProfile[field.key as keyof PrivateHomeProfile]}
                          onChange={(event) =>
                            handleDraftChange(
                              field.key as keyof PrivateHomeProfile,
                              event.target.value
                            )
                          }
                          rows={3}
                          className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                        />
                      ) : (
                        <input
                          value={draftProfile[field.key as keyof PrivateHomeProfile]}
                          onChange={(event) =>
                            handleDraftChange(
                              field.key as keyof PrivateHomeProfile,
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
                  Spara underlag
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

      {tab === "project" && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Projektstatus",
                value:
                  projectSnapshot
                    ? `${projectSnapshot.overview.projectType} · ${projectSnapshot.overview.title}`
                    : "Inte satt ännu",
              },
              {
                label: "Budgetintervall",
                value:
                  projectSnapshot
                    ? formatSnapshotBudget(projectSnapshot)
                    : profile.budgetRange || "Ej satt",
              },
              {
                label: "Startfönster",
                value:
                  projectSnapshot
                    ? formatSnapshotTimeline(projectSnapshot)
                    : profile.desiredStart || "Ej satt",
              },
              {
                label: "Filer i underlag",
                value: `${snapshotFiles.length + manualFiles.length} st`,
              },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#2A2520]">{item.value}</p>
              </article>
            ))}
          </div>

          {projectSnapshot && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Snapshot-kvalitet
                </p>
                <p className="mt-1 font-semibold text-[#2A2520]">
                  {projectSnapshot.completenessScore}% komplett
                </p>
                <p className="mt-2 text-[#6B5A47]">
                  Risknivå: {toSwedishRiskLabel(projectSnapshot.riskProfile.level)}
                </p>
              </article>
              <article className="rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Omfattning i snapshot
                </p>
                <p className="mt-1 text-[#2A2520]">
                  {projectSnapshot.scope.selectedItems.length > 0
                    ? projectSnapshot.scope.selectedItems.slice(0, 6).join(", ")
                    : "Ingen specifik delmängd vald ännu."}
                </p>
              </article>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4 text-sm text-[#2A2520]">
            <p className="font-semibold">Tips för bättre offertunderlag</p>
            <ul className="mt-2 space-y-1 text-[#6B5A47]">
              <li>Beskriv om du bor kvar under projektet och vilka tider som fungerar för arbete.</li>
              <li>Lägg till tydliga bilder på nuläge samt eventuell ritning eller skiss med mått.</li>
              <li>Var tydlig med budgetram och om tidplanen är flexibel.</li>
            </ul>
          </div>
        </section>
      )}

      {tab === "files" && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={fileQuery}
              onChange={(event) => setFileQuery(event.target.value)}
              placeholder="Sök filnamn, filtyp eller källa"
              className="min-w-[280px] flex-1 rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
            />
            <select
              value={fileTypeFilter}
              onChange={(event) => setFileTypeFilter(event.target.value as "Alla" | BrfFileType)}
              className="rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
            >
              <option value="Alla">Filtyp: Alla</option>
              {fileTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {getFileTypeLabel(type)}
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
                  void addFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={structureManualFiles}
              disabled={manualFiles.length === 0}
              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Strukturera efter innehåll
            </button>
            <button
              type="button"
              onClick={clearManualFiles}
              disabled={manualFiles.length === 0}
              className="rounded-xl border border-[#E8D4BF] bg-white px-4 py-2 text-sm font-semibold text-[#8A5B2A] hover:bg-[#FFF5EA] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Rensa manuella filer
            </button>
          </div>

          {fileActionNotice && (
            <p className="mb-4 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B5A47]">
              {fileActionNotice}
            </p>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            {fileTypeOptions.map((type) => (
              <span
                key={type}
                className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-1 text-xs font-semibold text-[#6B5A47]"
              >
                {getFileTypeLabel(type)} · {fileTypeCounts[type] || 0}
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
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E6DFD6] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                      <th className="px-3 py-3">Namn</th>
                      <th className="px-3 py-3">Filtyp</th>
                      <th className="px-3 py-3">Format</th>
                      <th className="px-3 py-3">Filstorlek</th>
                      <th className="px-3 py-3">Källa</th>
                      <th className="px-3 py-3">Uppladdad</th>
                      <th className="px-3 py-3">Åtgärd</th>
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
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => openFile(file.id)}
                            className="rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            {hasWorkspaceFilePayload("privat", file.id)
                              ? "Öppna"
                              : "Öppna (saknas lokalt)"}
                          </button>
                        </td>
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
                Inga manuella filer uppladdade ännu.
              </p>
            )}
            {filteredManualFiles.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E6DFD6] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                      <th className="px-3 py-3">Namn</th>
                      <th className="px-3 py-3">Filtyp</th>
                      <th className="px-3 py-3">Format</th>
                      <th className="px-3 py-3">Filstorlek</th>
                      <th className="px-3 py-3">Källa</th>
                      <th className="px-3 py-3">Uppladdad</th>
                      <th className="px-3 py-3">Åtgärd</th>
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
                        <td className="px-3 py-3">{formatDate(file.uploadedAt)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openFile(file.id)}
                              className="rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                            >
                              {hasWorkspaceFilePayload("privat", file.id)
                                ? "Öppna"
                                : "Öppna (saknas lokalt)"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteFile(file.id)}
                              className="rounded-lg border border-[#E8D4BF] bg-white px-3 py-1.5 text-xs font-semibold text-[#8A5B2A] hover:bg-[#FFF5EA]"
                            >
                              Ta bort
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {Object.keys(groupedManualFiles).length > 0 && (
            <article className="mt-4 rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4">
              <h3 className="text-sm font-semibold text-[#2A2520]">
                Strukturerad filvy (efter innehåll)
              </h3>
              <div className="mt-3 space-y-3">
                {Object.entries(groupedManualFiles)
                  .sort(([a], [b]) => a.localeCompare(b, "sv"))
                  .map(([group, groupFiles]) => (
                    <div key={group} className="rounded-xl border border-[#E8E3DC] bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                        {group} ({groupFiles.length})
                      </p>
                      <div className="mt-2 space-y-2">
                        {groupFiles.map((file) => (
                          <div
                            key={`group-${file.id}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#EFE8DD] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#2A2520]">{file.name}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(file.tags || []).slice(0, 5).map((tag) => (
                                  <span
                                    key={`${file.id}-${tag}`}
                                    className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openFile(file.id)}
                              className="rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                            >
                              Öppna fil
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </article>
          )}
        </section>
      )}

      {tab === "timeline" && (
        <section className="space-y-4">
          <SchedulePreviewCard
            context={timelineContext}
            heading="Projektets tidsplan"
            description="Auto-genererad från snapshot och underlag. Gå till Timeline för full redigering."
            maxTasks={14}
          />
        </section>
      )}
    </DashboardShell>
  );
}
