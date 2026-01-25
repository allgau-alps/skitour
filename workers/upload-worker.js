/**
 * Cloudflare Worker for Avalanche Archiver Uploads
 * 
 * Setup:
 * 1. Create a KV Namespace and bind it as 'UPLOADS'
 * 2. (Optional) set an ADMIN_Key in secrets if you want to protect deletions
 * 
 * API:
 * - POST /upload: JSON body { user, location, comment, lat, lon, image (base64) }
 * - GET /list: Returns all uploads
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // LIST UPLOADS
        if (request.method === "GET" && url.pathname === "/list") {
            try {
                const list = await env.UPLOADS.list();
                const uploads = [];
                for (const key of list.keys) {
                    const val = await env.UPLOADS.get(key.name, { type: "json" });
                    if (val) uploads.push(val);
                }
                return new Response(JSON.stringify(uploads), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // GET SINGLE UPLOAD
        if (request.method === "GET" && url.pathname === "/get") {
            const id = url.searchParams.get('id');
            if (!id) return new Response("Missing ID", { status: 400, headers: corsHeaders });

            try {
                const val = await env.UPLOADS.get(id, { type: "json" });
                if (!val) return new Response("Not Found", { status: 404, headers: corsHeaders });

                return new Response(JSON.stringify(val), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        if (request.method === "POST" && url.pathname === "/delete") {
            try {
                const data = await request.json();
                if (!data.id) {
                    return new Response("Missing ID", { status: 400, headers: corsHeaders });
                }

                await env.UPLOADS.delete(data.id);
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // HANDLE UPLOAD
        if (request.method === "POST" && url.pathname === "/upload") {
            try {
                const data = await request.json();

                // Basic Validation
                if (!data.image && !data.comment && (!data.images || data.images.length === 0)) {
                    return new Response("Missing content", { status: 400, headers: corsHeaders });
                }

                // Use existing ID if provided (for edits), otherwise generate new
                const id = data.id || Date.now().toString();

                const uploadRecord = {
                    id: id,
                    date: data.date || new Date().toISOString(),
                    user: data.user || "Anonymous",
                    location: data.location || "Unknown",
                    comment: data.comment || "",
                    lat: data.lat || null,
                    lon: data.lon || null,
                    elevation: data.elevation || null,
                    aspect: data.aspect || null,
                    type: data.type || 'generic',
                    images: data.images || (data.image ? [data.image] : []), // Array of Base64 strings
                    layers: data.layers || [], // Store raw snow profile layers
                    tests: data.tests || [], // Store stability tests
                    approved: true // Auto-approve for now, change logic if needed
                };

                // Store in KV
                // CRITICAL: Do NOT set an expirationTtl here.
                // Retention is handled by the build script (Application Layer). 
                // We must keep raw data PERMANENTLY because some items are linked to Incidents and must never expire.
                await env.UPLOADS.put(id, JSON.stringify(uploadRecord));

                return new Response(JSON.stringify({ success: true, id: id }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });

            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // GUIDE FOR GPX LIBRARY:
        // We use a "Metadata Index" strategy. 
        // 1. 'gpx:index' -> Stores the lightweight JSON array of all route metadata.
        // 2. 'gpx:file:<id>' -> Stores the heavy GPX XML content.
        // This avoids listing thousands of keys or fetching heavy files just to show the library.

        // GET GPX LIST (Library Index)
        if (request.method === "GET" && url.pathname === "/gpx/list") {
            try {
                const index = await env.UPLOADS.get('gpx:index', { type: "json" });
                return new Response(JSON.stringify({ routes: index || [] }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // GET GPX FILE
        if (request.method === "GET" && url.pathname === "/gpx/get") {
            const id = url.searchParams.get('id');
            if (!id) return new Response("Missing ID", { status: 400, headers: corsHeaders });

            try {
                // Try fetching gpx specific key first
                let content = await env.UPLOADS.get(`gpx:file:${id}`);
                // Fallback for legacy or different storage if needed
                if (!content) return new Response("GPX file not found", { status: 404, headers: corsHeaders });

                return new Response(content, {
                    headers: { ...corsHeaders, "Content-Type": "application/gpx+xml" }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // UPLOAD GPX (Update Index + Store File)
        if (request.method === "POST" && url.pathname === "/gpx/upload") {
            try {
                const data = await request.json();

                // Expecting: { gpxContent: "...", metadata: { id, name, ... } }
                if (!data.gpxContent || !data.metadata || !data.metadata.id) {
                    return new Response("Missing GPX content or metadata", { status: 400, headers: corsHeaders });
                }

                const id = data.metadata.id;

                // 1. Store the File
                await env.UPLOADS.put(`gpx:file:${id}`, data.gpxContent);

                // 2. Update the Index
                let index = await env.UPLOADS.get('gpx:index', { type: "json" }) || [];

                // Remove existing entry if updating
                index = index.filter(r => r.id !== id);
                // Add new metadata
                index.push(data.metadata);

                // Sort by name by default to keep index tidy
                index.sort((a, b) => a.name.localeCompare(b.name));

                await env.UPLOADS.put('gpx:index', JSON.stringify(index));

                return new Response(JSON.stringify({ success: true, id: id }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });

            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // DELETE GPX
        if (request.method === "POST" && url.pathname === "/gpx/delete") {
            try {
                const data = await request.json();
                if (!data.id) return new Response("Missing ID", { status: 400, headers: corsHeaders });

                const id = data.id;

                // 1. Delete the File
                await env.UPLOADS.delete(`gpx:file:${id}`);

                // 2. Update the Index
                let index = await env.UPLOADS.get('gpx:index', { type: "json" }) || [];
                const newIndex = index.filter(r => r.id !== id);

                await env.UPLOADS.put('gpx:index', JSON.stringify(newIndex));

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });

            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    },
};
