import 'server-only';
import { cache } from 'react';
import { connectDB } from '@/lib/db/connect';
import { Setting } from '@/models';
import type { SettingGroup } from '@/models/Setting';
import { DEFAULT_SETTINGS, type SettingsMap } from './defaults';

export * from './defaults';

/**
 * Typed settings access.
 *
 * Every consumer reads through here, so a group that has never been saved
 * still returns a complete, valid object rather than undefined — and a
 * settings-collection outage degrades to defaults instead of a 500.
 */

export const getSettings = cache(
  async <K extends SettingGroup>(group: K): Promise<SettingsMap[K]> => {
    try {
      await connectDB();
      const doc = await Setting.findOne({ group }).lean();
      if (!doc?.values) return DEFAULT_SETTINGS[group];
      return {
        ...DEFAULT_SETTINGS[group],
        ...(doc.values as Partial<SettingsMap[K]>),
      } as unknown as SettingsMap[K];
    } catch {
      return DEFAULT_SETTINGS[group];
    }
  },
);

export async function saveSettings<K extends SettingGroup>(
  group: K,
  values: Partial<SettingsMap[K]>,
  updatedBy?: string,
): Promise<SettingsMap[K]> {
  await connectDB();
  const existing = await Setting.findOne({ group }).lean();
  const merged = { ...(existing?.values ?? {}), ...values };

  await Setting.findOneAndUpdate(
    { group },
    { group, values: merged, updatedBy: updatedBy ?? null },
    { upsert: true, new: true },
  );

  return merged as unknown as SettingsMap[K];
}
