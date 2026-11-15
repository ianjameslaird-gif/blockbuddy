var demo = new URLSearchParams(location.search).get("demo") === "1";
window.BBAuthQueue = window.BBAuthQueue || [];

function ready() {
  window.BBClientReady = true;
  window.dispatchEvent(new Event("bb-client"));
}

if (demo) {
  ready();
} else {
  import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm")
    .then(function (mod) {
      var client = mod.createClient(window.BBConfig.url, window.BBConfig.key, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true
        }
      });
      window.BBClient = client;
      client.auth.onAuthStateChange(function (event, session) {
        if (window.BBAuthHandler) window.BBAuthHandler(event, session);
        else window.BBAuthQueue.push({ event: event, session: session });
      });
      ready();
    })
    .catch(function () {
      window.BBClientError = true;
      ready();
    });
}
