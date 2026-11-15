(function () {
  "use strict";

  var CATEGORIES = [
    ["furniture", "Furniture"],
    ["kitchen", "Kitchen"],
    ["kids", "Kids & baby"],
    ["electronics", "Electronics"],
    ["sports", "Sports"],
    ["plants", "Plants"],
    ["books", "Books & study"],
    ["home", "Home"],
    ["games", "Games"],
    ["other", "Other"]
  ];
  var ART_FOR = {
    furniture: "shelf",
    kitchen: "rice",
    kids: "bicycle",
    electronics: "vacuum",
    sports: "rackets",
    plants: "plants",
    books: "books",
    home: "boxes",
    games: "games",
    other: "other"
  };
  var CONDITIONS = ["Like new", "Good", "Fair", "Well loved"];
  var TYPES = [
    ["sell", "Sell"],
    ["wanted", "Wanted"],
    ["giveaway", "Give away"],
    ["trade", "Trade"]
  ];
  var STATUS_ORDER = ["submitted", "under_review", "verified", "action_needed", "none"];
  var REPORT_REASONS = [
    "Scam or suspicious payment",
    "Prohibited or unsafe item",
    "Harassment",
    "Spam",
    "Privacy concern",
    "Something else"
  ];

  var ui = {
    menu: false,
    filters: false,
    reviewer: false,
    reviewerNote: "",
    confirm: null,
    report: null,
    toast: "",
    announceToast: false,
    uploadError: false,
    uploadErrorMessage: "",
    uploading: false,
    uploadToken: 0,
    failNext: false,
    feedError: false,
    loading: null,
    focusH1: false,
    focusError: false,
    focusMenu: false,
    focusChat: false,
    returnFocus: "",
    fieldErrors: {},
    formValues: {},
    photo: "",
    skipSnapshot: false,
    routeKey: null,
    pendingDoc: null
  };

  var docSession = blankDoc();
  var seen = { feed: false, search: false, messages: false };
  var loadToken = 0;
  var toastTimer = 0;

  function blankDoc() {
    return { userId: null, dataUrl: "", name: "", rects: [] };
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function categoryLabel(key) {
    var found = CATEGORIES.filter(function (row) { return row[0] === key; })[0];
    return found ? found[1] : "Other";
  }

  function safeCat(key) {
    return CATEGORIES.some(function (row) { return row[0] === key; }) ? key : "other";
  }

  function typeLabel(type) {
    return { sell: "For sale", wanted: "Wanted", giveaway: "Give away", trade: "Trade" }[type] || "Listing";
  }

  function statusLabel(status) {
    return {
      none: "Not submitted",
      submitted: "Submitted",
      under_review: "Under Review",
      verified: "Verified",
      action_needed: "Action Needed"
    }[status] || "Not submitted";
  }

  function money(value) {
    var num = Number(value);
    if (!Number.isFinite(num)) return "";
    var cents = Math.round(num * 100) % 100 !== 0;
    return "S$" + num.toLocaleString("en-SG", {
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  function priceLabel(listing) {
    var price = BBStore.listingPrice(listing);
    if (listing.type === "giveaway" || price === 0) return "Free";
    if (listing.type === "trade") return price ? "Trade · " + money(price) : "Trade";
    if (listing.type === "wanted") return price ? "Up to " + money(price) : "Wanted";
    return money(price);
  }

  function timeAgo(ts) {
    var min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return min + " min ago";
    var hr = Math.round(min / 60);
    if (hr < 24) return hr === 1 ? "1 hr ago" : hr + " hr ago";
    var day = Math.round(hr / 24);
    if (day === 1) return "Yesterday";
    if (day < 14) return day + " days ago";
    return new Date(ts).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
  }

  function memberSince(ts) {
    return new Date(ts).toLocaleDateString("en-SG", { month: "long", year: "numeric" });
  }

  function safeImg(url) {
    if (typeof url !== "string" || !url) return "";
    var data = url.indexOf("data:image/jpeg") === 0 || url.indexOf("data:image/png") === 0 || url.indexOf("data:image/webp") === 0 || url.indexOf("data:image/gif") === 0;
    if (data) {
      if (/[<>"'\s]/.test(url)) return "";
      return url;
    }
    try {
      var parsed = new URL(url);
      if (parsed.protocol !== "https:") return "";
      if (parsed.host !== "kilwaieocbvikzxqyavk.supabase.co") return "";
      if (parsed.pathname.indexOf("/storage/v1/object/sign/") !== 0) return "";
      return parsed.href;
    } catch (err) {
      return "";
    }
  }

  function avatar(name, large) {
    var label = String(name || "?");
    var initial = (label.trim().charAt(0) || "?").toUpperCase();
    var n = 0;
    for (var i = 0; i < label.length; i += 1) n = (n + label.charCodeAt(i)) % 6;
    return '<span class="avatar av-' + n + (large ? " avatar-lg" : "") + '" aria-hidden="true">' + esc(initial) + "</span>";
  }

  function parseRoute() {
    var raw = (location.hash || "#/").replace(/^#/, "");
    if (!raw) raw = "/";
    var bits = raw.split("?");
    var path = bits[0].charAt(0) === "/" ? bits[0] : "/" + bits[0];
    var parts = path.split("/").filter(Boolean);
    var params = new URLSearchParams(bits[1] || "");
    var name = "notfound";
    var id = null;
    if (!parts.length) name = "home";
    else if (parts[0] === "register") name = "register";
    else if (parts[0] === "verify") name = "verify";
    else if (parts[0] === "feed") name = "feed";
    else if (parts[0] === "search") name = "search";
    else if (parts[0] === "listing" && parts[1] === "new") name = "edit";
    else if (parts[0] === "listing" && parts[2] === "edit") { name = "edit"; id = parts[1]; }
    else if (parts[0] === "listing" && parts[1]) { name = "listing"; id = parts[1]; }
    else if (parts[0] === "messages" && parts[1]) { name = "thread"; id = parts[1]; }
    else if (parts[0] === "messages") name = "messages";
    else if (parts[0] === "profile") name = "profile";
    else if (parts[0] === "member" && parts[1]) { name = "member"; id = parts[1]; }
    else if (parts[0] === "help") name = "help";
    else if (parts[0] === "forgot") name = "forgot";
    else if (parts[0] === "update-password") name = "update-password";
    else if (parts[0] === "admin") name = "admin";
    return { name: name, id: id, params: params };
  }

  function desktopFilters() {
    return window.matchMedia("(min-width: 1040px)").matches;
  }

  function desktopInbox() {
    return window.matchMedia("(min-width: 800px)").matches;
  }

  function verified(user) {
    return !!(user && user.verification && user.verification.status === "verified");
  }

  function localPreview() {
    var host = location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return "";
    return new URLSearchParams(location.search).get("preview") || "";
  }

  function previewUser() {
    return {
      id: "preview",
      preferredName: "Preview Neighbour",
      email: "preview@example.com",
      bio: "",
      communityId: "preview",
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      isAdmin: localPreview() === "admin",
      verification: {
        status: "none",
        updatedAt: Date.now(),
        submittedAt: null,
        verifiedAt: null,
        fileName: "",
        previewDataUrl: "",
        draftDataUrl: "",
        draftName: "",
        actionReason: "",
        events: []
      }
    };
  }

  function activeUser() {
    var user = BBStore.sessionUser();
    if (user) return user;
    var preview = localPreview();
    if (preview === "verify" || preview === "admin") return previewUser();
    return null;
  }

  function settle(value) {
    return Promise.resolve(value);
  }

  function announce(text) {
    var live = document.getElementById("live");
    if (!live || !text) return;
    live.textContent = "";
    window.setTimeout(function () { live.textContent = text; }, 40);
  }

  function toast(message) {
    ui.toast = message;
    ui.announceToast = true;
    render();
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      ui.toast = "";
      render();
    }, 3400);
  }

  function snapshotForms() {
    var form = document.querySelector("form[data-persist]");
    if (!form) return;
    var next = {};
    form.querySelectorAll("input, textarea, select").forEach(function (el) {
      if (!el.name || el.type === "file") return;
      if (el.type === "checkbox") next[el.name] = el.checked ? "on" : "";
      else if (el.type === "radio") { if (el.checked) next[el.name] = el.value; }
      else next[el.name] = el.value;
    });
    ui.formValues = next;
  }

  function showErrors(values, errors) {
    ui.formValues = values;
    ui.fieldErrors = errors;
    ui.focusError = true;
    ui.skipSnapshot = true;
    render();
  }

  function val(name, fallback) {
    if (Object.prototype.hasOwnProperty.call(ui.formValues, name)) return ui.formValues[name];
    return fallback == null ? "" : fallback;
  }

  function fieldError(name) {
    return ui.fieldErrors[name] || "";
  }

  function describedBy(id, name, hint) {
    var ids = [];
    if (hint) ids.push(id + "-hint");
    if (fieldError(name)) ids.push(id + "-error");
    return ids.length ? ' aria-describedby="' + ids.join(" ") + '"' : "";
  }

  function errorText(name, id) {
    var message = fieldError(name);
    return message ? '<p class="field-error" id="' + id + '-error">' + esc(message) + "</p>" : "";
  }

  function formAlert(errors) {
    var messages = [];
    Object.keys(errors || {}).forEach(function (key) {
      if (errors[key]) messages.push(errors[key]);
    });
    if (!messages.length) return "";
    return '<div class="form-alert" role="alert" tabindex="-1"><p><strong>Please fix the following.</strong></p><ul>' +
      messages.map(function (message) { return "<li>" + esc(message) + "</li>"; }).join("") +
      "</ul></div>";
  }

  function footer() {
    return '<footer class="site-foot"><p>BlockBuddy · Good finds, right around the block.</p><p>SkyPeak @ Bukit Batok pilot. <a href="docs/index.html">How BlockBuddy works</a></p></footer>';
  }

  function gate(kind, user) {
    if (kind === "sign-in") {
      return '<section class="banner banner-info"><h1>Sign in to continue</h1><p>The SkyPeak marketplace is for residents with an account.</p><div class="row-actions"><a class="btn btn-primary" href="#/">Sign in</a><a class="btn btn-secondary" href="#/register">Create an account</a></div></section>';
    }
    var status = user.verification.status;
    var copy = {
      none: "Submit proof of residence before you browse, post or message.",
      submitted: "Your document is submitted. The feed opens when a reviewer marks you Verified.",
      under_review: "A reviewer is checking your residence. The feed opens when your status is Verified.",
      action_needed: "Your residence check needs a new photo before you can use the marketplace."
    };
    return '<section class="banner banner-warn"><p class="status-pill status-' + esc(status) + '">' + esc(statusLabel(status)) + '</p><h1>Verification comes first</h1><p>' + esc(copy[status] || copy.none) + '</p><div class="row-actions"><a class="btn btn-primary" href="#/verify">Open residence verification</a></div></section>';
  }

  function requireUser(needVerified) {
    var user = activeUser();
    if (!user) return gate("sign-in");
    if (needVerified && !verified(user)) return gate("verify", user);
    return "";
  }

  function listingCard(listing) {
    var owner = BBStore.userById(listing.ownerId);
    var photo = safeImg(listing.photo);
    return '<article class="listing-card">' +
      '<a class="card-link" href="#/listing/' + esc(listing.id) + '">' +
      '<div class="art art-' + safeCat(listing.category) + (photo ? " has-photo" : "") + '">' +
      (photo ? '<img alt="" src="' + photo + '">' : BBArt.svg(listing.art || ART_FOR[listing.category] || "other")) +
      "</div>" +
      '<div class="card-body"><p class="badge badge-' + esc(listing.type) + '">' + esc(typeLabel(listing.type)) + "</p>" +
      "<h2>" + esc(listing.title) + "</h2>" +
      '<p class="price">' + esc(priceLabel(listing)) + "</p>" +
      '<p class="meta">' + esc(categoryLabel(listing.category)) + (listing.condition && listing.condition !== "Any" ? " · " + esc(listing.condition) : "") + "</p></div></a>" +
      '<p class="byline">' +
      (owner ? '<a href="#/member/' + esc(owner.id) + '">' + esc(owner.preferredName) + "</a>" : "Neighbour") +
      " · " + esc(timeAgo(listing.createdAt)) +
      (listing.status === "taken" ? ' · <span class="badge badge-taken">Taken</span>' : "") +
      (listing.status === "hidden" ? ' · <span class="badge badge-taken">Hidden</span>' : "") +
      "</p></article>";
  }

  function skeletons(count) {
    var cards = "";
    for (var i = 0; i < count; i += 1) {
      cards += '<div class="skeleton-card"><div class="skeleton-art"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>';
    }
    return '<div class="grid-cards" aria-hidden="true">' + cards + '</div><p class="sr-only" role="status">Loading listings</p>';
  }

  function emptyState(title, body, href, label) {
    return '<section class="state-card"><h2>' + esc(title) + "</h2><p>" + esc(body) + "</p>" +
      (href ? '<a class="btn btn-primary" href="' + href + '">' + esc(label) + "</a>" : "") +
      "</section>";
  }

  function optionList(list, current, placeholder) {
    var html = placeholder ? '<option value="">' + esc(placeholder) + "</option>" : "";
    list.forEach(function (item) {
      var value = typeof item === "string" ? item : item[0];
      var label = typeof item === "string" ? item : item[1];
      html += '<option value="' + esc(value) + '"' + (String(current) === String(value) ? " selected" : "") + ">" + esc(label) + "</option>";
    });
    return html;
  }

  function filterFields(params) {
    return '<div class="field"><label for="filter-q">Keyword</label><input id="filter-q" name="q" type="search" value="' + esc(params.get("q") || "") + '" maxlength="80"></div>' +
      '<div class="field"><label for="filter-category">Category</label><select id="filter-category" name="category">' + optionList(CATEGORIES, params.get("category") || "", "Any category") + "</select></div>" +
      '<div class="field"><label for="filter-type">Listing type</label><select id="filter-type" name="type">' + optionList(TYPES, params.get("type") || "", "Any type") + "</select></div>" +
      '<div class="field"><label for="filter-min">Minimum price (S$)</label><input id="filter-min" name="min" type="number" min="0" inputmode="numeric" value="' + esc(params.get("min") || "") + '"></div>' +
      '<div class="field"><label for="filter-max">Maximum price (S$)</label><input id="filter-max" name="max" type="number" min="0" inputmode="numeric" value="' + esc(params.get("max") || "") + '"></div>' +
      '<p id="price-filter-error" class="field-error" hidden>Minimum price is higher than the maximum.</p>' +
      '<label class="check" for="filter-free"><input id="filter-free" name="free" type="checkbox"' + (params.get("free") === "1" ? " checked" : "") + "> Free items only</label>";
  }

  function filterForm(params, sheet) {
    return '<form class="filters' + (sheet ? " sheet" : "") + '" data-form="filters" id="filter-form"' +
      (sheet ? ' data-dialog role="dialog" aria-modal="true" aria-labelledby="filter-title"' : ' aria-label="Filter listings"') + ">" +
      '<h2 id="filter-title">Filters</h2>' +
      "<p class=\"hint\">Results stay inside SkyPeak @ Bukit Batok.</p>" +
      filterFields(params) +
      '<div class="row-actions"><button class="btn btn-primary" type="submit">Apply filters</button>' +
      '<button class="btn btn-secondary" type="button" data-action="clear-filters">Clear all</button>' +
      (sheet ? '<button class="btn btn-ghost" type="button" data-action="close-filters" data-close>Close</button>' : "") +
      "</div></form>";
  }

  function chips(params) {
    var items = [];
    if (params.get("q")) items.push(["q", "Keyword: " + params.get("q")]);
    if (params.get("category")) items.push(["category", categoryLabel(params.get("category"))]);
    if (params.get("type")) items.push(["type", typeLabel(params.get("type"))]);
    if (params.get("min")) items.push(["min", "Min " + money(params.get("min"))]);
    if (params.get("max")) items.push(["max", "Max " + money(params.get("max"))]);
    if (params.get("free")) items.push(["free", "Free items"]);
    if (!items.length) return "";
    return '<div class="chips" aria-label="Active filters">' + items.map(function (item) {
      return '<button type="button" class="chip" data-action="remove-chip" data-key="' + esc(item[0]) + '"><span>' + esc(item[1]) + '</span><span aria-hidden="true">×</span><span class="sr-only">, remove filter</span></button>';
    }).join("") + '<button type="button" class="btn btn-ghost btn-small" data-action="clear-filters">Clear all</button></div>';
  }

  function searchQuery(params) {
    if (!window.BBDemo) return BBStore.visibleListings();
    var filters = {
      q: params.get("q") || "",
      category: params.get("category") || "",
      type: params.get("type") || "",
      min: params.get("min") || "",
      max: params.get("max") || "",
      free: params.get("free") === "1"
    };
    return BBStore.visibleListings(filters);
  }

  function menuPanel(user, route) {
    var unread = user ? BBStore.unreadCount(user.id) : 0;
    var items = "";
    function item(href, label, on) {
      items += '<a role="menuitem" href="' + href + '"' + (on ? ' aria-current="page"' : "") + ">" + label + "</a>";
    }
    if (!user) {
      item("#/", "Sign in", route.name === "home");
      item("#/register", "Create an account", route.name === "register");
      item("#/help", "Help and safety", route.name === "help");
    } else {
      item("#/feed", "Community feed", route.name === "feed");
      item("#/messages", "Messages" + (unread ? " (" + unread + " unread)" : ""), route.name === "messages" || route.name === "thread");
      item("#/profile", "Profile", route.name === "profile");
      item("#/help", "Help and safety", route.name === "help");
      if (verified(user)) item("#/listing/new", "Post a listing", route.name === "edit" && !route.id);
      item("#/verify", "Residence verification", route.name === "verify");
      if (user.isAdmin) item("#/admin", "Reviewer queue", route.name === "admin");
      items += '<button type="button" role="menuitem" data-action="sign-out">Sign out</button>';
    }
    return '<div id="site-menu" class="menu-panel" role="menu"' + (ui.menu ? "" : " hidden") + ">" + items + "</div>";
  }

  function tabs(user, route) {
    if (!user) return "";
    var unread = BBStore.unreadCount(user.id);
    var dot = unread ? '<span class="dot" aria-hidden="true"></span><span class="sr-only">' + unread + " unread</span>" : "";
    function tab(href, icon, label, on, extra) {
      return '<a href="' + href + '"' + (on ? ' class="is-current" aria-current="page"' : "") + ">" + BBArt.icon(icon) + "<span>" + label + "</span>" + (extra || "") + "</a>";
    }
    var html = '<nav class="tabbar" aria-label="Primary" data-inert-when-dialog>';
    if (verified(user)) {
      html += tab("#/feed", "feed", "Feed", route.name === "feed") +
        tab("#/search", "search", "Search", route.name === "search") +
        tab("#/listing/new", "plus", "Post", route.name === "edit") +
        tab("#/messages", "chat", "Inbox", route.name === "messages" || route.name === "thread", dot) +
        tab("#/profile", "user", "Profile", route.name === "profile" || route.name === "member");
    } else {
      html += tab("#/", "home", "Home", route.name === "home") +
        tab("#/verify", "shield", "Verify", route.name === "verify") +
        tab("#/help", "shield", "Help", route.name === "help") +
        tab("#/profile", "user", "Profile", route.name === "profile");
    }
    return html + "</nav>";
  }

  function shell(route, main) {
    var user = activeUser();
    var showSearch = verified(user);
    var q = route.name === "search" ? (route.params.get("q") || "") : "";
    var status = user ? statusLabel(user.verification.status) : "Signed out";
    var proto = window.BBDemo
      ? '<div class="proto-bar"><p><span>Prototype — demo data only</span><span class="proto-status">Status: ' + esc(status) + "</span></p>" +
        '<button type="button" data-action="reviewer">Reviewer tools</button></div>'
      : "";
    return '<div class="sticky-head" data-inert-when-dialog>' + proto +
      '<header class="topbar' + (showSearch ? "" : " no-search") + '">' +
      '<a class="brand" href="#/">' + BBArt.logo() + '<span class="wordmark">Block<span>Buddy</span></span></a>' +
      (showSearch
        ? '<form class="search" role="search" data-form="search"><label class="sr-only" for="site-search">Search SkyPeak listings</label><input id="site-search" name="q" type="search" placeholder="Search the SkyPeak feed" maxlength="80" value="' + esc(q) + '"><button class="btn btn-primary" type="submit">Search</button></form>'
        : "") +
      '<div class="top-actions">' +
      (verified(user) ? '<a class="btn btn-secondary btn-small post-link" href="#/listing/new">Post</a>' : "") +
      '<div class="menu"><button type="button" class="btn btn-secondary btn-small" data-action="toggle-menu" aria-expanded="' + (ui.menu ? "true" : "false") + '" aria-controls="site-menu">Menu</button>' +
      menuPanel(user, route) + "</div></div></header></div>" +
      '<main id="main" tabindex="-1" data-inert-when-dialog><div class="wrap">' + main + footer() + "</div></main>" +
      tabs(user, route) +
      sheetHtml(route) +
      dialogs() +
      (ui.toast ? '<div class="toast">' + esc(ui.toast) + "</div>" : "");
  }

  function dialogs() {
    return confirmDialog() + reportDialog() + reviewerDialog();
  }

  function backdrop(inner, labelledby) {
    return '<div class="backdrop" data-action="close-dialog"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="' + labelledby + '" data-dialog>' + inner + "</div></div>";
  }

  function confirmDialog() {
    if (!ui.confirm) return "";
    var c = ui.confirm;
    return backdrop(
      '<h2 id="confirm-title">' + esc(c.title) + "</h2><p>" + esc(c.body) + "</p>" +
      '<div class="row-actions"><button type="button" class="btn ' + (c.danger ? "btn-danger" : "btn-primary") + '" data-action="confirm-yes" data-autofocus>' + esc(c.confirmLabel) + '</button>' +
      '<button type="button" class="btn btn-secondary" data-action="close-dialog" data-close>Cancel</button></div>',
      "confirm-title"
    );
  }

  function reportDialog() {
    if (!ui.report) return "";
    if (ui.report.done) {
      return backdrop(
        '<h2 id="report-title">Report sent</h2><p>' + (window.BBDemo ? "It stays on this device. A live BlockBuddy service would send it to moderators. Other neighbours cannot see it." : "Reviewers in your community can see this report. Other neighbours cannot.") + '</p><button type="button" class="btn btn-primary" data-action="close-dialog" data-close data-autofocus>Close</button>',
        "report-title"
      );
    }
    var report = ui.report;
    return backdrop(
      '<h2 id="report-title">Report ' + esc(report.targetLabel || "a concern") + "</h2>" +
      (report.error ? '<p class="field-error" role="alert">' + esc(report.error) + "</p>" : "") +
      '<form data-form="report">' +
      '<div class="field"><label for="report-reason">Reason</label><select id="report-reason" name="reason" data-autofocus>' +
      optionList(REPORT_REASONS, "", "Choose a reason") + "</select>" +
      (fieldError("reason") ? '<p class="field-error">' + esc(fieldError("reason")) + "</p>" : "") +
      "</div>" +
      '<div class="field"><label for="report-details">What happened</label><textarea id="report-details" name="details" maxlength="800" placeholder="Optional, and please leave out unit numbers.">' + esc(val("details", "")) + "</textarea></div>" +
      '<div class="row-actions"><button class="btn btn-primary" type="submit">Submit report</button><button class="btn btn-secondary" type="button" data-action="close-dialog" data-close>Cancel</button></div></form>',
      "report-title"
    );
  }

  function reviewerDialog() {
    if (!ui.reviewer) return "";
    var user = activeUser();
    var current = user ? user.verification.status : "none";
    var radios = STATUS_ORDER.map(function (status) {
      return '<label><input type="radio" name="reviewer-status" value="' + status + '"' + (current === status ? " checked" : "") + (user ? "" : " disabled") + "> " + esc(statusLabel(status)) + "</label>";
    }).join("");
    return backdrop(
      '<h2 id="reviewer-title">Reviewer tools</h2>' +
      '<p>Switch verification, replay loading and error states, or reset the demo. This only changes this browser.</p>' +
      (ui.reviewerNote ? '<p class="field-error" role="status">' + esc(ui.reviewerNote) + "</p>" : "") +
      (user ? "" : '<button type="button" class="btn btn-primary" data-action="sign-in-demo" data-autofocus>Continue as demo neighbour</button>') +
      '<fieldset class="status-switch"><legend>Verification status</legend>' + radios + "</fieldset>" +
      '<label class="check"><input type="checkbox" name="fail-next"' + (ui.failNext ? " checked" : "") + "> Fail the next document upload</label>" +
      '<div class="stack-actions">' +
      '<button type="button" class="btn btn-secondary" data-action="play-loading" data-which="feed">Play feed loading</button>' +
      '<button type="button" class="btn btn-secondary" data-action="show-feed-error">Show feed error</button>' +
      '<button type="button" class="btn btn-secondary" data-action="play-loading" data-which="messages">Play inbox loading</button>' +
      '<button type="button" class="btn btn-danger" data-action="ask-reset">Reset demo</button>' +
      '<button type="button" class="btn btn-ghost" data-action="close-dialog" data-close>Close</button></div>',
      "reviewer-title"
    );
  }

  function viewHome() {
    var user = activeUser();
    var card;
    if (user) {
      var first = user.preferredName.split(" ")[0];
      var ok = verified(user);
      card = '<section class="hero-card"><p class="eyebrow">Your account</p><h2>Hello, ' + esc(first) + '</h2>' +
        '<p class="status-pill status-' + esc(user.verification.status) + '">' + esc(statusLabel(user.verification.status)) + "</p>" +
        "<p>" + (ok
          ? "You can browse the SkyPeak feed, post a listing, or pick up a conversation."
          : "Finish residence verification and the marketplace opens.") + "</p>" +
        '<div class="stack-actions"><a class="btn btn-primary" href="' + (ok ? "#/feed" : "#/verify") + '">' + (ok ? "Go to the feed" : "Continue verification") + '</a>' +
        '<button type="button" class="btn btn-ghost" data-action="sign-out">Sign out</button></div></section>';
    } else {
      card = '<section class="hero-card"><h2>Sign in</h2>' + formAlert(ui.fieldErrors) +
        '<form data-form="sign-in" data-persist novalidate>' +
        '<div class="field"><label for="sign-email">Email</label><input id="sign-email" name="email" type="email" autocomplete="email" maxlength="80" required value="' + esc(val("email", "")) + '"' + (fieldError("email") ? ' aria-invalid="true"' : "") + describedBy("sign-email", "email") + ">" + errorText("email", "sign-email") + "</div>" +
        '<div class="field"><label for="sign-password">Password</label><div class="password-row"><input id="sign-password" name="password" type="password" autocomplete="current-password" maxlength="80" required' + (fieldError("password") ? ' aria-invalid="true"' : "") + describedBy("sign-password", "password") + '><button type="button" class="btn btn-secondary btn-small" data-action="toggle-password" aria-controls="sign-password" aria-pressed="false">Show</button></div>' + errorText("password", "sign-password") + "</div>" +
        '<div class="stack-actions"><button class="btn btn-primary" type="submit">Sign in</button><a class="btn btn-ghost" href="#/register">Create an account</a></div>' +
        '<p class="hint"><a href="#/forgot">Forgot your password?</a></p></form>' +
        (window.BBDemo
          ? '<div class="demo-box"><p><strong>Demo neighbour.</strong> Email <code>' + esc(BBData.demo.email) + "</code> · password <code>" + esc(BBData.demo.password) + "</code></p>" +
            '<button type="button" class="btn btn-secondary" data-action="sign-in-demo">Continue as Alex</button></div>'
          : "") +
        (BBStore.error && BBStore.error() ? '<p class="field-error" role="alert">' + esc(BBStore.error()) + "</p>" : "") +
        "</section>";
    }
    return '<div class="hero"><div class="hero-copy"><p class="eyebrow">SkyPeak @ Bukit Batok</p><h1>Good finds, right around the block.</h1>' +
      '<p class="lead">A neighbourly marketplace for one HDB block. Buy, sell, give away or trade with people who actually live here. More communities can join after this pilot.</p></div>' +
      card +
      '<div class="hero-aside">' + BBArt.hero() +
      '<ul class="trust"><li><h2>Verified residents</h2><p>The feed opens after a residence check.</p></li>' +
      "<li><h2>Private documents</h2><p>Proof of address is stored privately for reviewers and deleted " + BBData.retentionDays + " days after a decision.</p></li>" +
      "<li><h2>No unit numbers</h2><p>Profiles show “SkyPeak @ Bukit Batok resident”, not a door number.</p></li></ul></div></div>";
  }

  function viewForgot() {
    if (activeUser()) {
      return '<section class="banner banner-info"><h1>You’re signed in</h1><p>You can set a new password from your account.</p><a class="btn btn-primary" href="#/update-password">Change password</a></section>';
    }
    return '<section class="panel"><p class="eyebrow">Password reset</p><h1>Email a reset link</h1>' +
      "<p>We’ll send a link that brings you back to this site. It expires, and the free mailer only sends a few each hour.</p>" +
      (ui.pendingEmail ? '<div class="banner banner-ok" role="status"><h2>Check your inbox</h2><p>If an account uses that email, a reset link is on its way. Open it on this device.</p></div>' : "") +
      formAlert(ui.fieldErrors) +
      '<form data-form="forgot" data-persist novalidate>' +
      '<div class="field"><label for="forgot-email">Email</label><input id="forgot-email" name="email" type="email" autocomplete="email" maxlength="80" required value="' + esc(val("email", "")) + '"' + (fieldError("email") ? ' aria-invalid="true"' : "") + ">" + errorText("email", "forgot-email") + "</div>" +
      '<div class="stack-actions"><button class="btn btn-primary" type="submit">Send reset link</button><a class="btn btn-ghost" href="#/">Back to sign in</a></div></form></section>';
  }

  function viewUpdatePassword() {
    return '<section class="panel"><p class="eyebrow">Password</p><h1>Choose a new password</h1>' +
      (ui.pendingEmail ? '<div class="banner banner-ok" role="status"><h2>Password updated</h2><p>You can go back to the marketplace with the new password.</p></div>' : "") +
      formAlert(ui.fieldErrors) +
      '<form data-form="update-password" novalidate>' +
      '<div class="field"><label for="new-password">New password</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="80" required' + (fieldError("password") ? ' aria-invalid="true"' : "") + ">" + errorText("password", "new-password") + "</div>" +
      '<div class="field"><label for="new-confirm">Confirm password</label><input id="new-confirm" name="confirm" type="password" autocomplete="new-password" maxlength="80" required' + (fieldError("confirm") ? ' aria-invalid="true"' : "") + ">" + errorText("confirm", "new-confirm") + "</div>" +
      '<div class="stack-actions"><button class="btn btn-primary" type="submit">Update password</button><a class="btn btn-ghost" href="#/">Home</a></div></form></section>';
  }

  function viewRegister() {
    if (activeUser()) {
      return '<section class="banner banner-info"><h1>You already have an account</h1><p>Continue with residence verification, or sign out to register someone else.</p><div class="row-actions"><a class="btn btn-primary" href="#/verify">Verification</a><button type="button" class="btn btn-secondary" data-action="sign-out">Sign out</button></div></section>';
    }
    if (ui.pendingEmail && !window.BBDemo) {
      return '<section class="panel"><p class="eyebrow">Join the pilot</p><h1>Check your email</h1><div class="banner banner-ok" role="status"><h2>Account created</h2><p>Open the confirmation link to finish signing up. The free mailer only sends a few messages an hour, so it can take a minute. Then come back and sign in.</p></div><a class="btn btn-primary" href="#/">Back to sign in</a></section>';
    }
    return '<section class="panel"><p class="eyebrow">Join the pilot</p><h1>Create an account</h1>' +
      "<p>Your public name is a preferred name. Neighbours will not see your email or unit number.</p>" +
      formAlert(ui.fieldErrors) +
      '<form data-form="register" data-persist novalidate>' +
      '<div class="field"><label for="reg-name">Preferred name</label><input id="reg-name" name="preferredName" autocomplete="name" maxlength="60" required value="' + esc(val("preferredName", "")) + '"' + (fieldError("preferredName") ? ' aria-invalid="true"' : "") + describedBy("reg-name", "preferredName", true) + '><p class="hint" id="reg-name-hint">This is the name on your profile. Not your unit number.</p>' + errorText("preferredName", "reg-name") + "</div>" +
      '<div class="field"><label for="reg-email">Email</label><input id="reg-email" name="email" type="email" autocomplete="email" maxlength="80" required value="' + esc(val("email", "")) + '"' + (fieldError("email") ? ' aria-invalid="true"' : "") + ">" + errorText("email", "reg-email") + "</div>" +
      '<div class="field"><label for="reg-password">Password</label><div class="password-row"><input id="reg-password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="80" required' + (fieldError("password") ? ' aria-invalid="true"' : "") + describedBy("reg-password", "password", true) + '><button type="button" class="btn btn-secondary btn-small" data-action="toggle-password" aria-controls="reg-password" aria-pressed="false">Show</button></div><p class="hint" id="reg-password-hint">At least 8 characters. ' + (window.BBDemo ? "This demo stores it only on your device." : "Supabase stores a hash, not the password itself.") + "</p>" + errorText("password", "reg-password") + "</div>" +
      '<div class="field"><label for="reg-confirm">Confirm password</label><input id="reg-confirm" name="confirm" type="password" autocomplete="new-password" maxlength="80" required' + (fieldError("confirm") ? ' aria-invalid="true"' : "") + ">" + errorText("confirm", "reg-confirm") + "</div>" +
      '<div class="field"><p id="community-label">Community</p><p class="readonly" aria-labelledby="community-label">SkyPeak @ Bukit Batok</p><p class="hint">This pilot is one block. The service is shaped so more HDB communities can be added later.</p></div>' +
      '<label class="check"><input type="checkbox" name="resident"' + (val("resident") === "on" ? " checked" : "") + "> I live at SkyPeak @ Bukit Batok</label>" +
      (fieldError("resident") ? '<p class="field-error">' + esc(fieldError("resident")) + "</p>" : "") +
      "<p>Be honest about condition, keep unit numbers out of listings and chat, and meet in a common area.</p>" +
      '<label class="check"><input type="checkbox" name="guidelines"' + (val("guidelines") === "on" ? " checked" : "") + "> I agree to the community guidelines</label>" +
      '<p class="hint"><a href="#/help">Read help and safety</a></p>' +
      (fieldError("guidelines") ? '<p class="field-error">' + esc(fieldError("guidelines")) + "</p>" : "") +
      '<div class="stack-actions"><button class="btn btn-primary" type="submit">Create account</button><a class="btn btn-ghost" href="#/">I already have an account</a></div></form></section>';
  }

  function viewVerify(route) {
    var blocked = requireUser(false);
    if (blocked) return blocked;
    var user = activeUser();
    syncDoc(user);
    var v = user.verification;
    var status = v.status;
    var html = '<p class="eyebrow">SkyPeak @ Bukit Batok</p><h1>Residence verification</h1>' +
      "<p>The feed is only for people who live at SkyPeak. A residence check keeps strangers out of the block’s marketplace.</p>";
    if (route.params.get("welcome")) {
      html += '<div class="banner banner-ok" role="status"><h2>Account created</h2><p>Next, confirm you live at SkyPeak. You can use the sample bill if you do not have a photo handy.</p></div>';
    }
    html += '<div class="banner ' + bannerTone(status) + '" id="status-banner"><p class="status-pill status-' + esc(status) + '">' + esc(statusLabel(status)) + "</p><h2>" + esc(statusLabel(status)) + "</h2><p>" + esc(statusCopy(status, v)) + "</p>";
    if (v.updatedAt && status !== "none") html += '<p class="hint">Updated ' + esc(timeAgo(v.updatedAt)) + ".</p>";
    if (status === "verified") html += '<a class="btn btn-primary" href="#/feed">Browse the feed</a>';
    html += "</div>";
    if (status === "submitted" || status === "under_review" || status === "verified") {
      var preview = safeImg(v.previewDataUrl);
      if (preview) {
        html += '<figure class="panel"><figcaption>Your submitted preview. Only you can see it on this page.</figcaption><img class="doc-preview" alt="Redacted document preview" src="' + preview + '"></figure>';
      } else if (status !== "verified") {
        html += '<p class="hint">No document preview is stored yet. Reviewer tools can still move the status so each screen can be checked.</p>';
      }
      if (!window.BBDemo) html += submissionList();
      if (ui.docFor === "own" && safeImg(ui.docUrl)) {
        html += '<figure class="panel"><figcaption>The redacted file you sent. The link expires in a minute.</figcaption><img class="doc-preview" alt="Redacted document" src="' + safeImg(ui.docUrl) + '"></figure>';
      }
      if (window.BBDemo) html += '<p class="hint">Need another status? Use Reviewer tools in the top bar.</p>';
    }
    if (status === "none" || status === "action_needed") html += uploadForm();
    html += '<div class="panel"><h2>What to upload</h2><p>A recent utility bill, town council letter or tenancy letter that shows your name and SkyPeak address.</p>' +
      "<h2>What to cover</h2><p>Cover account numbers, card numbers and other financial details. Leave your name and address visible so a reviewer can match them. Drag a box on the preview, or use Add a cover box.</p>" +
      "<h2>Who can see it</h2><p>Only reviewers. It never appears on your profile, listings or chats. Neighbours see “" + esc(BBData.community.residentLabel) + "”, never your unit number.</p>" +
      "<h2>How long it is kept</h2><p>" + (window.BBDemo
        ? "In the live service, documents are stored privately and deleted " + BBData.retentionDays + " days after a decision. This demo keeps the preview in your browser only and does not upload it."
        : "The file is stored in a private bucket. You and reviewers can open it. Other neighbours cannot. It is deleted " + BBData.retentionDays + " days after a decision.") + "</p></div>";
    return html;
  }

  function bannerTone(status) {
    if (status === "verified" || status === "submitted") return "banner-ok";
    if (status === "action_needed") return "banner-bad";
    if (status === "under_review") return "banner-warn";
    return "banner-info";
  }

  function statusCopy(status, record) {
    if (status === "submitted") return "We have your document. A reviewer has not opened it yet. Other neighbours cannot open it either.";
    if (status === "under_review") return "A reviewer is checking that your name and SkyPeak address match.";
    if (status === "verified") return "You’re in. You can use the SkyPeak feed, post listings and message neighbours.";
    if (status === "action_needed") return record.actionReason || BBData.actionReason;
    return window.BBDemo
      ? "Choose a photo to start. Nothing is sent to a server in this prototype."
      : "Choose a photo to start. Redaction is burned into the image on this device before it is uploaded.";
  }

  function submissionList() {
    var rows = BBStore.mySubmissions ? BBStore.mySubmissions() : [];
    if (!rows.length) return "";
    return '<section class="panel"><h2>Your submissions</h2><ul class="queue">' + rows.map(function (row) {
      var when = row.submitted_at ? timeAgo(Date.parse(row.submitted_at)) : "";
      return "<li><strong>" + esc(statusLabel(row.status === "not_submitted" ? "none" : row.status)) + "</strong> · " + esc(row.file_name || "document") + " · " + esc(when) +
        (row.reviewer_note ? "<br>" + esc(row.reviewer_note) : "") +
        (row.document_deleted_at ? "<br>The file was deleted after the retention period." : "") +
        (!row.document_deleted_at && row.storage_path ? ' <button type="button" class="btn btn-secondary btn-small" data-action="view-own-doc" data-path="' + esc(row.storage_path) + '">View file</button>' : "") +
        "</li>";
    }).join("") + "</ul></section>";
  }

  function uploadForm() {
    var preview = safeImg(docSession.dataUrl);
    var html = '<section class="panel"><h2>' + (activeUser().verification.status === "action_needed" ? "Send a clearer photo" : "Secure upload") + "</h2>" +
      "<p>" + (window.BBDemo
        ? "The file is previewed in this browser and is not uploaded. Cover financial details before you submit."
        : "Cover financial details, then submit. The covered image is saved on this device and only that copy is uploaded. PDFs are not accepted, because the redaction has to be part of the picture.") + "</p>" +
      formAlert(ui.fieldErrors);
    if (ui.uploadError) {
      html += '<div class="banner banner-bad" role="alert"><h2>Upload failed</h2><p>' + esc(ui.uploadErrorMessage || "The upload did not go through. Nothing left this browser.") + '</p><button type="button" class="btn btn-primary" data-action="retry-upload">Retry upload</button></div>';
    }
    html += '<form data-form="verify" novalidate>' +
      '<div class="dropzone"><label for="proof"><strong>Choose a photo</strong></label>' +
      '<input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,image/gif"' + describedBy("proof", "proof", true) + '>' +
      '<p class="hint" id="proof-hint">JPG, PNG, WEBP or GIF, up to 8 MB. PDFs stay on your device. ' + (docSession.name ? "Selected: " + esc(docSession.name) + "." : "No file selected yet.") + "</p>" +
      errorText("proof", "proof") +
      '<div class="row-actions"><button type="button" class="btn btn-secondary" data-action="use-sample">Use a sample bill</button>' +
      (window.BBDemo ? '<button type="button" class="btn btn-ghost" data-action="preview-upload-error">Preview the upload-failed state</button>' : "") +
      "</div></div>";
    if (preview) {
      html += '<div class="redact"><canvas id="redact-canvas" aria-label="Document preview. Drag to cover sensitive details."></canvas>' +
        '<p id="redact-help" class="hint">Drag a box over account numbers or other financial details. Leave your name and address visible. With a keyboard, use Add a cover box.</p>' +
        '<p id="redact-count" class="hint">' + (docSession.rects.length ? docSession.rects.length + " area(s) covered." : "No areas covered yet.") + "</p>" +
        '<div class="redact-actions"><button type="button" class="btn btn-secondary btn-small" data-action="add-redact">Add a cover box</button>' +
        '<button type="button" class="btn btn-secondary btn-small" data-action="undo-redact">Remove last box</button>' +
        '<button type="button" class="btn btn-ghost btn-small" data-action="clear-redact">Clear boxes</button></div></div>';
    }
    html += '<p role="status">' + (ui.uploading ? (window.BBDemo ? "Uploading. The photo stays in this browser." : "Uploading the redacted image.") : "") + "</p>" +
      '<button class="btn btn-primary" id="submit-doc" type="submit"' + (ui.uploading ? " disabled" : "") + ">" + (ui.uploading ? "Uploading…" : "Submit for review") + "</button></form></section>";
    return html;
  }

  function loadError(title) {
    if (!ui.feedError || window.BBDemo) return "";
    return '<section class="banner banner-bad" role="alert"><h1>' + esc(title) + '</h1><p>' + esc(ui.feedErrorMessage || "Try again.") + '</p><button type="button" class="btn btn-primary" data-action="retry-feed">Try again</button></section>';
  }

  function viewFeed() {
    var blocked = requireUser(true);
    if (blocked) return blocked;
    if (ui.feedError) {
      return '<section class="banner banner-bad" role="alert"><h1>We couldn’t load the community feed</h1><p>' + esc(ui.feedErrorMessage || "This is a simulated error so the retry state can be reviewed. Nothing is wrong with your account.") + '</p><button type="button" class="btn btn-primary" data-action="retry-feed">Try again</button></section>';
    }
    if (ui.loading === "feed") {
      return '<header class="page-head"><p class="eyebrow">Your community</p><h1>SkyPeak @ Bukit Batok</h1></header>' + skeletons(4);
    }
    var listings = BBStore.visibleListings();
    var quick = '<div class="quick" aria-label="Shortcuts"><a href="#/search">All</a><a href="#/search?type=sell">For sale</a><a href="#/search?type=giveaway">Give away</a><a href="#/search?free=1">Free</a><a href="#/search?type=trade">Trade</a><a href="#/search?type=wanted">Wanted</a></div>';
    var grid = listings.length
      ? '<div class="grid-cards">' + listings.map(listingCard).join("") + "</div>"
      : emptyState("No listings to show", "If you have blocked neighbours, their items stay hidden. You can unblock them from your profile.", "#/profile", "Review blocks");
    return '<header class="page-head"><p class="eyebrow">Your community</p><h1>SkyPeak @ Bukit Batok</h1><p>Verified neighbours only. Unit numbers stay off the feed. ' + listings.length + (listings.length === 1 ? " listing." : " listings.") + "</p></header>" + quick + grid;
  }

  function viewSearch(route) {
    var blocked = requireUser(true);
    if (blocked) return blocked;
    var failed = loadError("We couldn’t search the feed");
    if (failed) return failed;
    var params = route.params;
    var desktop = desktopFilters();
    var results = "";
    if (ui.loading === "search") results = skeletons(4);
    else {
      var listings = searchQuery(params);
      var head = '<div class="results-head"><h2>' + listings.length + (listings.length === 1 ? " result" : " results") + '</h2><button type="button" class="btn btn-secondary filters-open" data-action="open-filters">Filters</button></div>' + chips(params);
      if (!listings.length) {
        results = head + emptyState("Nothing matches", "Try another word, or clear a filter. Search never leaves SkyPeak @ Bukit Batok.", "#/search", "Clear search");
      } else {
        results = head + '<div class="grid-cards">' + listings.map(listingCard).join("") + "</div>";
      }
    }
    return '<header class="page-head"><p class="eyebrow">Search</p><h1>Find something on the block</h1><p>Filters apply to SkyPeak listings only. On a phone they open as a sheet. On a wide screen they stay in the sidebar.</p></header>' +
      '<div class="search-layout">' +
      (desktop ? filterForm(params, false) : "") +
      "<div>" + results + "</div></div>";
  }

  function sheetHtml(route) {
    if (route.name !== "search" || !ui.filters || desktopFilters()) return "";
    return '<div class="sheet-backdrop" data-action="close-filters"></div>' + filterForm(route.params, true);
  }

  function viewListing(route) {
    var blocked = requireUser(true);
    if (blocked) return blocked;
    if (ui.loading === "listing") return "<h1>Listing</h1>" + skeletons(1);
    var listing = BBStore.listingById(route.id);
    if (!listing || (window.BBDemo && listing.communityId !== BBData.community.id)) {
      return emptyState("That listing is not available", "It may have been deleted, or it is outside SkyPeak.", "#/feed", "Back to the feed").replace("<h2>", "<h1>").replace("</h2>", "</h1>");
    }
    var me = activeUser();
    var owner = BBStore.userById(listing.ownerId);
    if (me.id !== listing.ownerId && BBStore.isBlocked(me.id, listing.ownerId)) {
      return '<section class="banner banner-warn"><h1>This listing is hidden</h1><p>You blocked this neighbour, so their items stay out of your feed.</p><button type="button" class="btn btn-secondary" data-action="unblock" data-user="' + esc(listing.ownerId) + '">Unblock</button></section>';
    }
    var photo = safeImg(listing.photo);
    var posted = route.params.get("posted") ? '<div class="banner banner-ok" role="status"><h2>Your listing is live</h2><p>Neighbours in SkyPeak can see it now. It does not show your unit number.</p></div>' : "";
    var updated = route.params.get("updated") ? '<div class="banner banner-ok" role="status"><h2>Changes saved</h2><p>The SkyPeak feed is using the new details.</p></div>' : "";
    var ownerBlock = "";
    if (me.id === listing.ownerId) {
      ownerBlock = '<div class="panel"><h2>Your listing</h2><div class="row-actions"><a class="btn btn-secondary" href="#/listing/' + esc(listing.id) + '/edit">Edit</a>' +
        (listing.status === "active"
          ? '<button type="button" class="btn btn-secondary" data-action="mark-taken" data-id="' + esc(listing.id) + '">Mark as taken</button>'
          : '<button type="button" class="btn btn-secondary" data-action="relist" data-id="' + esc(listing.id) + '">Put back on the feed</button>') +
        '<button type="button" class="btn btn-danger" data-action="ask-delete" data-id="' + esc(listing.id) + '">Delete</button></div></div>';
    } else if (owner) {
      ownerBlock = '<div class="row-actions"><button type="button" class="btn btn-primary" data-action="message" data-user="' + esc(owner.id) + '" data-listing="' + esc(listing.id) + '">Message ' + esc(owner.preferredName.split(" ")[0]) + '</button>' +
        '<button type="button" class="btn btn-secondary" data-action="open-report" data-type="listing" data-id="' + esc(listing.id) + '" data-label="' + esc(listing.title) + '">Report listing</button>' +
        '<button type="button" class="btn btn-ghost" data-action="ask-block" data-user="' + esc(owner.id) + '" data-name="' + esc(owner.preferredName) + '">Block neighbour</button></div>';
    }
    return posted + updated +
      '<div class="detail"><div class="art art-' + safeCat(listing.category) + (photo ? " has-photo" : "") + '">' +
      (photo ? '<img alt="" src="' + photo + '">' : BBArt.svg(listing.art || "other")) + "</div><div>" +
      '<p class="badge badge-' + esc(listing.type) + '">' + esc(typeLabel(listing.type)) + "</p>" +
      (listing.status === "taken" ? ' <span class="badge badge-taken">Taken</span>' : "") +
      "<h1>" + esc(listing.title) + "</h1><p class=\"price\">" + esc(priceLabel(listing)) + "</p>" +
      "<p class=\"meta\">" + esc(categoryLabel(listing.category)) + (listing.condition && listing.condition !== "Any" ? " · " + esc(listing.condition) : "") + " · " + esc(timeAgo(listing.createdAt)) + "</p>" +
      "<p>" + esc(listing.description) + "</p>" +
      (owner ? '<a class="seller" href="#/member/' + esc(owner.id) + '">' + avatar(owner.preferredName) + "<div><strong>" + esc(owner.preferredName) + "</strong><p>" + esc(BBData.community.residentLabel) + "</p></div></a>" : "") +
      '<div class="stack-top">' + ownerBlock + "</div>" +
      '<p class="hint">Meet at the lobby, letterboxes or void deck. Don’t share your unit number in chat.</p></div></div>';
  }

  function viewEdit(route) {
    var blocked = requireUser(true);
    if (blocked) return blocked;
    if (ui.loading === "edit") return "<h1>Listing</h1>" + skeletons(2);
    var existing = route.id ? BBStore.listingById(route.id) : null;
    if (route.id && (!existing || existing.ownerId !== activeUser().id)) {
      return emptyState("You can’t edit that listing", "Only the neighbour who posted it can change it.", "#/feed", "Back to the feed").replace("<h2>", "<h1>").replace("</h2>", "</h1>");
    }
    var type = val("type", existing ? existing.type : "sell");
    var title = val("title", existing ? existing.title : "");
    var category = val("category", existing ? existing.category : "home");
    var condition = val("condition", existing ? existing.condition : "Good");
    var price = val("price", existing && existing.price != null ? String(existing.price) : "");
    var description = val("description", existing ? existing.description : "");
    var photo = safeImg(ui.photo);
    var privacy = fieldError("privacy");
    var choices = TYPES.map(function (row) {
      return '<label class="choice"><input type="radio" name="type" value="' + row[0] + '"' + (type === row[0] ? " checked" : "") + "><span>" + row[1] + "</span></label>";
    }).join("");
    var priceLabelText = type === "wanted" ? "Budget (S$)" : type === "trade" ? "Cash difference, if any (S$)" : "Price (S$)";
    return '<p class="eyebrow">' + (existing ? "Edit listing" : "New listing") + "</p><h1>" + (existing ? "Edit your listing" : "Post to SkyPeak") + "</h1>" +
      formAlert(ui.fieldErrors) +
      '<form data-form="listing" data-persist novalidate>' +
      (existing ? '<input type="hidden" name="id" value="' + esc(existing.id) + '">' : "") +
      '<fieldset class="choices"><legend>What is this listing?</legend>' + choices + "</fieldset>" +
      '<div class="field"><label for="listing-title">Title</label><input id="listing-title" name="title" maxlength="80" required data-watch="listing" value="' + esc(title) + '"' + (fieldError("title") ? ' aria-invalid="true"' : "") + ">" + errorText("title", "listing-title") + "</div>" +
      '<div class="field"><label for="listing-category">Category</label><select id="listing-category" name="category">' + optionList(CATEGORIES, category) + "</select></div>" +
      '<div class="field" id="condition-field"' + (type === "wanted" ? " hidden" : "") + '><label for="listing-condition">Condition</label><select id="listing-condition" name="condition">' + optionList(CONDITIONS, condition) + "</select></div>" +
      '<div class="field" id="price-field"' + (type === "giveaway" ? " hidden" : "") + '><label id="price-label" for="listing-price">' + esc(priceLabelText) + '</label><input id="listing-price" name="price" type="number" min="0" max="100000" step="1" inputmode="numeric" data-watch="listing" value="' + esc(price) + '"' + (fieldError("price") ? ' aria-invalid="true"' : "") + ">" + errorText("price", "listing-price") + "</div>" +
      '<div class="field"><label for="listing-description">Description</label><textarea id="listing-description" name="description" maxlength="800" required data-watch="listing"' + (fieldError("description") || privacy ? ' aria-invalid="true"' : "") + ">" + esc(description) + "</textarea>" +
      '<p class="hint">Say how to collect it, such as the lobby or void deck. Don’t type a unit number.</p>' +
      errorText("description", "listing-description") +
      '<p id="privacy-flag" class="field-error"' + (privacy ? "" : " hidden") + ">That looks like a unit number. Listings are visible to neighbours, so patterns like #12-345 are blocked. Offer the lobby or void deck instead.</p></div>" +
      '<div class="field"><label for="listing-photo">Photo, optional</label><input id="listing-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><p class="hint">If you skip a photo, BlockBuddy draws a simple picture. Photos stay on this device and should not show your unit number.</p>' + errorText("photo", "listing-photo") +
      (photo ? '<button type="button" class="btn btn-ghost btn-small" data-action="clear-photo">Remove photo</button>' : "") + "</div>" +
      '<div class="stack-actions"><button class="btn btn-primary" type="submit">' + (existing ? "Save changes" : "Post listing") + '</button><a class="btn btn-ghost" href="' + (existing ? "#/listing/" + esc(existing.id) : "#/feed") + '">Cancel</a></div></form>' +
      '<div class="preview-card listing-card"><div class="art art-' + safeCat(category) + (photo ? " has-photo" : "") + '">' +
      (photo ? '<img alt="" src="' + photo + '">' : BBArt.svg(ART_FOR[category] || "other")) +
      '</div><div class="card-body"><p class="badge">' + esc(typeLabel(type)) + '</p><h2 id="preview-title">' + esc(title || "Listing title") + '</h2><p class="price" id="preview-price">' + esc(previewPrice(type, price)) + "</p></div></div>";
  }

  function previewPrice(type, price) {
    if (type === "giveaway") return "Free";
    if (type === "trade") return price ? "Trade · " + money(price) : "Trade";
    if (type === "wanted") return price ? "Up to " + money(price) : "Wanted";
    return price ? money(price) : "S$";
  }

  function threadList(activeId) {
    var me = activeUser();
    var threads = BBStore.threadsFor(me.id);
    if (!threads.length) {
      return '<div class="thread-list">' + emptyState("No messages yet", "When you message a neighbour about a listing, the conversation shows up here.", "#/feed", "Browse the feed") + "</div>";
    }
    return '<div class="thread-list" aria-label="Conversations">' + threads.map(function (thread) {
      var otherId = thread.participantIds.filter(function (id) { return id !== me.id; })[0];
      var other = BBStore.userById(otherId);
      var last = thread.messages[thread.messages.length - 1];
      var unread = BBStore.threadUnread(thread, me.id);
      var blocked = BBStore.blockedByMe(otherId);
      return '<a class="thread-item' + (thread.id === activeId ? " is-current" : "") + (unread ? " is-unread" : "") + '" href="#/messages/' + esc(thread.id) + '">' +
        "<strong>" + esc(other ? other.preferredName : "Neighbour") + (blocked ? " · Blocked" : "") + (unread ? " · Unread" : "") + "</strong>" +
        "<p>" + esc(last ? last.body : "No messages yet") + "</p></a>";
    }).join("") + "</div>";
  }

  function viewMessages() {
    var blocked = requireUser(true);
    if (blocked) return blocked;
    var failed = loadError("We couldn’t load messages");
    if (failed) return failed;
    if (ui.loading === "messages") {
      return "<h1>Messages</h1>" + skeletons(3);
    }
    var desktop = desktopInbox();
    var list = threadList(null);
    if (!desktop) return "<h1>Messages</h1>" + list;
    return "<h1>Messages</h1><div class=\"inbox\">" + list + '<div class="thread-pane"><div class="chat-head"><h2>Choose a conversation</h2><p>Private chats stay between you and one neighbour.</p></div></div></div>';
  }

  function viewThread(route) {
    var blocked = requireUser(true);
    if (blocked) return blocked;
    if (ui.loading === "thread") return "<h1>Chat</h1>" + skeletons(2);
    var me = activeUser();
    var thread = BBStore.threadById(route.id);
    if (!thread || thread.participantIds.indexOf(me.id) === -1) {
      return emptyState("That conversation is not available", "It may belong to another account on this device.", "#/messages", "Back to messages").replace("<h2>", "<h1>").replace("</h2>", "</h1>");
    }
    var otherId = thread.participantIds.filter(function (id) { return id !== me.id; })[0];
    var other = BBStore.userById(otherId);
    var listing = thread.listingId ? BBStore.listingById(thread.listingId) : null;
    var blockedByMe = BBStore.blockedByMe(otherId);
    var paused = BBStore.isBlocked(me.id, otherId);
    var bubbles = thread.messages.length
      ? thread.messages.map(function (message) {
        var mine = message.senderId === me.id;
        return '<div class="bubble' + (mine ? " bubble-mine" : "") + '"><p>' + esc(message.body) + "</p><time datetime=\"" + new Date(message.createdAt).toISOString() + "\">" + esc(timeAgo(message.createdAt)) + "</time></div>";
      }).join("")
      : '<p class="hint">Say hello. Keep unit numbers out of the chat.</p>';
    var composer = paused
      ? '<div class="composer"><p>' + (blockedByMe ? "You blocked this neighbour. Unblock to message again." : "Messaging is paused.") + "</p>" +
        (blockedByMe ? '<button type="button" class="btn btn-secondary" data-action="unblock" data-user="' + esc(otherId) + '">Unblock</button>' : "") + "</div>"
      : '<form class="composer" data-form="chat" data-thread="' + esc(thread.id) + '"><label class="sr-only" for="chat-body">Message</label><textarea id="chat-body" name="body" maxlength="1000" data-watch="chat" placeholder="Write a message">' + esc(ui.chatDraft || "") + '</textarea><button class="btn btn-primary" type="submit">Send</button></form>' +
        '<p id="chat-flag" class="field-error" hidden>Unit numbers stay off chat. Suggest the lobby, letterboxes or void deck instead.</p><p id="chat-error" class="field-error" hidden></p>';
    var pane = '<div class="thread-pane"><div class="chat-head"><a class="btn btn-ghost btn-small chat-back" href="#/messages">Back to messages</a>' +
      "<h1>" + esc(other ? other.preferredName : "Neighbour") + "</h1><p>" + esc(BBData.community.residentLabel) + "</p>" +
      (listing ? '<p><a href="#/listing/' + esc(listing.id) + '">About: ' + esc(listing.title) + "</a></p>" : "") +
      '<div class="row-actions"><button type="button" class="btn btn-secondary btn-small" data-action="open-report" data-type="member" data-id="' + esc(otherId) + '" data-label="' + esc(other ? other.preferredName : "this neighbour") + '">Report</button>' +
      (blockedByMe
        ? '<button type="button" class="btn btn-ghost btn-small" data-action="unblock" data-user="' + esc(otherId) + '">Unblock</button>'
        : '<button type="button" class="btn btn-ghost btn-small" data-action="ask-block" data-user="' + esc(otherId) + '" data-name="' + esc(other ? other.preferredName : "this neighbour") + '">Block</button>') +
      "</div></div><div class=\"transcript\" data-stick>" + bubbles + "</div>" + composer + "</div>";
    if (!desktopInbox()) return pane;
    return '<div class="inbox">' + threadList(thread.id) + pane + "</div>";
  }

  function viewProfile() {
    var blocked = requireUser(false);
    if (blocked) return blocked;
    var user = activeUser();
    var listings = BBStore.ownListings ? BBStore.ownListings() : BBStore.state().listings.filter(function (listing) {
      return listing.ownerId === user.id;
    }).sort(function (a, b) { return b.createdAt - a.createdAt; });
    var nameValue = Object.prototype.hasOwnProperty.call(ui.formValues, "preferredName") ? ui.formValues.preferredName : user.preferredName;
    var bioValue = Object.prototype.hasOwnProperty.call(ui.formValues, "bio") ? ui.formValues.bio : user.bio;
    var blocks = BBStore.myBlocks();
    var blockHtml = blocks.length
      ? "<ul>" + blocks.map(function (row) {
        var person = BBStore.userById(row.blockedId);
        return "<li>" + esc(person ? person.preferredName : "Neighbour") + ' <button type="button" class="btn btn-ghost btn-small" data-action="unblock" data-user="' + esc(row.blockedId) + '">Unblock</button></li>';
      }).join("") + "</ul>"
      : "<p>You have not blocked anyone.</p>";
    return '<div class="profile-top">' + avatar(user.preferredName, true) + "<div><p class=\"eyebrow\">Your profile</p><h1>" + esc(user.preferredName) + "</h1><p>" + esc(BBData.community.residentLabel) + "</p></div></div>" +
      '<p class="status-pill status-' + esc(user.verification.status) + '">' + esc(statusLabel(user.verification.status)) + '</p>' +
      '<p><a href="#/verify">Residence verification</a> · Neighbour since ' + esc(memberSince(user.createdAt)) + "</p>" +
      "<p>Neighbours see your preferred name and “" + esc(BBData.community.residentLabel) + "”. They do not see your email, documents or unit number.</p>" +
      '<section class="panel"><h2>Edit profile</h2>' + formAlert(ui.fieldErrors) +
      '<form data-form="profile" data-persist novalidate>' +
      '<div class="field"><label for="profile-name">Preferred name</label><input id="profile-name" name="preferredName" maxlength="60" required value="' + esc(nameValue) + '"' + (fieldError("preferredName") ? ' aria-invalid="true"' : "") + ">" + errorText("preferredName", "profile-name") + "</div>" +
      '<div class="field"><label for="profile-bio">Short bio</label><textarea id="profile-bio" name="bio" maxlength="240">' + esc(bioValue) + "</textarea><p class=\"hint\">Skip door numbers. A hobby or the kind of things you pass on is plenty.</p>" + errorText("bio", "profile-bio") + "</div>" +
      '<p class="hint">Sign-in email, only you see this: ' + esc(user.email) + "</p>" +
      '<div class="row-actions"><button class="btn btn-primary" type="submit">Save profile</button>' +
      (window.BBDemo ? "" : '<a class="btn btn-secondary" href="#/update-password">Change password</a>') +
      "</div></form></section>" +
      "<h2>Your listings</h2>" +
      (listings.length ? '<div class="grid-cards">' + listings.map(listingCard).join("") + "</div>" : emptyState("You have not posted yet", "Sell, give away, trade or ask for something your flat does not need.", "#/listing/new", "Post a listing")) +
      "<h2>Blocked neighbours</h2>" + blockHtml;
  }

  function viewMember(route) {
    var blocked = requireUser(true);
    if (blocked) return blocked;
    var me = activeUser();
    if (route.id === me.id) return viewProfile();
    var person = BBStore.userById(route.id);
    if (!person) return emptyState("Neighbour not found", "That profile is not part of the SkyPeak demo.", "#/feed", "Back to the feed").replace("<h2>", "<h1>").replace("</h2>", "</h1>");
    if (BBStore.blockedByMe(person.id)) {
      return '<section class="banner banner-warn"><h1>' + esc(person.preferredName) + " is blocked</h1><p>Their listings are hidden and chat is paused. They are not told.</p><button type=\"button\" class=\"btn btn-secondary\" data-action=\"unblock\" data-user=\"" + esc(person.id) + "\">Unblock</button></section>";
    }
    var listings = BBStore.visibleListings({ ownerId: person.id });
    return '<div class="profile-top">' + avatar(person.preferredName, true) + "<div><h1>" + esc(person.preferredName) + "</h1><p>" + esc(BBData.community.residentLabel) + "</p><p>Neighbour since " + esc(memberSince(person.createdAt)) + "</p></div></div>" +
      (person.bio ? "<p>" + esc(person.bio) + "</p>" : "") +
      '<div class="row-actions"><button type="button" class="btn btn-primary" data-action="message" data-user="' + esc(person.id) + '">Message</button>' +
      '<button type="button" class="btn btn-secondary" data-action="open-report" data-type="member" data-id="' + esc(person.id) + '" data-label="' + esc(person.preferredName) + '">Report</button>' +
      '<button type="button" class="btn btn-ghost" data-action="ask-block" data-user="' + esc(person.id) + '" data-name="' + esc(person.preferredName) + '">Block</button></div>' +
      "<h2>Listings</h2>" +
      (listings.length ? '<div class="grid-cards">' + listings.map(listingCard).join("") + "</div>" : "<p>No active listings right now.</p>");
  }

  function viewHelp() {
    var user = activeUser();
    var reports = user ? BBStore.myReports() : [];
    var reportForm = !user
      ? '<p><a class="btn btn-secondary" href="#/">Sign in to file a report</a></p>'
      : formAlert(ui.fieldErrors.reason || ui.fieldErrors.details ? ui.fieldErrors : {}) +
        '<form data-form="report-help" data-persist novalidate>' +
        '<div class="field"><label for="help-reason">Reason</label><select id="help-reason" name="reason">' + optionList(REPORT_REASONS, val("reason", ""), "Choose a reason") + "</select>" + errorText("reason", "help-reason") + "</div>" +
        '<div class="field"><label for="help-details">What happened</label><textarea id="help-details" name="details" maxlength="800">' + esc(val("details", "")) + "</textarea>" + errorText("details", "help-details") + "</div>" +
        '<button class="btn btn-primary" type="submit">' + (window.BBDemo ? "Save report on this device" : "Send report") + "</button></form>" +
        (reports.length
          ? "<h3>" + (window.BBDemo ? "Reports on this device" : "Reports you sent") + "</h3><ul>" + reports.map(function (report) {
            return "<li><strong>" + esc(report.reason) + "</strong> — " + esc(report.targetLabel || "General") + " · " + esc(timeAgo(report.createdAt)) + "</li>";
          }).join("") + "</ul>"
          : "<p>No reports saved on this device yet.</p>");
    return '<p class="eyebrow">Help and safety</p><h1>Keep it neighbourly</h1>' +
      '<nav class="help-nav" aria-label="On this page"><a href="#/help" data-action="jump" data-target="safety-how">How it works</a><a href="#/help" data-action="jump" data-target="safety-verify">Verification</a><a href="#/help" data-action="jump" data-target="safety-meet">Meeting</a><a href="#/help" data-action="jump" data-target="safety-report">Reporting</a><a href="#/help" data-action="jump" data-target="safety-block">Blocking</a></nav>' +
      '<div class="prose"><section id="safety-how"><h2>How BlockBuddy works</h2><p>Create an account, confirm you live at SkyPeak, then use the feed. You can sell, give something away, trade or post something you want. Message the neighbour in private.</p></section>' +
      '<section id="safety-verify"><h2>Verification and privacy</h2><p>Reviewers need your name and SkyPeak address. They do not need account numbers. Documents are private. Neighbours only see “' + esc(BBData.community.residentLabel) + '”.</p><p>' + (window.BBDemo ? "A live service would delete documents " + BBData.retentionDays + " days after a decision. Here, the preview stays in your browser." : "Documents are deleted " + BBData.retentionDays + " days after a decision.") + ' <a href="docs/index.html">How BlockBuddy works</a>.</p></section>' +
      "<section id=\"safety-meet\"><h2>Meeting safely</h2><ul><li>Meet at the void deck, lobby, letterboxes or a nearby mall.</li><li>Tell someone when you are heading down.</li><li>Look at the item before you pay, and pay in person.</li><li>If something feels wrong, leave.</li><li>Don’t put your unit number, NRIC or documents in a listing or chat. Patterns like #12-345 are blocked.</li></ul></section>" +
      '<section id="safety-report"><h2>Reporting</h2><p>Report a listing or a neighbour from that screen, or send a general note here. ' + (window.BBDemo ? "In this demo the report stays on your device." : "Reviewers can see it. Other neighbours cannot.") + "</p>" + reportForm + "</section>" +
      '<section id="safety-block"><h2>Blocking</h2><p>Blocking hides that neighbour’s listings and messages in both directions. They are not notified. You can unblock from your profile.</p><p><a href="#/profile">Open your profile</a></p></section></div>';
  }

  function adminStatusLinks(current) {
    var statuses = ["submitted", "under_review", "action_needed", "verified"];
    return '<div class="quick" aria-label="Submission filters">' + statuses.map(function (status) {
      var on = current === status;
      return '<a href="#/admin?tab=queue&status=' + status + '"' + (on ? ' aria-current="page"' : "") + ">" + esc(statusLabel(status)) + "</a>";
    }).join("") + "</div>";
  }

  function viewAdmin(route) {
    var user = activeUser();
    if (!user) return gate("sign-in");
    if (!user.isAdmin) {
      return emptyState("This page is for reviewers", "Verification status is changed by an admin, not from your own account.", "#/", "Back home").replace("<h2>", "<h1>").replace("</h2>", "</h1>");
    }
    if (ui.feedError) {
      return '<section class="banner banner-bad" role="alert"><h1>The queue didn’t load</h1><p>' + esc(ui.feedErrorMessage || "Try again.") + '</p><button type="button" class="btn btn-primary" data-action="retry-feed">Try again</button></section>';
    }
    if (ui.loading === "admin") {
      return "<h1>Reviewer queue</h1>" + skeletons(3);
    }
    var tab = route.params.get("tab") || "queue";
    var status = route.params.get("status") || "submitted";
    var tabs = '<div class="admin-tabs" role="tablist"><a class="btn btn-small ' + (tab === "queue" ? "btn-primary" : "btn-secondary") + '" href="#/admin?tab=queue&status=' + esc(status) + '">Documents</a>' +
      '<a class="btn btn-small ' + (tab === "reports" ? "btn-primary" : "btn-secondary") + '" href="#/admin?tab=reports">Reports</a>' +
      '<a class="btn btn-small ' + (tab === "audit" ? "btn-primary" : "btn-secondary") + '" href="#/admin?tab=audit">Audit log</a></div>';
    var body = "";
    if (tab === "reports") {
      var reports = BBStore.adminReports ? BBStore.adminReports() : [];
      body = reports.length ? reports.map(function (report) {
        var name = report.reporter && report.reporter.display_name ? report.reporter.display_name : "Member";
        return '<article class="panel admin-card"><p class="badge">' + esc(report.target_type) + "</p><h2>" + esc(report.reason) + "</h2><p>" + esc(report.target_label || "No label") + " · " + esc(name) + " · " + esc(timeAgo(Date.parse(report.created_at))) + "</p>" +
          (report.details ? "<p>" + esc(report.details) + "</p>" : "") +
          '<div class="row-actions"><button type="button" class="btn btn-primary" data-action="resolve-report" data-id="' + esc(report.id) + '">Resolve</button>' +
          (report.target_type === "listing" ? '<button type="button" class="btn btn-danger" data-action="hide-listing" data-id="' + esc(report.target_id) + '">Hide listing</button>' : "") +
          "</div></article>";
      }).join("") : emptyState("No open reports", "Listing and member reports land here.", "#/admin?tab=reports", "Refresh");
    } else if (tab === "audit") {
      var audit = BBStore.auditLog ? BBStore.auditLog() : [];
      body = audit.length ? '<ul class="queue">' + audit.map(function (row) {
        var name = row.admin && row.admin.display_name ? row.admin.display_name : "Admin";
        return "<li><strong>" + esc(row.action) + "</strong> · " + esc(name) + " · " + esc(timeAgo(Date.parse(row.created_at))) + "</li>";
      }).join("") + "</ul>" : emptyState("No admin actions yet", "Approvals, document opens, report resolutions and hidden listings are listed here.", "#/admin?tab=audit", "Refresh");
    } else {
      var queue = BBStore.adminSubmissions ? BBStore.adminSubmissions() : [];
      body = adminStatusLinks(status) + (queue.length ? queue.map(function (row) {
        var name = row.member && row.member.display_name ? row.member.display_name : "Member";
        return '<article class="panel admin-card"><p class="status-pill status-' + esc(row.status) + '">' + esc(statusLabel(row.status)) + "</p><h2>" + esc(name) + "</h2><p>" + esc(row.file_name || "document") + " · " + esc(timeAgo(Date.parse(row.submitted_at))) + "</p>" +
          (row.document_deleted_at ? "<p>The file was deleted after the retention period.</p>" : '<button type="button" class="btn btn-secondary" data-action="admin-open" data-id="' + esc(row.id) + '">Open document</button>') +
          (ui.docUrl && ui.docFor === row.id ? '<p><img class="doc-preview" alt="Redacted proof of address" src="' + safeImg(ui.docUrl) + '"></p>' : "") +
          '<div class="row-actions"><button type="button" class="btn btn-primary" data-action="admin-decide" data-id="' + esc(row.id) + '" data-status="verified">Approve</button>' +
          '<button type="button" class="btn btn-secondary" data-action="admin-decide" data-id="' + esc(row.id) + '" data-status="under_review">Mark under review</button></div>' +
          '<form data-form="admin-note" data-id="' + esc(row.id) + '"><div class="field"><label for="note-' + esc(row.id) + '">Action needed note</label><textarea id="note-' + esc(row.id) + '" name="note" maxlength="800" required placeholder="What should the member fix? Don’t include a unit number."></textarea></div><button class="btn btn-danger" type="submit">Action needed</button></form></article>';
      }).join("") : emptyState("Nothing in this filter", "New documents show up here as Submitted.", "#/admin?tab=queue&status=submitted", "Back to submitted"));
    }
    return '<p class="eyebrow">Reviewers</p><h1>Reviewer queue</h1><p>Check the name and SkyPeak address on the document. Unit numbers stay in the file and off the profile.</p>' + tabs + body;
  }

  function viewNotFound() {
    return emptyState("That page is not on the block", "Try the feed, or head home.", "#/", "Back home").replace("<h2>", "<h1>").replace("</h2>", "</h1>");
  }

  function view(route) {
    if (BBStore.booting && BBStore.booting() && !localPreview()) {
      return '<p class="eyebrow">SkyPeak @ Bukit Batok</p><h1>BlockBuddy</h1>' + skeletons(3);
    }
    if (route.name === "home") return viewHome();
    if (route.name === "register") return viewRegister();
    if (route.name === "verify") return viewVerify(route);
    if (route.name === "feed") return viewFeed();
    if (route.name === "search") return viewSearch(route);
    if (route.name === "listing") return viewListing(route);
    if (route.name === "edit") return viewEdit(route);
    if (route.name === "messages") return viewMessages();
    if (route.name === "thread") return viewThread(route);
    if (route.name === "profile") return viewProfile();
    if (route.name === "member") return viewMember(route);
    if (route.name === "help") return viewHelp();
    if (route.name === "forgot") return viewForgot();
    if (route.name === "update-password") return viewUpdatePassword();
    if (route.name === "admin") return viewAdmin(route);
    return viewNotFound();
  }

  function pageTitle(route) {
    var listing = route.name === "listing" || (route.name === "edit" && route.id) ? BBStore.listingById(route.id) : null;
    var names = {
      home: "Welcome",
      register: "Create account",
      verify: "Residence verification",
      feed: "Community feed",
      search: "Search",
      listing: listing ? listing.title : "Listing",
      edit: route.id ? "Edit listing" : "Post a listing",
      messages: "Messages",
      thread: "Chat",
      profile: "Your profile",
      member: "Neighbour",
      help: "Help and safety",
      forgot: "Reset password",
      "update-password": "New password",
      admin: "Reviewer queue",
      notfound: "Page not found"
    };
    return (names[route.name] || "BlockBuddy") + " · BlockBuddy";
  }

  function syncDoc(user) {
    if (!user) {
      docSession = blankDoc();
      return;
    }
    if (docSession.userId !== user.id) {
      docSession = {
        userId: user.id,
        dataUrl: user.verification.draftDataUrl || "",
        name: user.verification.draftName || "",
        rects: []
      };
    }
  }

  function cancelLoad() {
    loadToken += 1;
    ui.loading = null;
  }

  function queueLoad(which) {
    if (seen[which]) return;
    ui.loading = which;
    var token = ++loadToken;
    window.setTimeout(function () {
      if (token !== loadToken) return;
      seen[which] = true;
      if (ui.loading === which) ui.loading = null;
      render();
    }, 650);
  }

  function loadable(route) {
    return route.name === "feed" || route.name === "search" || route.name === "messages" || route.name === "thread" || route.name === "listing" || route.name === "edit" || route.name === "profile" || route.name === "member" || route.name === "verify" || route.name === "help" || route.name === "admin";
  }

  function onRouteEnter(route) {
    cancelLoad();
    ui.pendingEmail = route.name === "register" || route.name === "forgot" || route.name === "update-password" ? ui.pendingEmail : false;
    ui.chatDraft = "";
    ui.docUrl = "";
    var user = activeUser();
    if (window.BBDemo) {
      if ((route.name === "feed" || route.name === "search" || route.name === "messages") && verified(user) && !(route.name === "feed" && ui.feedError)) {
        queueLoad(route.name);
      }
      if (route.name === "thread" && user && user.id !== "preview") BBStore.markRead(route.id);
    } else if (loadable(route) && !(user && user.id === "preview")) {
      ui.loading = route.name;
      var token = ++loadToken;
      settle(BBStore.prepare(route)).then(function (result) {
        if (token !== loadToken) return;
        ui.loading = null;
        ui.feedError = !!(result && result.error);
        ui.feedErrorMessage = result && result.error ? result.error : "";
        ui.skipSnapshot = true;
        if (route.name === "edit") fillEditForm(route);
        render();
      }).catch(function () {
        if (token !== loadToken) return;
        ui.loading = null;
        ui.feedError = true;
        ui.feedErrorMessage = "We couldn’t load this page. Check your connection and try again.";
        render();
      });
    }
    if (window.BBDemo && route.name === "edit") fillEditForm(route);
    if (route.name === "verify") syncDoc(user);
  }

  function fillEditForm(route) {
    var user = activeUser();
    var listing = route.id ? BBStore.listingById(route.id) : null;
    if (listing && user && listing.ownerId === user.id) {
      ui.formValues = {
        type: listing.type,
        title: listing.title,
        category: listing.category,
        condition: listing.condition,
        price: listing.price == null ? "" : String(listing.price),
        description: listing.description
      };
      ui.photo = safeImg(listing.photo) || "";
    } else if (!route.id) {
      ui.formValues = { type: "sell", category: "home", condition: "Good", title: "", description: "", price: "" };
      ui.photo = "";
    }
  }

  function render() {
    var route = parseRoute();
    var hash = location.hash || "#/";
    var entered = hash !== ui.routeKey;
    if (!ui.skipSnapshot && !entered) snapshotForms();
    ui.skipSnapshot = false;
    if (entered) {
      ui.routeKey = hash;
      ui.menu = false;
      ui.filters = false;
      ui.fieldErrors = {};
      ui.focusH1 = true;
      ui.formValues = {};
      ui.photo = "";
      ui.uploadError = false;
      onRouteEnter(route);
    }
    var app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = shell(route, view(route));
    document.title = pageTitle(route);
    var user = activeUser();
    document.body.classList.toggle("has-tabs", !!user);
    document.body.classList.toggle("in-thread", route.name === "thread");
    afterRender(route, entered);
  }

  function afterRender(route, entered) {
    var dialogOpen = !!(ui.reviewer || ui.confirm || ui.report || (ui.filters && !desktopFilters()));
    document.querySelectorAll("[data-inert-when-dialog]").forEach(function (el) {
      if (dialogOpen) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
    mountRedactor();
    syncTypeFields();
    var log = document.querySelector("[data-stick]");
    if (log) log.scrollTop = log.scrollHeight;
    if (ui.announceToast && ui.toast) {
      announce(ui.toast);
      ui.announceToast = false;
    }
    if (ui.focusError) {
      var alert = document.querySelector(".form-alert");
      var invalid = document.querySelector("[aria-invalid='true']");
      if (alert) alert.focus();
      else if (invalid) invalid.focus();
      ui.focusError = false;
      ui.focusH1 = false;
    } else if (ui.focusMenu) {
      var first = document.querySelector("#site-menu a, #site-menu button");
      if (first) first.focus();
      ui.focusMenu = false;
    } else if (ui.focusChat) {
      var box = document.getElementById("chat-body");
      if (box) box.focus();
      ui.focusChat = false;
    } else if (document.querySelector("[data-dialog]")) {
      var dialog = document.querySelector("[data-dialog]");
      var auto = dialog.querySelector("[data-autofocus], button, input, select, textarea, a");
      if (auto && entered || auto && !entered && document.activeElement === document.body) {
        if (auto) auto.focus();
      }
    } else if (entered && ui.focusH1) {
      var heading = document.querySelector("#main h1");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
        announce(heading.textContent);
      }
      ui.focusH1 = false;
      window.scrollTo(0, 0);
    }
    if (ui.returnFocus) {
      var back = document.querySelector(ui.returnFocus);
      if (back) back.focus();
      ui.returnFocus = "";
    }
  }

  function syncTypeFields() {
    var checked = document.querySelector('input[name="type"]:checked');
    if (!checked) return;
    var type = checked.value;
    var price = document.getElementById("price-field");
    var label = document.getElementById("price-label");
    var condition = document.getElementById("condition-field");
    if (price) price.hidden = type === "giveaway";
    if (condition) condition.hidden = type === "wanted";
    if (label) {
      label.textContent = type === "wanted" ? "Budget (S$)" : type === "trade" ? "Cash difference, if any (S$)" : "Price (S$)";
    }
  }

  function updatePreview() {
    var title = document.getElementById("listing-title");
    var price = document.getElementById("listing-price");
    var typeEl = document.querySelector('input[name="type"]:checked');
    var previewTitle = document.getElementById("preview-title");
    var previewPriceEl = document.getElementById("preview-price");
    var flag = document.getElementById("privacy-flag");
    var description = document.getElementById("listing-description");
    if (previewTitle && title) previewTitle.textContent = title.value || "Listing title";
    if (previewPriceEl && typeEl) previewPriceEl.textContent = previewPrice(typeEl.value, price ? price.value : "");
    if (flag && title && description) flag.hidden = !BBPrivacy.containsUnitNumber(title.value + "\n" + description.value);
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("nofile"));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error("size"));
        return;
      }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        reject(new Error("type"));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("read")); };
      reader.readAsDataURL(file);
    });
  }

  function downscale(dataUrl, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxW / img.width);
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = function () { reject(new Error("image")); };
      img.src = dataUrl;
    });
  }

  function sampleBill() {
    var user = activeUser();
    var name = user ? user.preferredName : "Alex Tan";
    var canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1140;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 900, 1140);
    ctx.fillStyle = "#0F6B50";
    ctx.fillRect(0, 0, 900, 150);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 42px Georgia, serif";
    ctx.fillText("SP Utilities", 48, 78);
    ctx.font = "24px sans-serif";
    ctx.fillText("SAMPLE BILL — not a real account", 48, 118);
    ctx.fillStyle = "#fdecec";
    ctx.fillRect(40, 210, 520, 90);
    ctx.fillStyle = "#172824";
    ctx.font = "700 22px sans-serif";
    ctx.fillText("Account number", 48, 240);
    ctx.font = "34px sans-serif";
    ctx.fillStyle = "#9E2B25";
    ctx.fillText("8392 1104 2261", 48, 282);
    ctx.fillStyle = "#172824";
    ctx.font = "700 22px sans-serif";
    ctx.fillText("Name", 48, 370);
    ctx.font = "32px sans-serif";
    ctx.fillText(name, 48, 416);
    ctx.font = "700 22px sans-serif";
    ctx.fillText("Service address", 48, 500);
    ctx.font = "32px sans-serif";
    ctx.fillText("SkyPeak @ Bukit Batok", 48, 546);
    ctx.fillText("#08-112", 48, 594);
    ctx.font = "22px sans-serif";
    ctx.fillStyle = "#3c514a";
    ctx.fillText("Amount due   S$86.40", 48, 690);
    ctx.fillText("Cover the account number.", 48, 770);
    ctx.fillText("Leave your name and address visible for review.", 48, 810);
    ctx.fillText("Neighbours never see this document.", 48, 850);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function updateRedactCount() {
    var count = document.getElementById("redact-count");
    if (count) count.textContent = docSession.rects.length ? docSession.rects.length + " area(s) covered." : "No areas covered yet.";
  }

  function mountRedactor() {
    var canvas = document.getElementById("redact-canvas");
    if (!canvas || !docSession.dataUrl) return;
    var ctx = canvas.getContext("2d");
    var img = new Image();
    var drag = null;
    function redraw(temp) {
      if (!img.naturalWidth) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(23, 40, 36, 0.94)";
      docSession.rects.forEach(function (rect) {
        ctx.fillRect(rect.x * canvas.width, rect.y * canvas.height, rect.w * canvas.width, rect.h * canvas.height);
      });
      if (temp) ctx.fillRect(temp.x * canvas.width, temp.y * canvas.height, temp.w * canvas.width, temp.h * canvas.height);
    }
    function box(a, b) {
      return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(a.x - b.x),
        h: Math.abs(a.y - b.y)
      };
    }
    function point(event) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      };
    }
    img.onload = function () {
      var scale = Math.min(1, 1000 / img.width);
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.__ready = true;
      redraw();
    };
    canvas.addEventListener("pointerdown", function (event) {
      if (!canvas.__ready) return;
      canvas.setPointerCapture(event.pointerId);
      var start = point(event);
      drag = { start: start, current: start };
      event.preventDefault();
    });
    canvas.addEventListener("pointermove", function (event) {
      if (!drag) return;
      drag.current = point(event);
      redraw(box(drag.start, drag.current));
    });
    function finish() {
      if (!drag) return;
      var rect = box(drag.start, drag.current);
      drag = null;
      if (rect.w > 0.015 && rect.h > 0.015) docSession.rects.push(rect);
      redraw();
      updateRedactCount();
    }
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.__api = {
      add: function () {
        var offset = docSession.rects.length;
        docSession.rects.push({ x: 0.05, y: Math.min(0.72, 0.18 + offset * 0.1), w: 0.62, h: 0.08 });
        redraw();
        updateRedactCount();
      },
      undo: function () {
        docSession.rects.pop();
        redraw();
        updateRedactCount();
      },
      clear: function () {
        docSession.rects = [];
        redraw();
        updateRedactCount();
      }
    };
    img.src = docSession.dataUrl;
  }

  function exportRedacted() {
    var canvas = document.getElementById("redact-canvas");
    if (!canvas || !canvas.__ready) return docSession.dataUrl || "";
    try {
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch (err) {
      return docSession.dataUrl || "";
    }
  }

  function beginUpload() {
    if (ui.uploading) return;
    if (!docSession.dataUrl) {
      ui.fieldErrors = { proof: "Choose a photo, or use the sample bill." };
      ui.focusError = true;
      render();
      return;
    }
    ui.pendingDoc = {
      name: docSession.name || "document.jpg",
      dataUrl: exportRedacted() || docSession.dataUrl
    };
    ui.uploading = true;
    ui.uploadError = false;
    var token = ++ui.uploadToken;
    render();
    var wait = window.BBDemo ? new Promise(function (resolve) { window.setTimeout(resolve, 700); }) : Promise.resolve();
    wait.then(function () {
      if (token !== ui.uploadToken) return null;
      if (window.BBDemo && ui.failNext) {
        ui.failNext = false;
        ui.uploading = false;
        ui.uploadError = true;
        ui.uploadErrorMessage = "The upload did not go through. Nothing left this browser — your preview is still here.";
        render();
        return null;
      }
      return settle(BBStore.submitDocument(ui.pendingDoc));
    }).then(function (result) {
      if (!result || token !== ui.uploadToken) return;
      ui.uploading = false;
      if (!result.ok) {
        ui.uploadError = true;
        ui.uploadErrorMessage = result.error || "The upload did not go through. Try again.";
        render();
        return;
      }
      docSession.dataUrl = "";
      docSession.name = "";
      docSession.rects = [];
      ui.pendingDoc = null;
      ui.routeKey = null;
      render();
    }).catch(function () {
      if (token !== ui.uploadToken) return;
      ui.uploading = false;
      ui.uploadError = true;
      ui.uploadErrorMessage = "The upload did not go through. Your preview is still here.";
      render();
    });
  }

  function ensureVerifiedForPreview() {
    var user = activeUser();
    if (!user) {
      ui.reviewerNote = "Sign in first, or continue as the demo neighbour.";
      render();
      return false;
    }
    if (!verified(user)) {
      ui.reviewerNote = "Set the status to Verified to open the feed and inbox.";
      render();
      return false;
    }
    ui.reviewerNote = "";
    return true;
  }

  function go(hash) {
    if ((location.hash || "#/") === hash) {
      ui.routeKey = null;
      render();
    } else {
      location.hash = hash;
    }
  }

  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function onSubmit(event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    var kind = form.dataset.form;
    var route = parseRoute();
    if (kind === "search") {
      var q = String(new FormData(form).get("q") || "").trim();
      var searchParams = route.name === "search" ? new URLSearchParams(route.params) : new URLSearchParams();
      if (q) searchParams.set("q", q);
      else searchParams.delete("q");
      var nextSearch = "#/search" + (searchParams.toString() ? "?" + searchParams.toString() : "");
      if ((location.hash || "#/") === nextSearch) render();
      else location.hash = nextSearch;
      return;
    }
    if (kind === "filters") {
      var data = new FormData(form);
      var params = new URLSearchParams();
      ["q", "category", "type", "min", "max"].forEach(function (key) {
        var value = String(data.get(key) || "").trim();
        if (value) params.set(key, value);
      });
      if (data.get("free")) params.set("free", "1");
      if (params.get("min") && params.get("max") && Number(params.get("min")) > Number(params.get("max"))) {
        var err = document.getElementById("price-filter-error");
        if (err) {
          err.hidden = false;
          err.textContent = "Minimum price is higher than the maximum.";
        }
        return;
      }
      ui.filters = false;
      var nextFilters = "#/search" + (params.toString() ? "?" + params.toString() : "");
      if ((location.hash || "#/") === nextFilters) render();
      else location.hash = nextFilters;
      return;
    }
    if (kind === "sign-in") {
      var sign = new FormData(form);
      var signEmail = String(sign.get("email") || "").trim();
      var signPassword = String(sign.get("password") || "");
      var signErrors = {};
      if (!emailOk(signEmail)) signErrors.email = "Enter the email on the account.";
      if (!signPassword) signErrors.password = "Enter the password.";
      if (Object.keys(signErrors).length) return showErrors({ email: signEmail }, signErrors);
      settle(BBStore.signIn(signEmail, signPassword)).then(function (signed) {
        if (!signed.ok) return showErrors({ email: signEmail }, { email: signed.error });
        location.hash = verified(signed.user) ? "#/feed" : "#/verify";
      });
      return;
    }
    if (kind === "forgot") {
      var forgot = new FormData(form);
      var forgotEmail = String(forgot.get("email") || "").trim();
      if (!emailOk(forgotEmail)) return showErrors({ email: forgotEmail }, { email: "Enter the email on the account." });
      settle(BBStore.requestReset(forgotEmail)).then(function (result) {
        if (!result.ok) return showErrors({ email: forgotEmail }, { email: result.error });
        ui.pendingEmail = true;
        ui.fieldErrors = {};
        render();
      });
      return;
    }
    if (kind === "update-password") {
      var nextPassword = String(new FormData(form).get("password") || "");
      var nextConfirm = String(new FormData(form).get("confirm") || "");
      var passwordErrors = {};
      if (nextPassword.length < 8) passwordErrors.password = "Use at least 8 characters.";
      if (nextPassword !== nextConfirm) passwordErrors.confirm = "Those passwords don’t match.";
      if (Object.keys(passwordErrors).length) return showErrors({}, passwordErrors);
      settle(BBStore.updatePassword(nextPassword)).then(function (result) {
        if (!result.ok) return showErrors({}, { password: result.error });
        ui.pendingEmail = true;
        ui.fieldErrors = {};
        toast("Password updated.");
      });
      return;
    }
    if (kind === "admin-note") {
      var note = String(new FormData(form).get("note") || "").trim();
      if (!note) return toast("Write a note before marking action needed.");
      if (BBPrivacy.containsUnitNumber(note)) return toast("Take the unit number out of the note.");
      settle(BBStore.adminReview(form.dataset.id, "action_needed", note)).then(function (result) {
        if (!result.ok) return toast(result.error);
        ui.routeKey = null;
        toast("The member will see that note.");
        render();
      });
      return;
    }
    if (kind === "register") {
      var reg = new FormData(form);
      var preferredName = String(reg.get("preferredName") || "").trim();
      var regEmail = String(reg.get("email") || "").trim();
      var password = String(reg.get("password") || "");
      var confirm = String(reg.get("confirm") || "");
      var errors = {};
      if (preferredName.length < 2) errors.preferredName = "Use at least 2 characters for your preferred name.";
      if (BBPrivacy.containsUnitNumber(preferredName)) errors.preferredName = "Leave unit numbers off your name.";
      if (!emailOk(regEmail)) errors.email = "Enter a valid email address.";
      if (password.length < 8) errors.password = "Use at least 8 characters.";
      if (password !== confirm) errors.confirm = "Those passwords don’t match.";
      if (!form.querySelector('[name="resident"]').checked) errors.resident = "Confirm that you live at SkyPeak @ Bukit Batok.";
      if (!form.querySelector('[name="guidelines"]').checked) errors.guidelines = "Agree to the community guidelines to join.";
      var values = { preferredName: preferredName, email: regEmail, resident: form.querySelector('[name="resident"]').checked ? "on" : "", guidelines: form.querySelector('[name="guidelines"]').checked ? "on" : "" };
      if (Object.keys(errors).length) return showErrors(values, errors);
      settle(BBStore.register({ preferredName: preferredName, email: regEmail, password: password })).then(function (created) {
        if (!created.ok) return showErrors(values, { email: created.error });
        docSession = blankDoc();
        if (created.pending) {
          ui.pendingEmail = true;
          ui.fieldErrors = {};
          ui.formValues = {};
          render();
          return;
        }
        location.hash = "#/verify?welcome=1";
      });
      return;
    }
    if (kind === "verify") {
      beginUpload();
      return;
    }
    if (kind === "listing") {
      submitListing(form);
      return;
    }
    if (kind === "chat") {
      submitChat(form);
      return;
    }
    if (kind === "profile") {
      submitProfile(form);
      return;
    }
    if (kind === "report" || kind === "report-help") {
      submitReport(form, kind === "report-help");
    }
  }

  function submitListing(form) {
    var data = new FormData(form);
    var type = String(data.get("type") || "sell");
    var title = String(data.get("title") || "").trim();
    var description = String(data.get("description") || "").trim();
    var category = String(data.get("category") || "other");
    var condition = type === "wanted" ? "Any" : String(data.get("condition") || "Good");
    var priceRaw = String(data.get("price") || "").trim();
    var errors = {};
    if (title.length < 4) errors.title = "Give the listing a title of at least 4 characters.";
    if (description.length < 10) errors.description = "Add a short description, at least 10 characters.";
    if (BBPrivacy.containsUnitNumber(title + "\n" + description)) errors.privacy = "Remove the unit number before posting.";
    var price = null;
    if (type === "giveaway") price = 0;
    else if (priceRaw === "") {
      if (type === "sell") errors.price = "Enter a price, or choose Give away.";
    } else {
      price = Number(priceRaw);
      if (!Number.isFinite(price) || price < 0 || price > 100000) errors.price = "Enter a price from 0 to 100000.";
    }
    var values = { type: type, title: title, description: description, category: category, condition: condition, price: priceRaw };
    if (Object.keys(errors).length) return showErrors(values, errors);
    var existing = data.get("id") ? BBStore.listingById(String(data.get("id"))) : null;
    var art = existing && existing.category === category ? existing.art : (ART_FOR[category] || "other");
    settle(BBStore.saveListing({
      id: existing ? existing.id : null,
      type: type,
      title: title,
      description: description,
      category: category,
      condition: condition,
      price: price,
      art: art,
      photo: ui.photo && ui.photo.indexOf("data:image/") === 0 ? ui.photo : "",
      clearPhoto: !ui.photo && !!(existing && existing.photoPath)
    })).then(function (saved) {
      if (!saved.ok) return showErrors(values, { title: saved.error });
      var suffix = existing ? "?updated=1" : "?posted=1";
      location.hash = "#/listing/" + saved.listing.id + suffix;
      if (saved.warning) toast(saved.warning);
    });
  }

  function submitChat(form) {
    var body = String(new FormData(form).get("body") || "").trim();
    var flag = document.getElementById("chat-flag");
    var err = document.getElementById("chat-error");
    if (!body) {
      if (err) {
        err.hidden = false;
        err.textContent = "Write a message first.";
      }
      return;
    }
    if (BBPrivacy.containsUnitNumber(body)) {
      if (flag) flag.hidden = false;
      if (err) {
        err.hidden = false;
        err.textContent = "Unit numbers stay off chat. Suggest the lobby, letterboxes or void deck instead.";
      }
      return;
    }
    settle(BBStore.sendMessage(form.dataset.thread, body)).then(function (result) {
      if (!result.ok) {
        if (err) {
          err.hidden = false;
          err.textContent = result.error;
        }
        return;
      }
      ui.chatDraft = "";
      ui.focusChat = true;
      ui.skipSnapshot = true;
      render();
    });
  }

  function submitProfile(form) {
    var data = new FormData(form);
    var name = String(data.get("preferredName") || "").trim();
    var bio = String(data.get("bio") || "").trim();
    var errors = {};
    if (name.length < 2) errors.preferredName = "Use at least 2 characters.";
    if (BBPrivacy.containsUnitNumber(name) || BBPrivacy.containsUnitNumber(bio)) {
      errors.bio = "Unit numbers stay off your profile. Neighbours only see that you live at SkyPeak.";
    }
    if (Object.keys(errors).length) return showErrors({ preferredName: name, bio: bio }, errors);
    settle(BBStore.updateProfile({ preferredName: name, bio: bio })).then(function (result) {
      if (!result.ok) return showErrors({ preferredName: name, bio: bio }, { bio: result.error });
      ui.formValues = {};
      toast("Profile saved.");
    });
  }

  function submitReport(form, general) {
    var data = new FormData(form);
    var reason = String(data.get("reason") || "");
    var details = String(data.get("details") || "").trim();
    var errors = {};
    if (!reason) errors.reason = "Choose a reason.";
    if (BBPrivacy.containsUnitNumber(details)) errors.details = "Take unit numbers out of the report. Moderators would not need them in the note.";
    if (Object.keys(errors).length) {
      if (general) return showErrors({ reason: reason, details: details }, errors);
      ui.fieldErrors = errors;
      ui.report.error = errors.reason || errors.details;
      render();
      return;
    }
    settle(BBStore.addReport({
      targetType: general ? "general" : ui.report.targetType,
      targetId: general ? "" : ui.report.targetId,
      targetLabel: general ? "General safety note" : ui.report.targetLabel,
      reason: reason,
      details: details
    })).then(function (result) {
      if (!result.ok) {
        if (general) return showErrors({ reason: reason, details: details }, { reason: result.error });
        ui.report.error = result.error;
        render();
        return;
      }
      ui.fieldErrors = {};
      ui.formValues = {};
      if (general) toast(window.BBDemo ? "Report saved on this device." : "Report sent to reviewers.");
      else {
        ui.report.done = true;
        render();
      }
    });
  }

  function onClick(event) {
    var actionEl = event.target.closest("[data-action]");
    if (ui.menu && !event.target.closest(".menu")) {
      ui.menu = false;
      if (!actionEl) {
        render();
        return;
      }
    }
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    if (action === "jump") event.preventDefault();
    if (action === "toggle-menu") {
      ui.menu = !ui.menu;
      ui.focusMenu = ui.menu;
      render();
      return;
    }
    if (action === "toggle-password") {
      var input = document.getElementById(actionEl.getAttribute("aria-controls"));
      if (!input) return;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      actionEl.setAttribute("aria-pressed", show ? "true" : "false");
      actionEl.textContent = show ? "Hide" : "Show";
      return;
    }
    if (action === "jump") {
      var target = document.getElementById(actionEl.dataset.target);
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.scrollIntoView();
        target.focus();
      }
      return;
    }
    if (action === "reviewer") {
      ui.reviewer = true;
      ui.reviewerNote = "";
      ui.returnFocus = "";
      render();
      return;
    }
    if (action === "close-dialog") {
      var inside = event.target.closest(".dialog, .filters");
      if (inside && !event.target.closest("[data-close]") && actionEl.classList.contains("backdrop")) return;
      if (inside && event.target.closest(".dialog") && !event.target.closest("[data-close]")) return;
      ui.reviewer = false;
      ui.confirm = null;
      ui.report = null;
      ui.filters = false;
      ui.returnFocus = "[data-action='reviewer']";
      render();
      return;
    }
    if (action === "close-filters" || (action === "close-dialog" && ui.filters)) {
      ui.filters = false;
      ui.returnFocus = "[data-action='open-filters']";
      render();
      return;
    }
    if (action === "sign-in-demo") {
      var demo = BBStore.signInDemo();
      docSession = blankDoc();
      ui.reviewerNote = "";
      if (!demo.ok) return;
      if (ui.reviewer) render();
      else location.hash = "#/feed";
      return;
    }
    if (action === "sign-out") {
      settle(BBStore.signOut()).then(function () {
        docSession = blankDoc();
        ui.menu = false;
        if ((location.hash || "#/") !== "#/") location.hash = "#/";
        toast(window.BBDemo ? "Signed out. Demo data is still on this device." : "Signed out.");
      });
      return;
    }
    if (action === "ask-reset") {
      ui.reviewer = false;
      ui.confirm = {
        title: "Reset the demo?",
        body: "This clears accounts, listings, messages, reports and blocks saved in this browser, then restores the SkyPeak sample data.",
        confirmLabel: "Reset demo",
        danger: true,
        run: function () {
          BBStore.reset();
          docSession = blankDoc();
          seen = { feed: false, search: false, messages: false };
          ui.feedError = false;
          ui.failNext = false;
          location.hash = "#/";
          toast("Demo data restored.");
        }
      };
      render();
      return;
    }
    if (action === "confirm-yes") {
      var run = ui.confirm && ui.confirm.run;
      ui.confirm = null;
      if (run) run();
      else render();
      return;
    }
    if (action === "play-loading") {
      if (!ensureVerifiedForPreview()) return;
      var which = actionEl.dataset.which || "feed";
      seen[which] = false;
      ui.feedError = false;
      ui.reviewer = false;
      go(which === "messages" ? "#/messages" : which === "search" ? "#/search" : "#/feed");
      return;
    }
    if (action === "show-feed-error") {
      if (!ensureVerifiedForPreview()) return;
      ui.feedError = true;
      ui.reviewer = false;
      seen.feed = true;
      go("#/feed");
      return;
    }
    if (action === "retry-feed") {
      ui.feedError = false;
      ui.feedErrorMessage = "";
      seen[parseRoute().name] = false;
      ui.routeKey = null;
      render();
      return;
    }
    if (action === "open-filters") {
      ui.filters = true;
      render();
      var sheet = document.getElementById("filter-form");
      if (sheet) {
        var focus = sheet.querySelector("input, select, button");
        if (focus) focus.focus();
      }
      return;
    }
    if (action === "clear-filters") {
      ui.filters = false;
      if ((location.hash || "#/") === "#/search") render();
      else location.hash = "#/search";
      return;
    }
    if (action === "remove-chip") {
      var key = actionEl.dataset.key;
      var current = new URLSearchParams((location.hash.split("?")[1] || ""));
      current.delete(key);
      var next = "#/search" + (current.toString() ? "?" + current.toString() : "");
      location.hash = next;
      return;
    }
    if (action === "use-sample") {
      var user = activeUser();
      if (!user) return;
      docSession.userId = user.id;
      docSession.dataUrl = sampleBill();
      docSession.name = "sample-bill.jpg";
      docSession.rects = [];
      ui.uploadError = false;
      var stored = BBStore.saveDraft({ dataUrl: docSession.dataUrl, name: docSession.name });
      render();
      if (!stored.ok) toast("The sample is on screen. This browser could not store a copy.");
      return;
    }
    if (action === "preview-upload-error") {
      ui.uploadError = true;
      ui.uploadErrorMessage = "The upload did not go through. Nothing left this browser. Your preview is still here if you chose one.";
      render();
      return;
    }
    if (action === "retry-upload") {
      ui.uploadError = false;
      if (!docSession.dataUrl && !(ui.pendingDoc && ui.pendingDoc.dataUrl)) {
        render();
        var proof = document.getElementById("proof");
        if (proof) proof.focus();
        return;
      }
      if (!docSession.dataUrl && ui.pendingDoc) {
        docSession.dataUrl = ui.pendingDoc.dataUrl;
        docSession.name = ui.pendingDoc.name;
      }
      beginUpload();
      return;
    }
    if (action === "add-redact" || action === "undo-redact" || action === "clear-redact") {
      var canvas = document.getElementById("redact-canvas");
      if (canvas && canvas.__api) {
        if (action === "add-redact") canvas.__api.add();
        if (action === "undo-redact") canvas.__api.undo();
        if (action === "clear-redact") canvas.__api.clear();
      }
      return;
    }
    if (action === "clear-photo") {
      ui.photo = "";
      render();
      return;
    }
    if (action === "message") {
      var otherId = actionEl.dataset.user;
      var me = activeUser();
      if (!me || !verified(me)) return;
      if (BBStore.isBlocked(me.id, otherId)) {
        toast("Unblock this neighbour before messaging.");
        return;
      }
      settle(BBStore.ensureThread(otherId, actionEl.dataset.listing || null)).then(function (thread) {
        if (thread) location.hash = "#/messages/" + thread.id;
        else toast("Messaging isn’t available with this neighbour.");
      });
      return;
    }
    if (action === "open-report") {
      ui.report = {
        targetType: actionEl.dataset.type,
        targetId: actionEl.dataset.id,
        targetLabel: actionEl.dataset.label,
        done: false,
        error: ""
      };
      ui.fieldErrors = {};
      render();
      return;
    }
    if (action === "ask-block") {
      var blockId = actionEl.dataset.user;
      var blockName = actionEl.dataset.name || "this neighbour";
      ui.confirm = {
        title: "Block " + blockName + "?",
        body: "Their listings will disappear from your feed and chat will pause. They are not told that you blocked them.",
        confirmLabel: "Block",
        danger: true,
        run: function () {
          settle(BBStore.blockUser(blockId)).then(function (result) {
            if (result && result.ok === false) return toast(result.error || "Could not block that neighbour.");
            toast("Blocked. You can undo this from your profile.");
          });
        }
      };
      render();
      return;
    }
    if (action === "unblock") {
      settle(BBStore.unblockUser(actionEl.dataset.user)).then(function () {
        toast("Unblocked.");
      });
      return;
    }
    if (action === "mark-taken") {
      settle(BBStore.setListingStatus(actionEl.dataset.id, "taken")).then(function (result) {
        if (result && result.ok === false) return toast(result.error);
        toast("Marked as taken. It leaves the feed and stays on your profile.");
      });
      return;
    }
    if (action === "relist") {
      settle(BBStore.setListingStatus(actionEl.dataset.id, "active")).then(function (result) {
        if (result && result.ok === false) return toast(result.error);
        toast("Back on the SkyPeak feed.");
      });
      return;
    }
    if (action === "view-own-doc") {
      settle(BBStore.ownDocumentUrl(actionEl.dataset.path)).then(function (url) {
        var safe = safeImg(url);
        if (!safe) return toast("That file isn’t available.");
        ui.docUrl = safe;
        ui.docFor = "own";
        render();
      });
      return;
    }
    if (action === "admin-open") {
      settle(BBStore.adminOpen(actionEl.dataset.id)).then(function (result) {
        if (!result.ok) return toast(result.error);
        var safe = safeImg(result.url);
        if (!safe) return toast("That file isn’t available.");
        ui.docUrl = safe;
        ui.docFor = actionEl.dataset.id;
        render();
      });
      return;
    }
    if (action === "admin-decide") {
      settle(BBStore.adminReview(actionEl.dataset.id, actionEl.dataset.status, null)).then(function (result) {
        if (!result.ok) return toast(result.error);
        ui.routeKey = null;
        toast(actionEl.dataset.status === "verified" ? "Member verified." : "Marked under review.");
        render();
      });
      return;
    }
    if (action === "resolve-report") {
      settle(BBStore.adminResolve(actionEl.dataset.id, "")).then(function (result) {
        if (!result.ok) return toast(result.error);
        ui.routeKey = null;
        toast("Report resolved.");
        render();
      });
      return;
    }
    if (action === "hide-listing") {
      settle(BBStore.adminHide(actionEl.dataset.id)).then(function (result) {
        if (!result.ok) return toast(result.error);
        toast("Listing hidden from the community.");
      });
      return;
    }
    if (action === "ask-delete") {
      var deleteId = actionEl.dataset.id;
      ui.confirm = {
        title: "Delete this listing?",
        body: "It will disappear from the feed and from your profile on this device.",
        confirmLabel: "Delete listing",
        danger: true,
        run: function () {
          settle(BBStore.deleteListing(deleteId)).then(function (result) {
            if (result && result.ok === false) return toast(result.error || "Could not delete that listing.");
            location.hash = "#/profile";
            toast("Listing deleted.");
          });
        }
      };
      render();
    }
  }

  function onInput(event) {
    var target = event.target;
    if (target.dataset && target.dataset.watch === "listing") updatePreview();
    if (target.dataset && target.dataset.watch === "chat") {
      ui.chatDraft = target.value;
      var flag = document.getElementById("chat-flag");
      if (flag) flag.hidden = !BBPrivacy.containsUnitNumber(target.value);
    }
  }

  function onChange(event) {
    var target = event.target;
    if (target.name === "type") {
      syncTypeFields();
      updatePreview();
    }
    if (target.name === "category") {
      var art = document.querySelector(".preview-card .art");
      if (art && !ui.photo) {
        art.className = "art art-" + safeCat(target.value);
        art.innerHTML = BBArt.svg(ART_FOR[target.value] || "other");
      }
    }
    if (target.name === "reviewer-status") {
      var result = BBStore.setVerificationStatus(target.value);
      ui.reviewerNote = result.ok ? "" : result.error;
      ui.reviewer = true;
      render();
      return;
    }
    if (target.name === "fail-next") ui.failNext = target.checked;
    if (target.id === "proof") {
      if (!target.files || !target.files[0]) return;
      readFile(target.files[0]).then(function (url) {
        return downscale(url, 1000, 0.72);
      }).then(function (url) {
        var user = activeUser();
        docSession.userId = user ? user.id : null;
        docSession.dataUrl = url;
        docSession.name = target.files[0].name;
        docSession.rects = [];
        ui.uploadError = false;
        ui.fieldErrors = {};
        BBStore.saveDraft({ dataUrl: url, name: docSession.name });
        render();
      }).catch(function (err) {
        if (err.message === "nofile") return;
        ui.uploadError = true;
        ui.uploadErrorMessage = err.message === "size"
          ? "That file is over 8 MB. Choose a smaller photo and try again."
          : err.message === "type"
            ? "Use a JPG, PNG, WEBP or GIF. PDFs stay on your device so the redaction can be burned into the picture before upload."
            : "That photo could not be read. Try a different file.";
        render();
      });
    }
    if (target.id === "listing-photo") {
      if (!target.files || !target.files[0]) return;
      readFile(target.files[0]).then(function (url) {
        return downscale(url, 800, 0.7);
      }).then(function (url) {
        ui.photo = url;
        delete ui.fieldErrors.photo;
        render();
      }).catch(function (err) {
        ui.fieldErrors = { photo: err.message === "size" ? "That photo is over 8 MB." : "Use a JPG, PNG, WEBP or GIF." };
        ui.focusError = true;
        render();
      });
    }
  }

  function trap(dialog, event) {
      var nodes = dialog.querySelectorAll("a, button, input, select, textarea");
      var list = [];
      nodes.forEach(function (node) {
        if (!node.disabled && node.getClientRects().length) list.push(node);
      });
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeydown(event) {
      if (event.key === "Escape") {
      if (ui.confirm || ui.report || ui.reviewer || ui.filters || ui.menu) {
        var back = "[data-action='toggle-menu']";
        if (ui.filters) back = "[data-action='open-filters']";
        if (ui.reviewer || ui.confirm || ui.report) back = "[data-action='reviewer']";
        ui.confirm = null;
        ui.report = null;
        ui.reviewer = false;
        ui.filters = false;
        ui.menu = false;
        ui.returnFocus = back;
        render();
        event.preventDefault();
      }
      return;
    }
    if (event.key === "Tab") {
      var dialog = document.querySelector("[data-dialog]");
      if (dialog) trap(dialog, event);
    }
    if (event.key === "Enter" && event.target.dataset && event.target.dataset.watch === "chat" && !event.shiftKey) {
      event.preventDefault();
      if (event.target.form) event.target.form.requestSubmit();
    }
  }

  function boot() {
    BBStore = window.BBDemo ? window.BBDemoStore : window.BBLive;
    window.BBRerender = function () {
      ui.skipSnapshot = true;
      render();
    };
    settle(BBStore.init()).then(function () {
      if (!location.hash) history.replaceState(null, "", "#/");
      render();
    });
  }

  function init() {
    document.body.addEventListener("click", onClick);
    document.body.addEventListener("submit", onSubmit);
    document.body.addEventListener("input", onInput);
    document.body.addEventListener("change", onChange);
    document.body.addEventListener("keydown", onKeydown);
    window.addEventListener("hashchange", function () { render(); });
    window.matchMedia("(min-width: 1040px)").addEventListener("change", function () { render(); });
    window.matchMedia("(min-width: 800px)").addEventListener("change", function () { render(); });
    if (window.BBClientReady || window.BBDemo) boot();
    else window.addEventListener("bb-client", boot, { once: true });
  }

  var BBStore = window.BBDemoStore;
  init();
})();
