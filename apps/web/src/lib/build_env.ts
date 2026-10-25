// Checked by vite.config.ts when building for production (e.g. on Vercel), so a missing API URL
// fails the build instead of shipping an app that can't load anything.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Returns the problem with VITE_API_BASE_URL for a production build, or null when it is fine. */
export function find_api_base_url_problem(value: string | undefined): string | null {
  if (!value?.trim()) {
    return "VITE_API_BASE_URL is not set. Production builds need the API URL, e.g. https://<your-api>/api/v1.";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "VITE_API_BASE_URL is not a valid URL. Use e.g. https://<your-api>/api/v1.";
  }
  // An https page can't call an http API (mixed content); only a local build may use http.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
    return "VITE_API_BASE_URL must use https:// in production builds.";
  }
  return null;
}
