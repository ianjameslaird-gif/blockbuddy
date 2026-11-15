(function (root) {
  "use strict";

  var KEY = "blockbuddy.prototype.v1";
  var DAY = 24 * 60 * 60 * 1000;
  var HOUR = 60 * 60 * 1000;
  var data = root.BBData;
  var state = null;

  function storage() {
    try {
      if (typeof localStorage === "undefined") return null;
      var test = "__bb__";
      localStorage.setItem(test, "1");
      localStorage.removeItem(test);
      return localStorage;
    } catch (err) {
      return null;
    }
  }

  function uid(prefix) {
    return (
      prefix +
      Math.random().toString(36).slice(2, 8) +
      Date.now().toString(36).slice(-4)
    );
  }

  function blankVerification(status) {
    var now = Date.now();
    return {
      status: status || "none",
      updatedAt: now,
      submittedAt: status && status !== "none" ? now : null,
      verifiedAt: status === "verified" ? now : null,
      fileName: "",
      previewDataUrl: "",
      draftDataUrl: "",
      draftName: "",
      actionReason: status === "action_needed" ? data.actionReason : "",
      events: status && status !== "none" ? [{ status: status, at: now }] : []
    };
  }

  function buildSeed() {
    var now = Date.now();
    var users = data.users.map(function (u) {
      return {
        id: u.id,
        preferredName: u.preferredName,
        email: u.email,
        password: u.password,
        bio: u.bio,
        communityId: data.community.id,
        createdAt: now - u.memberDaysAgo * DAY,
        verification: (function () {
          var at = now - u.memberDaysAgo * DAY;
          var record = blankVerification(u.verification);
          record.updatedAt = at;
          record.submittedAt = u.verification === "none" ? null : at;
          record.verifiedAt = u.verification === "verified" ? at : null;
          record.events = u.verification === "none" ? [] : [{ status: u.verification, at: at }];
          return record;
        })()
      };
    });
    var listings = data.listings.map(function (l) {
      return {
        id: l.id,
        ownerId: l.ownerId,
        communityId: data.community.id,
        type: l.type,
        title: l.title,
        description: l.description,
        category: l.category,
        condition: l.condition,
        price: l.price,
        art: l.art,
        photo: "",
        status: "active",
        createdAt: now - l.hoursAgo * HOUR
      };
    });
    var threads = data.threads.map(function (t) {
      var reads = {};
      Object.keys(t.readHoursAgo).forEach(function (id) {
        reads[id] = now - t.readHoursAgo[id] * HOUR;
      });
      return {
        id: t.id,
        participantIds: t.participantIds.slice(),
        listingId: t.listingId,
        createdAt: now - 50 * HOUR,
        reads: reads,
        messages: t.messages.map(function (m, index) {
          return {
            id: t.id + "_" + index,
            senderId: m.senderId,
            body: m.body,
            createdAt: now - m.hoursAgo * HOUR
          };
        })
      };
    });
    return {
      version: 1,
      users: users,
      listings: listings,
      threads: threads,
      reports: [],
      blocks: [],
      sessionUserId: null
    };
  }

  var memory = null;

  function save() {
    var box = storage();
    var raw = JSON.stringify(state);
    if (!box) {
      memory = raw;
      return true;
    }
    try {
      box.setItem(KEY, raw);
      return true;
    } catch (err) {
      return false;
    }
  }

  function load() {
    var box = storage();
    var raw = box ? box.getItem(KEY) : memory;
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.users)) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function init() {
    state = load() || buildSeed();
    save();
    return state;
  }

  function reset() {
    var box = storage();
    if (box) box.removeItem(KEY);
    memory = null;
    try {
      sessionStorage.removeItem("bb-rects");
    } catch (err) {
      /* session storage is optional */
    }
    state = buildSeed();
    save();
    return state;
  }

  function sessionUser() {
    if (!state || !state.sessionUserId) return null;
    return userById(state.sessionUserId);
  }

  function userById(id) {
    return state.users.filter(function (u) { return u.id === id; })[0] || null;
  }

  function signIn(email, password) {
    var needle = String(email || "").trim().toLowerCase();
    var user = state.users.filter(function (u) {
      return u.email.toLowerCase() === needle;
    })[0];
    if (!user || !user.password || user.password !== password) {
      return { ok: false, error: "That email and password don't match." };
    }
    state.sessionUserId = user.id;
    save();
    return { ok: true, user: user };
  }

  function signInDemo() {
    return signIn(data.demo.email, data.demo.password);
  }

  function signOut() {
    state.sessionUserId = null;
    save();
  }

  function register(input) {
    var email = String(input.email || "").trim().toLowerCase();
    var exists = state.users.some(function (u) { return u.email.toLowerCase() === email; });
    if (exists) return { ok: false, error: "An account with that email already exists." };
    var user = {
      id: uid("u_"),
      preferredName: String(input.preferredName || "").trim(),
      email: email,
      password: input.password,
      bio: "",
      communityId: data.community.id,
      createdAt: Date.now(),
      verification: blankVerification("none")
    };
    state.users.push(user);
    state.sessionUserId = user.id;
    if (!save()) return { ok: false, error: "This browser could not save the new account." };
    return { ok: true, user: user };
  }

  function setVerificationStatus(status) {
    var user = sessionUser();
    if (!user) return { ok: false, error: "Sign in first." };
    var allowed = { none: 1, submitted: 1, under_review: 1, verified: 1, action_needed: 1 };
    if (!allowed[status]) return { ok: false, error: "Unknown status." };
    var now = Date.now();
    user.verification.status = status;
    user.verification.updatedAt = now;
    if (status === "submitted" || status === "under_review" || status === "action_needed") {
      user.verification.submittedAt = user.verification.submittedAt || now;
    }
    if (status === "verified") user.verification.verifiedAt = now;
    if (status === "action_needed") user.verification.actionReason = data.actionReason;
    if (status !== "action_needed") user.verification.actionReason = "";
    user.verification.events = (user.verification.events || []).concat([{ status: status, at: now }]).slice(-8);
    save();
    return { ok: true, user: user };
  }

  function saveDraft(file) {
    var user = sessionUser();
    if (!user) return { ok: false };
    user.verification.draftDataUrl = file.dataUrl || "";
    user.verification.draftName = file.name || "";
    var stored = save();
    return { ok: stored };
  }

  function submitDocument(file) {
    var user = sessionUser();
    if (!user) return { ok: false, error: "Sign in first." };
    var now = Date.now();
    user.verification.status = "submitted";
    user.verification.updatedAt = now;
    user.verification.submittedAt = now;
    user.verification.fileName = file.name || "document.jpg";
    user.verification.previewDataUrl = file.dataUrl || "";
    user.verification.draftDataUrl = "";
    user.verification.draftName = "";
    user.verification.actionReason = "";
    user.verification.events = (user.verification.events || []).concat([{ status: "submitted", at: now }]).slice(-8);
    if (!save()) {
      user.verification.previewDataUrl = "";
      save();
      return { ok: false, error: "The browser ran out of space for that photo. Try a smaller image." };
    }
    return { ok: true, user: user };
  }

  function updateProfile(input) {
    var user = sessionUser();
    if (!user) return { ok: false, error: "Sign in first." };
    user.preferredName = String(input.preferredName || "").trim();
    user.bio = String(input.bio || "").trim();
    if (!save()) return { ok: false, error: "Could not save your profile on this device." };
    return { ok: true, user: user };
  }

  function isBlocked(a, b) {
    return state.blocks.some(function (row) {
      return (row.blockerId === a && row.blockedId === b) || (row.blockerId === b && row.blockedId === a);
    });
  }

  function blockedByMe(otherId) {
    var me = sessionUser();
    if (!me) return false;
    return state.blocks.some(function (row) {
      return row.blockerId === me.id && row.blockedId === otherId;
    });
  }

  function blockUser(otherId) {
    var me = sessionUser();
    if (!me || me.id === otherId) return { ok: false };
    if (!blockedByMe(otherId)) {
      state.blocks.push({ id: uid("b_"), blockerId: me.id, blockedId: otherId, createdAt: Date.now() });
      save();
    }
    return { ok: true };
  }

  function unblockUser(otherId) {
    var me = sessionUser();
    if (!me) return { ok: false };
    state.blocks = state.blocks.filter(function (row) {
      return !(row.blockerId === me.id && row.blockedId === otherId);
    });
    save();
    return { ok: true };
  }

  function myBlocks() {
    var me = sessionUser();
    if (!me) return [];
    return state.blocks.filter(function (row) { return row.blockerId === me.id; });
  }

  function listingPrice(listing) {
    if (listing.type === "giveaway") return 0;
    if (listing.price === null || listing.price === "" || typeof listing.price === "undefined") return null;
    var num = Number(listing.price);
    return Number.isFinite(num) ? num : null;
  }

  function visibleListings(filters) {
    var me = sessionUser();
    var f = filters || {};
    var q = String(f.q || "").trim().toLowerCase();
    return state.listings
      .filter(function (listing) {
        if (listing.communityId !== data.community.id) return false;
        if (listing.status !== "active" && !f.includeClosed) return false;
        if (me && isBlocked(me.id, listing.ownerId)) return false;
        if (f.ownerId && listing.ownerId !== f.ownerId) return false;
        if (f.category && listing.category !== f.category) return false;
        if (f.type && listing.type !== f.type) return false;
        var price = listingPrice(listing);
        if (f.free && !(listing.type === "giveaway" || price === 0)) return false;
        if (f.min !== null && typeof f.min !== "undefined" && f.min !== "") {
          if (price === null || price < Number(f.min)) return false;
        }
        if (f.max !== null && typeof f.max !== "undefined" && f.max !== "") {
          if (price === null || price > Number(f.max)) return false;
        }
        if (q) {
          var owner = userById(listing.ownerId);
          var hay = [
            listing.title,
            listing.description,
            listing.category,
            listing.type,
            owner ? owner.preferredName : ""
          ].join(" ").toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  function listingById(id) {
    return state.listings.filter(function (l) { return l.id === id; })[0] || null;
  }

  function saveListing(input) {
    var me = sessionUser();
    if (!me) return { ok: false, error: "Sign in first." };
    var existing = input.id ? listingById(input.id) : null;
    if (existing && existing.ownerId !== me.id) return { ok: false, error: "You can only edit your own listings." };
    var listing = existing || {
      id: uid("l_"),
      ownerId: me.id,
      communityId: data.community.id,
      createdAt: Date.now(),
      status: "active",
      art: input.art || "other",
      photo: ""
    };
    listing.type = input.type;
    listing.title = String(input.title || "").trim();
    listing.description = String(input.description || "").trim();
    listing.category = input.category;
    listing.condition = input.condition || "Good";
    listing.price = input.price;
    listing.art = input.art || listing.art || "other";
    if (typeof input.photo === "string") listing.photo = input.photo;
    listing.updatedAt = Date.now();
    if (!existing) state.listings.unshift(listing);
    if (!save()) {
      listing.photo = "";
      if (save()) return { ok: true, listing: listing, warning: "The listing was saved without the photo because this browser is short on space." };
      return { ok: false, error: "Could not save the listing on this device." };
    }
    return { ok: true, listing: listing };
  }

  function setListingStatus(id, status) {
    var me = sessionUser();
    var listing = listingById(id);
    if (!me || !listing || listing.ownerId !== me.id) return { ok: false };
    listing.status = status;
    save();
    return { ok: true, listing: listing };
  }

  function deleteListing(id) {
    var me = sessionUser();
    var listing = listingById(id);
    if (!me || !listing || listing.ownerId !== me.id) return { ok: false };
    state.listings = state.listings.filter(function (l) { return l.id !== id; });
    save();
    return { ok: true };
  }

  function threadsFor(userId) {
    return state.threads
      .filter(function (t) { return t.participantIds.indexOf(userId) !== -1; })
      .sort(function (a, b) {
        var am = a.messages.length ? a.messages[a.messages.length - 1].createdAt : a.createdAt;
        var bm = b.messages.length ? b.messages[b.messages.length - 1].createdAt : b.createdAt;
        return bm - am;
      });
  }

  function threadById(id) {
    return state.threads.filter(function (t) { return t.id === id; })[0] || null;
  }

  function ensureThread(otherId, listingId) {
    var me = sessionUser();
    if (!me || me.id === otherId) return null;
    var found = state.threads.filter(function (t) {
      return t.participantIds.indexOf(me.id) !== -1 && t.participantIds.indexOf(otherId) !== -1;
    })[0];
    if (found) {
      if (listingId) found.listingId = listingId;
      save();
      return found;
    }
    var thread = {
      id: uid("t_"),
      participantIds: [me.id, otherId],
      listingId: listingId || null,
      createdAt: Date.now(),
      reads: {},
      messages: []
    };
    state.threads.unshift(thread);
    save();
    return thread;
  }

  function sendMessage(threadId, body) {
    var me = sessionUser();
    var thread = threadById(threadId);
    if (!me || !thread || thread.participantIds.indexOf(me.id) === -1) {
      return { ok: false, error: "That conversation is not available." };
    }
    var otherId = thread.participantIds.filter(function (id) { return id !== me.id; })[0];
    if (isBlocked(me.id, otherId)) return { ok: false, error: "Messaging is paused while this neighbour is blocked." };
    var message = {
      id: uid("m_"),
      senderId: me.id,
      body: String(body || "").trim(),
      createdAt: Date.now()
    };
    thread.messages.push(message);
    thread.reads[me.id] = message.createdAt;
    if (!save()) return { ok: false, error: "Could not save that message on this device." };
    return { ok: true, message: message };
  }

  function markRead(threadId) {
    var me = sessionUser();
    var thread = threadById(threadId);
    if (!me || !thread) return;
    thread.reads[me.id] = Date.now();
    save();
  }

  function unreadCount(userId) {
    return threadsFor(userId).reduce(function (sum, thread) {
      var readAt = (thread.reads && thread.reads[userId]) || 0;
      var unread = thread.messages.some(function (m) {
        return m.senderId !== userId && m.createdAt > readAt;
      });
      return sum + (unread ? 1 : 0);
    }, 0);
  }

  function threadUnread(thread, userId) {
    var readAt = (thread.reads && thread.reads[userId]) || 0;
    return thread.messages.some(function (m) {
      return m.senderId !== userId && m.createdAt > readAt;
    });
  }

  function addReport(input) {
    var me = sessionUser();
    if (!me) return { ok: false, error: "Sign in to send a report." };
    var report = {
      id: uid("r_"),
      reporterId: me.id,
      targetType: input.targetType,
      targetId: input.targetId || "",
      targetLabel: input.targetLabel || "",
      reason: input.reason,
      details: String(input.details || "").trim(),
      createdAt: Date.now()
    };
    state.reports.unshift(report);
    if (!save()) return { ok: false, error: "Could not save the report on this device." };
    return { ok: true, report: report };
  }

  function myReports() {
    var me = sessionUser();
    if (!me) return [];
    return state.reports.filter(function (r) { return r.reporterId === me.id; });
  }

  function ownListings() {
    var me = sessionUser();
    if (!me) return [];
    return state.listings.filter(function (listing) {
      return listing.ownerId === me.id;
    }).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  root.BBDemoStore = {
    init: init,
    reset: reset,
    booting: function () { return false; },
    prepare: function () { return Promise.resolve(); },
    ownListings: ownListings,
    mySubmissions: function () { return []; },
    adminSubmissions: function () { return []; },
    adminReports: function () { return []; },
    auditLog: function () { return []; },
    state: function () { return state; },
    save: save,
    sessionUser: sessionUser,
    userById: userById,
    signIn: signIn,
    signInDemo: signInDemo,
    signOut: signOut,
    requestReset: function () { return { ok: true }; },
    updatePassword: function () { return { ok: true }; },
    adminReview: function () { return { ok: false, error: "Reviewer tools change the status in this demo." }; },
    adminOpen: function () { return Promise.resolve({ ok: false, error: "Documents are not uploaded in the demo." }); },
    adminResolve: function () { return { ok: false }; },
    adminHide: function () { return { ok: false }; },
    ownDocumentUrl: function () { return Promise.resolve(""); },
    register: register,
    setVerificationStatus: setVerificationStatus,
    saveDraft: saveDraft,
    submitDocument: submitDocument,
    updateProfile: updateProfile,
    isBlocked: isBlocked,
    blockedByMe: blockedByMe,
    blockUser: blockUser,
    unblockUser: unblockUser,
    myBlocks: myBlocks,
    listingPrice: listingPrice,
    visibleListings: visibleListings,
    listingById: listingById,
    saveListing: saveListing,
    setListingStatus: setListingStatus,
    deleteListing: deleteListing,
    threadsFor: threadsFor,
    threadById: threadById,
    ensureThread: ensureThread,
    sendMessage: sendMessage,
    markRead: markRead,
    unreadCount: unreadCount,
    threadUnread: threadUnread,
    addReport: addReport,
    myReports: myReports
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
