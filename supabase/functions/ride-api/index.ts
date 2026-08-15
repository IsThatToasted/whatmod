import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.17.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rider-key, x-viewer-base",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function randomSlug(bytes = 18): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function riderAuthorized(req: Request): boolean {
  const expected = Deno.env.get("RIDER_ADMIN_KEY");
  const supplied = req.headers.get("x-rider-key");
  return Boolean(expected && supplied && supplied === expected);
}

async function createLiveKitToken(opts: {
  identity: string;
  room: string;
  canPublish: boolean;
  canSubscribe: boolean;
}) {
  const token = new AccessToken(
    env("LIVEKIT_API_KEY"),
    env("LIVEKIT_API_SECRET"),
    {
      identity: opts.identity,
      ttl: "8h",
    },
  );

  token.addGrant({
    roomJoin: true,
    room: opts.room,
    canPublish: opts.canPublish,
    canPublishData: opts.canPublish,
    canSubscribe: opts.canSubscribe,
  });

  return await token.toJwt();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";

    // Fast health check for setup verification.
    if (action === "health" || (req.method === "GET" && action === "")) {
      return json({
        ok: true,
        service: "ScooterCast ride-api",
        livekit_configured: Boolean(
          Deno.env.get("LIVEKIT_URL") &&
          Deno.env.get("LIVEKIT_API_KEY") &&
          Deno.env.get("LIVEKIT_API_SECRET")
        ),
        rider_key_configured: Boolean(Deno.env.get("RIDER_ADMIN_KEY")),
        timestamp: new Date().toISOString(),
      });
    }

    const supabase = createClient(
      env("SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    if (action === "create" && req.method === "POST") {
      if (!riderAuthorized(req)) {
        return json({ error: "Unauthorized rider" }, 401);
      }

      const body = await req.json().catch(() => ({}));
      const title = String(body?.title || "Scooter Ride").slice(0, 100);
      const shareSlug = randomSlug();
      const roomName = `ride_${crypto.randomUUID()}`;

      const { data: ride, error } = await supabase
        .from("rides")
        .insert({
          title,
          share_slug: shareSlug,
          room_name: roomName,
          status: "live",
          is_discoverable: Boolean(body?.is_discoverable),
        })
        .select("id, share_slug, room_name")
        .single();

      if (error) throw error;

      const riderToken = await createLiveKitToken({
        identity: `rider_${ride.id}`,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });

      const viewerBase =
        req.headers.get("x-viewer-base") || "https://whatmod.com/ride/";

      const separator = viewerBase.includes("?") ? "&" : "?";
      const viewerURL =
        `${viewerBase}${separator}ride=${encodeURIComponent(shareSlug)}`;

      return json({
        id: ride.id,
        share_slug: ride.share_slug,
        room_name: ride.room_name,
        livekit_url: env("LIVEKIT_URL"),
        rider_token: riderToken,
        viewer_url: viewerURL,
      });
    }

    if (action === "list-live" && req.method === "GET") {
      const { data: rides, error } = await supabase
        .from("rides")
        .select("id, title, share_slug, started_at")
        .eq("status", "live")
        .eq("is_discoverable", true)
        .gt("expires_at", new Date().toISOString())
        .order("started_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const results = await Promise.all(
        (rides ?? []).map(async (ride) => {
          const { data: telemetry } = await supabase
            .from("ride_telemetry")
            .select("speed_mph, distance_miles, elapsed_seconds, phone_battery, captured_at")
            .eq("ride_id", ride.id)
            .order("captured_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: ride.id,
            title: ride.title,
            share_slug: ride.share_slug,
            started_at: ride.started_at,
            telemetry: telemetry ?? null,
          };
        }),
      );

      return json({
        rides: results,
        count: results.length,
      });
    }

    if (action === "viewer-token" && req.method === "GET") {
      const slug = url.searchParams.get("ride");

      if (!slug || slug.length < 12) {
        return json({ error: "Invalid ride link" }, 400);
      }

      const { data: ride, error } = await supabase
        .from("rides")
        .select("id, title, share_slug, room_name, status, expires_at, started_at")
        .eq("share_slug", slug)
        .eq("status", "live")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      if (!ride) {
        return json({ error: "Ride is offline or link expired" }, 404);
      }

      const viewerToken = await createLiveKitToken({
        identity: `viewer_${crypto.randomUUID()}`,
        room: ride.room_name,
        canPublish: false,
        canSubscribe: true,
      });

      const { data: viewerSession, error: viewerSessionError } = await supabase
        .from("viewer_sessions")
        .insert({
          ride_id: ride.id,
          user_agent: req.headers.get("user-agent"),
        })
        .select("id")
        .single();

      if (viewerSessionError) throw viewerSessionError;

      return json({
        ride_id: ride.id,
        title: ride.title,
        started_at: ride.started_at,
        livekit_url: env("LIVEKIT_URL"),
        viewer_token: viewerToken,
        viewer_session_id: viewerSession.id,
      });
    }

    if (action === "viewer-heartbeat" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const sessionID = String(body?.viewer_session_id || "");

      if (!sessionID) {
        return json({ error: "Missing viewer_session_id" }, 400);
      }

      const { error } = await supabase
        .from("viewer_sessions")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", sessionID);

      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "usage-summary" && req.method === "GET") {
      const now = new Date();
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
      );

      const monthStartISO = monthStart.toISOString();
      const nowISO = now.toISOString();

      const { data: rides, error: ridesError } = await supabase
        .from("rides")
        .select("id, started_at, ended_at, status")
        .gte("started_at", monthStartISO)
        .lte("started_at", nowISO);

      if (ridesError) throw ridesError;

      const { data: sessions, error: sessionsError } = await supabase
        .from("viewer_sessions")
        .select("id, ride_id, first_seen, last_seen")
        .gte("first_seen", monthStartISO)
        .lte("first_seen", nowISO);

      if (sessionsError) throw sessionsError;

      let riderSeconds = 0;

      for (const ride of rides ?? []) {
        const start = new Date(ride.started_at).getTime();
        const end = ride.ended_at
          ? new Date(ride.ended_at).getTime()
          : now.getTime();

        riderSeconds += Math.max(0, Math.min(end, now.getTime()) - start) / 1000;
      }

      let viewerSeconds = 0;

      for (const session of sessions ?? []) {
        const start = new Date(session.first_seen).getTime();
        const last = new Date(session.last_seen).getTime();

        // Give the last heartbeat one additional 35-second window.
        const estimatedEnd = Math.min(now.getTime(), last + 35_000);
        viewerSeconds += Math.max(0, estimatedEnd - start) / 1000;
      }

      const activeRides = (rides ?? []).filter((r) => r.status === "live").length;

      const activeViewerCutoff = now.getTime() - 75_000;
      const activeViewers = (sessions ?? []).filter(
        (s) => new Date(s.last_seen).getTime() >= activeViewerCutoff
      ).length;

      return json({
        period_start: monthStartISO,
        as_of: nowISO,
        rides_started: (rides ?? []).length,
        viewer_sessions: (sessions ?? []).length,
        active_rides: activeRides,
        active_viewers: activeViewers,
        rider_minutes: riderSeconds / 60,
        viewer_minutes: viewerSeconds / 60,
        participant_minutes: (riderSeconds + viewerSeconds) / 60,
      });
    }


    if (action === "list-replays" && req.method === "GET") {
      const { data: rides, error } = await supabase
        .from("rides")
        .select("id, title, share_slug, started_at, ended_at, status")
        .eq("status", "ended")
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const results = await Promise.all(
        (rides ?? []).map(async (ride) => {
          const { data: telemetry } = await supabase
            .from("ride_telemetry")
            .select("speed_mph, average_speed_mph, max_speed_mph, distance_miles, elapsed_seconds, moving_seconds, phone_battery, captured_at")
            .eq("ride_id", ride.id)
            .order("captured_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: eventCount } = await supabase
            .from("ride_events")
            .select("id", { count: "exact", head: true })
            .eq("ride_id", ride.id);

          return {
            id: ride.id,
            title: ride.title,
            share_slug: ride.share_slug,
            started_at: ride.started_at,
            ended_at: ride.ended_at,
            telemetry: telemetry ?? null,
            event_count: eventCount ?? 0,
          };
        }),
      );

      return json({
        rides: results,
        count: results.length,
      });
    }

    if (action === "replay" && req.method === "GET") {
      const slug = url.searchParams.get("ride");

      if (!slug || slug.length < 12) {
        return json({ error: "Invalid ride link" }, 400);
      }

      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .select("id, title, share_slug, started_at, ended_at, status")
        .eq("share_slug", slug)
        .maybeSingle();

      if (rideError) throw rideError;
      if (!ride) return json({ error: "Ride not found" }, 404);

      const { data: telemetry, error: telemetryError } = await supabase
        .from("ride_telemetry")
        .select("latitude, longitude, speed_mph, average_speed_mph, max_speed_mph, heading, altitude_ft, horizontal_accuracy_m, speed_accuracy_mps, course_accuracy_degrees, gps_quality, distance_miles, phone_battery, elapsed_seconds, moving_seconds, captured_at")
        .eq("ride_id", ride.id)
        .order("captured_at", { ascending: true });

      if (telemetryError) throw telemetryError;

      const { data: events, error: eventsError } = await supabase
        .from("ride_events")
        .select("id, event_type, emoji, label, created_at")
        .eq("ride_id", ride.id)
        .order("created_at", { ascending: true });

      if (eventsError) throw eventsError;

      return json({
        ride,
        telemetry: telemetry ?? [],
        events: events ?? [],
      });
    }

    if (action === "send-event" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const slug = String(body?.ride || "");
      const eventType = body?.event_type === "moment" ? "moment" : "reaction";
      const emoji = body?.emoji ? String(body.emoji).slice(0, 16) : null;
      const label = body?.label ? String(body.label).slice(0, 80) : null;

      if (!slug) return json({ error: "Missing ride" }, 400);

      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .select("id")
        .eq("share_slug", slug)
        .eq("status", "live")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (rideError) throw rideError;
      if (!ride) return json({ error: "Ride is offline" }, 404);

      const { data: event, error } = await supabase
        .from("ride_events")
        .insert({
          ride_id: ride.id,
          event_type: eventType,
          emoji,
          label,
        })
        .select("id, event_type, emoji, label, created_at")
        .single();

      if (error) throw error;
      return json({ ok: true, event });
    }

    if (action === "rider-events" && req.method === "GET") {
      if (!riderAuthorized(req)) {
        return json({ error: "Unauthorized rider" }, 401);
      }

      const rideID = url.searchParams.get("ride_id");
      const after = url.searchParams.get("after");

      if (!rideID) return json({ error: "Missing ride_id" }, 400);

      let query = supabase
        .from("ride_events")
        .select("id, event_type, emoji, label, created_at")
        .eq("ride_id", rideID)
        .order("created_at", { ascending: true })
        .limit(20);

      if (after) query = query.gt("created_at", after);

      const { data, error } = await query;
      if (error) throw error;

      return json({ events: data ?? [] });
    }

    if (action === "telemetry" && req.method === "POST") {
      if (!riderAuthorized(req)) {
        return json({ error: "Unauthorized rider" }, 401);
      }

      const body = await req.json();

      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .select("id")
        .eq("id", body.ride_id)
        .eq("status", "live")
        .maybeSingle();

      if (rideError) throw rideError;
      if (!ride) {
        return json({ error: "Ride is not active" }, 409);
      }

      const { error } = await supabase
        .from("ride_telemetry")
        .insert({
          ride_id: body.ride_id,
          latitude: body.latitude,
          longitude: body.longitude,
          speed_mph: body.speed_mph ?? 0,
          average_speed_mph: body.average_speed_mph ?? 0,
          max_speed_mph: body.max_speed_mph ?? 0,
          heading: body.heading ?? 0,
          altitude_ft: body.altitude_ft ?? 0,
          horizontal_accuracy_m: body.horizontal_accuracy_m,
          speed_accuracy_mps: body.speed_accuracy_mps,
          course_accuracy_degrees: body.course_accuracy_degrees,
          gps_quality: body.gps_quality,
          distance_miles: body.distance_miles ?? 0,
          phone_battery: body.phone_battery,
          elapsed_seconds: body.elapsed_seconds ?? 0,
          moving_seconds: body.moving_seconds ?? 0,
          captured_at: body.captured_at ?? new Date().toISOString(),
        });

      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "end" && req.method === "POST") {
      if (!riderAuthorized(req)) {
        return json({ error: "Unauthorized rider" }, 401);
      }

      const body = await req.json();

      const { error } = await supabase
        .from("rides")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", body.ride_id);

      if (error) throw error;

      return json({ ok: true });
    }

    return json(
      {
        error: "Unknown action",
        supported_actions: ["health", "create", "list-live", "list-replays", "replay", "viewer-token", "viewer-heartbeat", "usage-summary", "send-event", "rider-events", "telemetry", "end"],
      },
      404,
    );
  } catch (error) {
    console.error(error);
    return json(
      {
        error: error instanceof Error ? error.message : "Server error",
      },
      500,
    );
  }
});
