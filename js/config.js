(function (root) {
  "use strict";

  var params = new URLSearchParams(root.location.search);

  function siteUrl() {
    var url = new URL(root.location.href);
    var path = url.pathname;
    if (path.endsWith("/index.html")) path = path.slice(0, -"/index.html".length);
    if (!path.endsWith("/")) path += "/";
    return url.origin + path;
  }

  root.BBDemo = params.get("demo") === "1";
  root.BBConfig = {
    url: "https://kilwaieocbvikzxqyavk.supabase.co",
    key: "sb_publishable_NySaXzCXd_MZX0J90omlEQ_Q7AShzAQ",
    siteUrl: siteUrl
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
