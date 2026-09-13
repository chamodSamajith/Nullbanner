// SPDX-License-Identifier: GPL-3.0-only
import { DEFAULT_STORAGE, type StorageSchema } from "./types";

const KEY = "nullbanner" as const;

/**
 * Typed wrapper over chrome.storage.local. This is the ONLY module allowed
 * to call chrome.storage directly — everything else goes through get/set/update.
 */
export async function getStorage(): Promise<StorageSchema> {
  const result = await chrome.storage.local.get(KEY);
  const stored = result[KEY] as Partial<StorageSchema> | undefined;
  if (!stored) return { ...DEFAULT_STORAGE };
  return { ...DEFAULT_STORAGE, ...stored };
}

export async function setStorage(value: StorageSchema): Promise<void> {
  await chrome.storage.local.set({ [KEY]: value });
}

export async function updateStorage(
  updater: (current: StorageSchema) => StorageSchema
): Promise<StorageSchema> {
  const current = await getStorage();
  const next = updater(current);
  await setStorage(next);
  return next;
}

export async function initStorage(): Promise<void> {
  const existing = await chrome.storage.local.get(KEY);
  if (!existing[KEY]) {
    await setStorage({ ...DEFAULT_STORAGE });
  }
}
