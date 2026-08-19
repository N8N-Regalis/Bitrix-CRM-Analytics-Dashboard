import { bitrixRequest } from '@/services/bitrixClient';

/**
 * Fetch the most recent timeline activity for a single deal from Bitrix24
 * @param {number} dealId - The deal ID to fetch activity for
 * @returns {Promise<string|null>} - The LAST_UPDATED or START_TIME of the most recent activity, or null if none found
 */
export async function fetchLastDealActivity(dealId) {
  try {
    const data = await bitrixRequest('crm.activity.list', {
      'filter[OWNER_TYPE_ID]': '2',
      'filter[OWNER_ID]': dealId,
      'order[LAST_UPDATED]': 'DESC',
      // Array value -> repeated select[] params. Previously these were three
      // duplicate keys in one object literal, so only the last one survived
      // and the response carried LAST_UPDATED alone.
      'select[]': ['ID', 'START_TIME', 'LAST_UPDATED'],
      start: '0',
    });
    // Use LAST_UPDATED as primary, fallback to START_TIME if LAST_UPDATED is not available
    return data.result?.[0]?.LAST_UPDATED || data.result?.[0]?.START_TIME || null;
  } catch (error) {
    console.error(`Failed to fetch activity for deal ${dealId}:`, error);
    return null;
  }
}

/**
 * Fetch the most recent timeline activity for multiple deals from Bitrix24
 * Processes requests in batches to avoid rate limiting
 * @param {number[]} dealIds - Array of deal IDs to fetch activities for
 * @param {number} batchSize - Number of deals to process in each batch (default: 10)
 * @returns {Promise<Map<number, string>>} - Map of deal ID to last activity START_TIME
 */
export async function fetchLastActivitiesForDeals(dealIds, batchSize = 10) {
  const activityMap = new Map();

  // Process in batches to avoid rate limiting
  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const promises = batch.map((id) =>
      fetchLastDealActivity(id).then((date) => ({ id, date }))
    );

    try {
      const results = await Promise.all(promises);
      results.forEach(({ id, date }) => {
        if (date) activityMap.set(id, date);
      });
    } catch (error) {
      console.error('Failed to fetch activities for batch:', error);
    }
  }

  return activityMap;
}
