/**
 * Cloudflare Worker for Avalanche Archiver Uploads
 *
 * Setup:
 * 1. Create a KV Namespace and bind it as 'UPLOADS'
 * 2. Set ADMIN_KEY secret in Cloudflare dashboard for delete/GPX delete protection
 *
 * API:
 * - POST /upload: JSON body { user, location, comment, lat, lon, image (base64) }
 * - GET /list: Returns all uploads
 * - POST /delete: Requires X-Admin-Key header matching secret
 * - GPX endpoints: /gpx/list, /gpx/get, /gpx/upload, /gpx/delete (protected)
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // Admin authentication check for protected endpoints
        function isAdmin(request) {
            const adminKey = request.headers.get('X-Admin-Key');
            const expectedKey = env.ADMIN_KEY;
            return expectedKey && adminKey === expectedKey;
        }

        // LIST UPLOADS
        if (request.method === "GET" && url.pathname === "/list") {
            try {
                const list = await env.UPLOADS.list();
                const uploads = [];
                const badKeys = [];

                for (const key of list.keys) {
                    try {
                        const val = await env.UPLOADS.get(key.name, { type: "json" });
                        if (val) uploads.push(val);
                    } catch (e) {
                        // Skip malformed JSON entries but log for cleanup
                        console.error(`Skipping malformed KV key: ${key.name}`, e.message);
                        badKeys.push(key.name);
                    }
                }

                // Optionally log summary for debugging
                if (badKeys.length > 0) {
                    console.warn(`Filtered ${badKeys.length} malformed entries from /list`);
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
                // If stored value is corrupted, treat as not found rather than 500
                console.error(`Failed to parse upload ${id}:`, e.message);
                return new Response("Not Found", { status: 404, headers: corsHeaders });
            }
        }

        // DELETE UPLOAD (protected)
        if (request.method === "POST" && url.pathname === "/delete") {
            if (!isAdmin(request)) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
            }

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
                    last_modified: new Date().toISOString(), // Track modifications
                    user: data.user || "Anonymous",
                    location: data.location || "Unknown",
                    comment: data.comment || "",
                    lat: data.lat || null,
                    lon: data.lon || null,
                    elevation: data.elevation || null,
                    aspect: data.aspect || null,
                    type: data.type || 'generic',
                    images: data.images || (data.image ? [data.image] : []),
                    layers: data.layers || [],
                    tests: data.tests || [],
                    approved: true
                };

                await env.UPLOADS.put(id, JSON.stringify(uploadRecord));

                return new Response(JSON.stringify({ success: true, id: id }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });

            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // GPX LIBRARY endpoints (protected by admin key for modifications)

        // GET GPX LIST
        if (request.method === "GET" && url.pathname === "/gpx/list") {
            try {
                const index = await env.UPLOADS.get('gpx:index', { type: "json" });
                return new Response(JSON.stringify({ routes: index || [] }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (e) {
                // If gpx:index is corrupted, return empty list and log
                console.error('Failed to parse gpx:index:', e.message);
                return new Response(JSON.stringify({ routes: [] }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        // GET GPX FILE
        if (request.method === "GET" && url.pathname === "/gpx/get") {
            const id = url.searchParams.get('id');
            if (!id) return new Response("Missing ID", { status: 400, headers: corsHeaders });

            try {
                let content = await env.UPLOADS.get(`gpx:file:${id}`);
                if (!content) return new Response("GPX file not found", { status: 404, headers: corsHeaders });

                return new Response(content, {
                    headers: { ...corsHeaders, "Content-Type": "application/gpx+xml" }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // UPLOAD GPX (protected)
        if (request.method === "POST" && url.pathname === "/gpx/upload") {
            if (!isAdmin(request)) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
            }

            try {
                const data = await request.json();

                if (!data.gpxContent || !data.metadata || !data.metadata.id) {
                    return new Response("Missing GPX content or metadata", { status: 400, headers: corsHeaders });
                }

                const id = data.metadata.id;

                // Store the file
                await env.UPLOADS.put(`gpx:file:${id}`, data.gpxContent);

                // Update the index
                let index = await env.UPLOADS.get('gpx:index', { type: "json" }) || [];

                // Remove existing entry if updating
                index = index.filter(r => r.id !== id);
                // Add new metadata
                index.push(data.metadata);

                // Sort by name
                index.sort((a, b) => a.name.localeCompare(b.name));

                await env.UPLOADS.put('gpx:index', JSON.stringify(index));

                return new Response(JSON.stringify({ success: true, id: id }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });

            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
            }
        }

        // DELETE GPX (protected)
        if (request.method === "POST" && url.pathname === "/gpx/delete") {
            if (!isAdmin(request)) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
            }

            try {
                const data = await request.json();
                if (!data.id) return new Response("Missing ID", { status: 400, headers: corsHeaders });

                const id = data.id;

                // Delete the file
                await env.UPLOADS.delete(`gpx:file:${id}`);

                // Update the index
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
