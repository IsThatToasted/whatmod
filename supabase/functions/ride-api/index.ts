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

      return json({
        ride_id: ride.id,
        title: ride.title,
        started_at: ride.started_at,
        livekit_url: env("LIVEKIT_URL"),
        viewer_token: viewerToken,
      });
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
          heading: body.heading ?? 0,
          altitude_ft: body.altitude_ft ?? 0,
          horizontal_accuracy_m: body.horizontal_accuracy_m,
          distance_miles: body.distance_miles ?? 0,
          phone_battery: body.phone_battery,
          elapsed_seconds: body.elapsed_seconds ?? 0,
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
        supported_actions: ["health", "create", "list-live", "viewer-token", "telemetry", "end"],
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
