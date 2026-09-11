import { Router } from "express";
import { loadContacts, saveContacts } from "../services/dataStore.js";
import {
  deleteProfileByPhone,
  getMemoryProfileByPhone,
  patchProfileTraits,
  splitJapaneseName,
} from "../services/memory.js";
import { logger } from "../services/logger.js";
import type { Contact } from "../types/domain.js";

export const contactsRouter = Router();

function normalizePhone(input: string): string {
  return input.replace(/[\s\-()]/g, "").trim();
}

function genContactId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36).slice(-4);
  return `contact-${ts}${rand}`;
}

function trimOrUndefined(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
}
function toNumberOrUndefined(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function toBoolOrUndefined(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}
function toEmploymentType(v: unknown): Contact["preferredEmploymentType"] {
  const s = typeof v === "string" ? v.trim() : "";
  if (
    s === "full_time" ||
    s === "part_time" ||
    s === "contract" ||
    s === "dispatch"
  ) {
    return s;
  }
  return undefined;
}

contactsRouter.get("/contacts", (_req, res) => {
  res.json(loadContacts());
});

contactsRouter.get("/contacts/:id", (req, res) => {
  const c = loadContacts().find((c) => c.id === req.params.id);
  if (!c) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(c);
});

contactsRouter.get("/contacts/:id/memory", async (req, res) => {
  const c = loadContacts().find((c) => c.id === req.params.id);
  if (!c) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const memory = await getMemoryProfileByPhone(c.phone);
  res.json({ contact: c, memory });
});

interface CreateContactBody {
  name?: string;
  furigana?: string;
  phone?: string;
  license?: string;
  experienceYears?: number | string;
  preferredPrefecture?: string;
  preferredCity?: string;
  preferredEmploymentType?: string;
  wantsNightShift?: boolean | string;
  hourlyWageMinJpy?: number | string;
}

contactsRouter.post("/contacts", async (req, res) => {
  const body = req.body as CreateContactBody;
  const name = (body?.name || "").trim();
  const phone = normalizePhone(body?.phone || "");
  if (!name || !phone) {
    res.status(400).json({ error: "name and phone are required" });
    return;
  }
  if (!/^\+/.test(phone)) {
    res.status(400).json({ error: "phone must be E.164 (start with +)" });
    return;
  }
  const list = loadContacts();
  if (list.some((c) => c.phone === phone)) {
    res.status(409).json({ error: "phone already registered" });
    return;
  }

  const contact: Contact = {
    id: genContactId(),
    name,
    furigana: trimOrUndefined(body?.furigana),
    phone,
    license: trimOrUndefined(body.license),
    experienceYears: toNumberOrUndefined(body.experienceYears),
    preferredPrefecture: trimOrUndefined(body.preferredPrefecture),
    preferredCity: trimOrUndefined(body.preferredCity),
    preferredEmploymentType: toEmploymentType(body.preferredEmploymentType),
    wantsNightShift: toBoolOrUndefined(body.wantsNightShift),
    hourlyWageMinJpy: toNumberOrUndefined(body.hourlyWageMinJpy),
  };
  list.push(contact);
  saveContacts(list);

  // Memory 側は Contact + Candidate 両 group に登録済 trait を best-effort mirror。
  // profile が未存在 (通話前) の場合は patched:false + memProfileId:null。
  const { firstName, lastName } = splitJapaneseName(contact.name);
  const memoryResult = await patchProfileTraits(contact.phone, {
    contact: {
      firstName,
      lastName,
      city: contact.preferredCity,
    },
    candidate: {
      license: contact.license,
      experienceYears: contact.experienceYears,
      preferredPrefecture: contact.preferredPrefecture,
      preferredCity: contact.preferredCity,
      preferredEmploymentType: contact.preferredEmploymentType,
      wantsNightShift: contact.wantsNightShift,
      hourlyWageMinJpy: contact.hourlyWageMinJpy,
      furigana: contact.furigana,
      tags: contact.tags,
    },
  }).catch((e) => {
    logger.warn({ err: (e as Error).message }, "memory patch error");
    return { patched: false, memProfileId: null as string | null };
  });

  logger.info(
    { contactId: contact.id, phone, memory: memoryResult },
    "contact created",
  );
  res.status(201).json({ contact, memory: memoryResult });
});

interface UpdateTraitsBody {
  license?: string | null;
  experienceYears?: number | string | null;
  preferredPrefecture?: string | null;
  preferredCity?: string | null;
  preferredEmploymentType?: string | null;
  wantsNightShift?: boolean | string | null;
  hourlyWageMinJpy?: number | string | null;
}

/**
 * オペレータが確認項目 (checklist) を最終確定して Memory に保存する。
 *  - contacts.json ローカル値を上書き (通話前に見える初期値)
 *  - Twilio Memory の Candidate.* を PATCH (プロファイル横断で永続化)
 */
contactsRouter.patch("/contacts/:id/traits", async (req, res) => {
  const list = loadContacts();
  const idx = list.findIndex((c) => c.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const body = (req.body || {}) as UpdateTraitsBody;
  const current = list[idx];

  const nextLicense = trimOrUndefined(body.license);
  const nextExperienceYears = toNumberOrUndefined(body.experienceYears);
  const nextPreferredPrefecture = trimOrUndefined(body.preferredPrefecture);
  const nextPreferredCity = trimOrUndefined(body.preferredCity);
  const nextEmploymentType = toEmploymentType(body.preferredEmploymentType);
  const nextWantsNightShift = toBoolOrUndefined(body.wantsNightShift);
  const nextHourlyWage = toNumberOrUndefined(body.hourlyWageMinJpy);

  const updated: Contact = {
    ...current,
    license: "license" in body ? nextLicense : current.license,
    experienceYears:
      "experienceYears" in body ? nextExperienceYears : current.experienceYears,
    preferredPrefecture:
      "preferredPrefecture" in body
        ? nextPreferredPrefecture
        : current.preferredPrefecture,
    preferredCity:
      "preferredCity" in body ? nextPreferredCity : current.preferredCity,
    preferredEmploymentType:
      "preferredEmploymentType" in body
        ? nextEmploymentType
        : current.preferredEmploymentType,
    wantsNightShift:
      "wantsNightShift" in body
        ? nextWantsNightShift
        : current.wantsNightShift,
    hourlyWageMinJpy:
      "hourlyWageMinJpy" in body ? nextHourlyWage : current.hourlyWageMinJpy,
  };
  list[idx] = updated;
  saveContacts(list);

  const memoryResult = await patchProfileTraits(updated.phone, {
    contact: {
      city: updated.preferredCity,
    },
    candidate: {
      license: updated.license,
      experienceYears: updated.experienceYears,
      preferredPrefecture: updated.preferredPrefecture,
      preferredCity: updated.preferredCity,
      preferredEmploymentType: updated.preferredEmploymentType,
      wantsNightShift: updated.wantsNightShift,
      hourlyWageMinJpy: updated.hourlyWageMinJpy,
    },
  }).catch((e) => {
    logger.warn({ err: (e as Error).message }, "memory patch on traits update error");
    return { patched: false, memProfileId: null as string | null };
  });

  logger.info(
    { contactId: updated.id, phone: updated.phone, memory: memoryResult },
    "contact traits updated",
  );
  res.json({ contact: updated, memory: memoryResult });
});

contactsRouter.delete("/contacts/:id", async (req, res) => {
  const list = loadContacts();
  const idx = list.findIndex((c) => c.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const [removed] = list.splice(idx, 1);
  saveContacts(list);
  const memoryDeleted = await deleteProfileByPhone(removed.phone).catch(
    () => false,
  );
  logger.info(
    { contactId: removed.id, phone: removed.phone, memoryDeleted },
    "contact deleted",
  );
  res.json({ ok: true, removed, memoryDeleted });
});
