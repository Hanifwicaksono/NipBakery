import { BaseRepository } from './base.repository'
import type { SystemSettings } from '@/types'
import { getDoc, setDoc } from 'firebase/firestore'

export class SystemSettingsRepository extends BaseRepository<SystemSettings> {
  constructor() {
    super('settings');
  }

  // Get or seed global settings document
  async getOrCreateGlobalSettings(): Promise<SystemSettings> {
    const docRef = this.getDocRef('global');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as SystemSettings;
    }

    // Default configuration
    const defaultSettings: SystemSettings = {
      id: 'global',
      currency: 'Rp',
      taxPercentage: 0,
      defaultMarkup: 100,
      lastBackupDate: null,
    };

    await setDoc(docRef, defaultSettings);
    return defaultSettings;
  }
}
export default SystemSettingsRepository
