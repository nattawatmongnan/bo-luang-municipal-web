import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const allowedOrigins = new Set([
  'https://bo-luang-municipal-web.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function cors(origin: string | null) {
  const allowOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : 'https://bo-luang-municipal-web.onrender.com';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function secretKey() {
  const modern = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return parsed.default as string;
    } catch {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function getClientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'edge-unknown'
  ).split(',')[0].trim();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) {
      return json({ ok: false, code: 'ORIGIN_DENIED' }, 403, origin);
    }
    return new Response('ok', { headers: cors(origin) });
  }

  if (req.method === 'GET') {
    return json({ ok: true, service: 'bo-luang-public-api', version: 3 }, 200, origin);
  }

  if (req.method !== 'POST') {
    return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405, origin);
  }

  if (!origin || !allowedOrigins.has(origin)) {
    return json({ ok: false, code: 'ORIGIN_DENIED' }, 403, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const key = secretKey();
  if (!supabaseUrl || !key) {
    return json({ ok: false, code: 'SERVER_CONFIG' }, 500, origin);
  }

  const forwarded = getClientIp(req);

  const admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-forwarded-for': forwarded } },
  });

  const contentType = req.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const action = String(form.get('action') || '');

      if (action !== 'upload') {
        if (action === 'care_demo_event') {
      const eventType = String(payload?.event_type || '').trim().toUpperCase();
      const deviceState = String(payload?.device_state || '').trim().toUpperCase();
      const battery = Number(payload?.battery);
      const lat = Number(payload?.lat);
      const lng = Number(payload?.lng);

      const allowedEvents = new Set(['MOVE', 'SOS', 'LOW_BATTERY', 'OFFLINE', 'ONLINE', 'RESET']);
      const allowedStates = new Set(['ONLINE', 'OFFLINE', 'SOS']);

      if (
        !allowedEvents.has(eventType) ||
        !allowedStates.has(deviceState) ||
        !Number.isInteger(battery) ||
        battery < 0 ||
        battery > 100 ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return json({ ok: false, code: 'INVALID_DEMO_EVENT' }, 200, origin);
      }

      const { data: limitData, error: limitError } = await admin.rpc('consume_care_tracker_demo_rate_limit');
      if (limitError || limitData !== true) {
        return json({ ok: false, code: 'RATE_LIMITED' }, 200, origin);
      }

      const noteByEvent: Record<string, string> = {
        MOVE: 'Simulated movement',
        SOS: 'Simulated SOS',
        LOW_BATTERY: 'Simulated low battery',
        OFFLINE: 'Simulated offline',
        ONLINE: 'Simulated online',
        RESET: 'Demo reset',
      };

      const { data, error } = await admin
        .from('care_tracker_demo_events')
        .insert({
          device_id: 'DEMO-TRACKER-001',
          event_type: eventType,
          device_state: deviceState,
          battery,
          lat,
          lng,
          note: noteByEvent[eventType] ?? 'Demo event',
        })
        .select('id,device_id,event_type,device_state,battery,lat,lng,created_at')
        .single();

      if (error) {
        return json({ ok: false, code: 'DEMO_EVENT_SAVE_FAILED' }, 200, origin);
      }

      return json({ ok: true, result: data }, 200, origin);
    }

    return json({ ok: false, code: 'UNKNOWN_ACTION' }, 400, origin);
      }

      const file = form.get('file');
      if (!(file instanceof File)) {
        return json({ ok: false, code: 'FILE_REQUIRED' }, 200, origin);
      }

      const allowedTypes = new Map([
        ['image/jpeg', 'jpg'],
        ['image/png', 'png'],
        ['image/webp', 'webp'],
      ]);

      const extension = allowedTypes.get(file.type);
      if (!extension) {
        return json({ ok: false, code: 'INVALID_FILE_TYPE' }, 200, origin);
      }

      if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
        return json({ ok: false, code: 'FILE_TOO_LARGE' }, 200, origin);
      }

      const { data: limitData, error: limitError } = await admin.rpc('consume_public_upload_rate_limit');
      if (limitError || limitData !== true) {
        return json({ ok: false, code: 'RATE_LIMITED' }, 200, origin);
      }

      const path = `public-submissions/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await admin.storage
        .from('incident-attachments')
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadError) {
        return json({ ok: false, code: 'UPLOAD_FAILED' }, 200, origin);
      }

      return json({ ok: true, result: { path } }, 200, origin);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, code: 'INVALID_JSON' }, 400, origin);
    }

    const action = String(body?.action || '');
    const payload = body?.payload ?? {};

    if (action === 'submit') {
      if (typeof payload !== 'object' || !payload) {
        return json({ ok: false, code: 'INVALID_PAYLOAD' }, 400, origin);
      }

      const { data, error } = await admin.rpc('submit_incident', {
        p_category: payload.category,
        p_title: payload.title,
        p_description: payload.description,
        p_village: payload.village,
        p_house_number: payload.house_number ?? null,
        p_reporter_name: payload.reporter_name ?? null,
        p_reporter_phone: payload.reporter_phone ?? null,
        p_urgency: payload.urgency,
        p_photo_path: payload.photo_path ?? null,
        p_lat: payload.lat,
        p_lng: payload.lng,
        p_accuracy_m: null,
        p_location_confirmed: payload.location_confirmed === true,
      });

      if (error) {
        const message = error.message || '';
        const code =
          message.includes('RATE_LIMITED') ? 'RATE_LIMITED' :
          message.includes('OUTSIDE_BOLUANG') ? 'OUTSIDE_BOLUANG' :
          message.includes('location not confirmed') ? 'LOCATION_NOT_CONFIRMED' :
          message.includes('invalid village') ? 'INVALID_VILLAGE' :
          'SUBMIT_FAILED';
        return json({ ok: false, code }, 200, origin);
      }

      const result = Array.isArray(data) ? data[0] : data;
      return json({ ok: true, result }, 200, origin);
    }

    if (action === 'track') {
      const trackingNo = String(payload?.tracking_no || '').trim();
      const phoneLast4 = String(payload?.phone_last4 || '').trim();

      if (!trackingNo) {
        return json({ ok: false, code: 'INVALID_TRACKING' }, 200, origin);
      }

      const { data, error } = await admin.rpc('track_incident', {
        p_tracking_no: trackingNo,
        p_phone_last4: phoneLast4,
      });

      if (error) {
        const code = (error.message || '').includes('RATE_LIMITED')
          ? 'RATE_LIMITED'
          : 'TRACK_FAILED';
        return json({ ok: false, code }, 200, origin);
      }

      const result = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
      return json({ ok: true, result }, 200, origin);
    }

    return json({ ok: false, code: 'UNKNOWN_ACTION' }, 400, origin);
  } catch {
    return json({ ok: false, code: 'SERVER_ERROR' }, 500, origin);
  }
});
