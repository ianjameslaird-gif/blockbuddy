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
    siteUrl: siteUrl,
    communities: [
      { name: "SkyPeak @ Bukit Batok", slug: "skypeak-bukit-batok", residentLabel: "SkyPeak @ Bukit Batok resident" },
      { name: "Golden Daisy", slug: "golden-daisy", residentLabel: "Golden Daisy resident" },
      { name: "Skyline II @ Bukit Batok", slug: "skyline-ii-bukit-batok", residentLabel: "Skyline II @ Bukit Batok resident" },
      { name: "Skyline I @ Bukit Batok", slug: "skyline-i-bukit-batok", residentLabel: "Skyline I @ Bukit Batok resident" },
      { name: "Sky Vista @ Bukit Batok", slug: "sky-vista-bukit-batok", residentLabel: "Sky Vista @ Bukit Batok resident" },
      { name: "West Terra @ Bukit Batok", slug: "west-terra-bukit-batok", residentLabel: "West Terra @ Bukit Batok resident" }
    ]
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
