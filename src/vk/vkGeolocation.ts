import { ensureVkWebAppInit, isVkClientEnvironment, vkBridge } from './vkBootstrap';

export type VkGeoCoords = { lat: number; lon: number };
export type VkGeoErrorCode = 'not_vk' | 'bridge_unavailable' | 'denied' | 'unavailable' | 'invalid_response' | 'unknown';

export class VkGeolocationError extends Error {
  code: VkGeoErrorCode;
  details?: unknown;

  constructor(code: VkGeoErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'VkGeolocationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Координаты через VK Bridge (запрос разрешения у пользователя).
 * @see https://dev.vk.com/bridge/VKWebAppGetGeodata
 */
export async function fetchVkGeolocation(): Promise<VkGeoCoords | null> {
  if (!isVkClientEnvironment()) throw new VkGeolocationError('not_vk', 'Not in VK client environment');
  if (typeof vkBridge.send !== 'function') {
    throw new VkGeolocationError('bridge_unavailable', 'vkBridge.send is unavailable');
  }
  await ensureVkWebAppInit();
  try {
    const res = (await vkBridge.send('VKWebAppGetGeodata')) as {
      available?: number | boolean | string;
      lat?: number;
      lon?: number;
      long?: number;
      latitude?: number;
      longitude?: number;
    };
    if (!res) return null;

    const available = res.available;
    const allowed = available === 1 || available === true || available === '1' || available == null;
    if (!allowed) throw new VkGeolocationError('unavailable', 'VK geodata unavailable', res);

    const lat = (res.lat ?? res.latitude) as number;
    const lon = (res.lon ?? res.long ?? res.longitude) as number;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new VkGeolocationError('invalid_response', 'VK returned invalid coordinates', res);
    }
    return { lat, lon };
  } catch (e) {
    if (e instanceof VkGeolocationError) throw e;
    if (typeof e === 'object' && e) {
      const obj = e as {
        error_data?: { error_code?: number; error_reason?: string };
        error_type?: string;
      };
      const ec = obj.error_data?.error_code;
      const reason = (obj.error_data?.error_reason || '').toLowerCase();
      if (ec === 4 || reason.includes('allow')) {
        throw new VkGeolocationError('denied', 'User denied VK geolocation permission', e);
      }
    }
    console.warn('[VK] VKWebAppGetGeodata failed:', e);
    throw new VkGeolocationError('unknown', 'VKWebAppGetGeodata failed', e);
  }
}
