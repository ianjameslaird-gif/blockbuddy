(function (root) {
  "use strict";

  var cache = {
    booting: true,
    ready: false,
    error: "",
    recovery: false,
    user: null,
    users: {},
    listings: [],
    ownListings: [],
    listing: null,
    threads: [],
    thread: null,
    blocks: [],
    reports: [],
    submissions: [],
    adminSubmissions: [],
    adminReports: [],
    audit: [],
    communities: [],
    photoUrls: {},
    channel: null
  };

  function client() {
    return root.BBClient || null;
  }

  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (ch) {
      var n = (Math.random() * 16) | 0;
      return (ch === "x" ? n : (n & 0x3) | 0x8).toString(16);
    });
  }

  function friendly(error) {
    var message = (error && (error.message || error.error_description || error.msg)) || "";
    var lower = String(message).toLowerCase();
    if (!message) return "Something went wrong. Try again.";
    if (lower.indexOf("failed to fetch") !== -1 || lower.indexOf("network") !== -1) {
      return "BlockBuddy couldn’t reach the server. Check your connection and try again.";
    }
    if (lower.indexOf("invalid login") !== -1) return "That email and password don't match.";
    if (lower.indexOf("email not confirmed") !== -1) return "Confirm your email first. The link is in your inbox.";
    if (lower.indexOf("already registered") !== -1 || lower.indexOf("user already") !== -1) {
      return "An account with that email already exists.";
    }
    if (lower.indexOf("rate limit") !== -1 || lower.indexOf("over_email_send") !== -1) {
      return "Too many emails were sent. Wait a little and try again.";
    }
    if (lower.indexOf("unit number") !== -1) return "Take the unit number out and try again.";
    if (lower.indexOf("a note is required") !== -1) return "Write a note the member can act on.";
    if (lower.indexOf("verification is not open") !== -1) return "A document is already in review.";
    if (lower.indexOf("newer submission") !== -1) return "A newer document replaced this one.";
    if (lower.indexOf("messaging is not available") !== -1) return "Messaging isn’t available with this neighbour.";
    if (lower.indexOf("held by a reviewer") !== -1) return "A reviewer has hidden this listing.";
    if (lower.indexOf("row-level security") !== -1 || lower.indexOf("permission denied") !== -1 || lower === "not allowed") {
      return "You don’t have access to that.";
    }
    if (lower.indexOf("duplicate") !== -1 || lower.indexOf("unique") !== -1) return "That’s already saved.";
    if (message.length < 180 && lower.indexOf("relation ") === -1 && lower.indexOf("syntax") === -1 && lower.indexOf("jwt") === -1) {
      return message;
    }
    return "Something went wrong. Try again.";
  }

  function stamp(value) {
    var n = Date.parse(value || "");
    return Number.isFinite(n) ? n : Date.now();
  }

  function remember(user) {
    if (user && user.id) cache.users[user.id] = user;
    return user;
  }

  function sortCommunities(rows) {
    return rows.slice().sort(function (a, b) {
      if (a.slug === "skypeak-bukit-batok") return -1;
      if (b.slug === "skypeak-bukit-batok") return 1;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function fallbackCommunities() {
    var list = (root.BBConfig && root.BBConfig.communities) || [];
    return sortCommunities(list.map(function (row) {
      return {
        id: row.id || "",
        name: row.name,
        slug: row.slug,
        residentLabel: row.residentLabel || (row.name + " resident")
      };
    }));
  }

  function loadCommunities() {
    var fallback = fallbackCommunities();
    if (!client()) {
      cache.communities = fallback;
      return Promise.resolve(cache.communities);
    }
    return client().from("communities").select("id, name, slug, resident_label").then(function (res) {
      if (res.error || !res.data || !res.data.length) {
        cache.communities = fallback;
        return cache.communities;
      }
      cache.communities = sortCommunities(res.data.map(function (row) {
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          residentLabel: row.resident_label || (row.name + " resident")
        };
      }));
      return cache.communities;
    }).catch(function () {
      cache.communities = fallback;
      return cache.communities;
    });
  }

  function mapProfile(row, email, own) {
    if (!row) return null;
    var priv = row.profile_private;
    if (Array.isArray(priv)) priv = priv[0] || null;
    var community = row.communities || {};
    if (Array.isArray(community)) community = community[0] || {};
    var previous = cache.users[row.id] || null;
    var status = row.verification_status === "not_submitted" ? "none" : row.verification_status;
    var user = {
      id: row.id,
      preferredName: row.display_name,
      email: email || "",
      bio: row.bio || "",
      communityId: row.community_id,
      createdAt: stamp(row.created_at),
      isAdmin: !!(priv && priv.is_admin),
      verification: {
        status: status,
        updatedAt: stamp(row.updated_at),
        submittedAt: null,
        verifiedAt: status === "verified" ? stamp(row.updated_at) : null,
        fileName: "",
        previewDataUrl: "",
        draftDataUrl: "",
        draftName: "",
        actionReason: (priv && priv.reviewer_note) || "",
        events: []
      }
    };
    if (community && community.name) {
      user.communityName = community.name;
      user.residentLabel = community.resident_label || community.name + " resident";
      user.communitySlug = community.slug || "";
    } else if (previous) {
      user.communityName = previous.communityName || "";
      user.residentLabel = previous.residentLabel || "";
      user.communitySlug = previous.communitySlug || "";
    }
    if (own && user.communityName && root.BBData) {
      root.BBData.community = {
        id: row.community_id,
        name: user.communityName,
        residentLabel: user.residentLabel,
        slug: user.communitySlug || "",
        pilot: root.BBData.community && root.BBData.community.pilot
      };
    }
    return remember(user);
  }

  function mapListing(row) {
    if (!row) return null;
    var price = row.price === null || typeof row.price === "undefined" ? null : Number(row.price);
    return {
      id: row.id,
      ownerId: row.owner_id,
      communityId: row.community_id,
      type: row.type,
      title: row.title,
      description: row.description,
      category: row.category,
      condition: row.condition,
      price: Number.isFinite(price) ? price : null,
      art: "",
      photo: cache.photoUrls[row.photo_path] || "",
      photoPath: row.photo_path || "",
      status: row.status,
      createdAt: stamp(row.created_at)
    };
  }

  function signPhotos(rows) {
    var paths = [];
    (rows || []).forEach(function (row) {
      if (row.photo_path && paths.indexOf(row.photo_path) === -1) paths.push(row.photo_path);
    });
    if (!paths.length || !client()) return Promise.resolve();
    return client().storage.from("listing-photos").createSignedUrls(paths, 3600).then(function (res) {
      (res.data || []).forEach(function (item) {
        if (item && item.path && item.signedUrl) cache.photoUrls[item.path] = item.signedUrl;
      });
    }).catch(function () { return null; });
  }

  function loadPeople(ids) {
    var missing = [];
    ids.forEach(function (id) {
      if (id && !cache.users[id]) missing.push(id);
    });
    if (!missing.length || !client()) return Promise.resolve();
    return client().from("profiles").select("id, display_name, bio, community_id, verification_status, created_at, updated_at").in("id", missing).then(function (res) {
      if (res.error) return;
      (res.data || []).forEach(function (row) { mapProfile(row, ""); });
    });
  }

  function loadProfile(session) {
    var uid = session.user.id;
    return client().from("profiles").select("id, display_name, bio, community_id, verification_status, created_at, updated_at, communities(name, slug, resident_label), profile_private(is_admin, reviewer_note)").eq("id", uid).maybeSingle().then(function (res) {
      if (res.error) {
        cache.error = friendly(res.error);
        cache.user = null;
        return;
      }
      if (!res.data) {
        cache.error = "Your profile isn’t in the database yet. Apply the Supabase migrations, then sign in again.";
        cache.user = null;
        return;
      }
      cache.error = "";
      cache.user = mapProfile(res.data, session.user.email || "", true);
    });
  }

  function clearUser() {
    cache.user = null;
    cache.users = {};
    cache.listings = [];
    cache.ownListings = [];
    cache.listing = null;
    cache.threads = [];
    cache.thread = null;
    cache.blocks = [];
    cache.reports = [];
    cache.submissions = [];
    cache.recovery = false;
    clearChannel();
  }

  function clearChannel() {
    if (cache.channel && client()) client().removeChannel(cache.channel);
    cache.channel = null;
  }

  function handleAuth(event, session) {
    if (event === "PASSWORD_RECOVERY") cache.recovery = true;
    if (event === "SIGNED_OUT") {
      clearUser();
      cache.booting = false;
      if (root.BBRerender) root.BBRerender();
      return;
    }
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") {
      var apply = session ? loadProfile(session) : Promise.resolve(clearUser());
      apply.then(function () {
        cache.booting = false;
        cache.ready = true;
        if (cache.recovery && (root.location.hash || "").indexOf("#/update-password") !== 0) {
          root.location.hash = "#/update-password";
          return;
        }
        if (root.BBRerender) root.BBRerender();
      });
    }
  }

  function init() {
    if (!client()) {
      cache.booting = false;
      cache.ready = true;
      cache.error = root.BBClientError
        ? "BlockBuddy couldn’t load the sign-in library. Check your connection and refresh."
        : "Sign-in is not configured.";
      return Promise.resolve();
    }
    root.BBAuthHandler = handleAuth;
    var queued = root.BBAuthQueue ? root.BBAuthQueue.splice(0) : [];
    var finish = function () {
      cache.booting = false;
      cache.ready = true;
    };
    if (queued.length) {
      return loadCommunities().then(function () {
        queued.forEach(function (item) { handleAuth(item.event, item.session); });
        finish();
      });
    }
    return client().auth.getSession().then(function (res) {
      if (res.error) cache.error = friendly(res.error);
      var session = !res.error && res.data ? res.data.session : null;
      var step = session ? loadProfile(session) : Promise.resolve();
      return step.then(loadCommunities).then(finish);
    }).catch(function () {
      cache.error = "BlockBuddy couldn’t reach the sign-in service.";
      return loadCommunities().then(finish);
    });
  }

  function requireClient() {
    if (!client() || !cache.user) return { ok: false, error: "Sign in first." };
    return null;
  }

  function dataUrlToBlob(dataUrl) {
    var parts = String(dataUrl || "").split(",");
    var binary = atob(parts[1] || "");
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "image/jpeg" });
  }

  function searchParams(params, extra) {
    var source = params || { get: function () { return ""; } };
    return {
      p_q: source.get ? (source.get("q") || "") : "",
      p_category: source.get ? (source.get("category") || "") : "",
      p_type: source.get ? (source.get("type") || "") : "",
      p_min: source.get && source.get("min") !== "" && source.get("min") != null ? Number(source.get("min")) : null,
      p_max: source.get && source.get("max") !== "" && source.get("max") != null ? Number(source.get("max")) : null,
      p_free: source.get ? source.get("free") === "1" : false,
      p_owner: extra && extra.owner ? extra.owner : null,
      p_include_closed: !!(extra && extra.closed)
    };
  }

  function loadListings(params, extra) {
    return client().rpc("search_listings", searchParams(params, extra)).then(function (res) {
      if (res.error) throw res.error;
      return signPhotos(res.data || []).then(function () {
        return (res.data || []).map(mapListing);
      });
    });
  }

  function shapeThread(row) {
    var me = cache.user ? cache.user.id : "";
    var lastAt = stamp(row.last_at || row.created_at);
    return {
      id: row.id,
      participantIds: [me, row.other_id],
      listingId: row.listing_id,
      createdAt: stamp(row.created_at),
      unread: !!row.unread,
      reads: {},
      messages: row.last_body ? [{
        id: row.id + "-last",
        senderId: row.unread ? row.other_id : me,
        body: row.last_body,
        createdAt: lastAt
      }] : []
    };
  }

  function loadInbox() {
    return client().rpc("inbox").then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      return loadPeople(rows.map(function (row) { return row.other_id; })).then(function () {
        cache.threads = rows.map(shapeThread);
      });
    });
  }

  function watchThread(id) {
    clearChannel();
    if (!client() || !id) return;
    cache.channel = client().channel("messages:" + id).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + id },
      function (payload) {
        var row = payload.new;
        if (!row || !cache.thread || cache.thread.id !== id) return;
        if (cache.thread.messages.some(function (message) { return message.id === row.id; })) return;
        cache.thread.messages.push({
          id: row.id,
          senderId: row.sender_id,
          body: row.body,
          createdAt: stamp(row.created_at)
        });
        if (root.BBRerender) root.BBRerender();
      }
    ).subscribe();
  }

  function prepare(route) {
    if (!client() || !cache.user) {
      cache.listings = [];
      cache.adminSubmissions = [];
      cache.adminReports = [];
      cache.audit = [];
      return Promise.resolve();
    }
    var name = route.name;
    var me = cache.user.id;
    if (name !== "thread") clearChannel();

    if (name === "feed") {
      return loadListings(null, null).then(function (rows) {
        cache.listings = rows;
        return loadPeople(rows.map(function (row) { return row.ownerId; }));
      }).then(function () { return {}; }).catch(function (error) { return { error: friendly(error) }; });
    }
    if (name === "search") {
      return loadListings(route.params, null).then(function (rows) {
        cache.listings = rows;
        return loadPeople(rows.map(function (row) { return row.ownerId; }));
      }).then(function () { return {}; }).catch(function (error) { return { error: friendly(error) }; });
    }
    if (name === "listing" || (name === "edit" && route.id)) {
      return client().from("listings").select("*").eq("id", route.id).maybeSingle().then(function (res) {
        if (res.error) throw res.error;
        return signPhotos(res.data ? [res.data] : []).then(function () {
          cache.listing = mapListing(res.data);
          cache.listings = cache.listing ? [cache.listing] : [];
          return cache.listing ? loadPeople([cache.listing.ownerId]) : null;
        });
      }).then(function () { return {}; }).catch(function (error) { return { error: friendly(error) }; });
    }
    if (name === "messages" || name === "thread") {
      var inbox = loadInbox();
      if (name !== "thread") return inbox.then(function () { return {}; }).catch(function (error) { return { error: friendly(error) }; });
      return inbox.then(function () {
        return client().from("conversation_reads").upsert({
          conversation_id: route.id,
          user_id: me,
          last_read_at: new Date().toISOString()
        }, { onConflict: "conversation_id,user_id" });
      }).then(function (res) {
        if (res && res.error) throw res.error;
        return client().from("messages").select("id, sender_id, body, created_at, conversation_id").eq("conversation_id", route.id).order("created_at", { ascending: true });
      }).then(function (res) {
        if (res.error) throw res.error;
        var summary = cache.threads.filter(function (thread) { return thread.id === route.id; })[0];
        var otherId = summary ? summary.participantIds.filter(function (id) { return id !== me; })[0] : null;
        cache.thread = {
          id: route.id,
          participantIds: otherId ? [me, otherId] : [me],
          listingId: summary ? summary.listingId : null,
          createdAt: summary ? summary.createdAt : Date.now(),
          unread: false,
          reads: {},
          messages: (res.data || []).map(function (row) {
            return { id: row.id, senderId: row.sender_id, body: row.body, createdAt: stamp(row.created_at) };
          })
        };
        if (summary) summary.unread = false;
        watchThread(route.id);
        var ids = otherId ? [otherId] : [];
        return loadPeople(ids);
      }).then(function () { return {}; }).catch(function (error) { return { error: friendly(error) }; });
    }
    if (name === "profile") {
      return Promise.all([
        loadListings(null, { owner: me, closed: true }),
        client().from("blocks").select("id, blocked_id, created_at").eq("blocker_id", me),
        client().from("verification_submissions").select("id, status, file_name, submitted_at, reviewer_note").eq("user_id", me).order("submitted_at", { ascending: false })
      ]).then(function (parts) {
        cache.ownListings = parts[0];
        if (parts[1].error) throw parts[1].error;
        cache.blocks = (parts[1].data || []).map(function (row) {
          return { id: row.id, blockerId: me, blockedId: row.blocked_id, createdAt: stamp(row.created_at) };
        });
        return loadPeople(cache.blocks.map(function (row) { return row.blockedId; }));
      }).then(function () { return {}; }).catch(function (error) { return { error: friendly(error) }; });
    }
    if (name === "member") {
      return loadPeople([route.id]).then(function () {
        return loadListings(null, { owner: route.id, closed: false });
      }).then(function (rows) {
        cache.listings = rows;
        return {};
      }).catch(function (error) { return { error: friendly(error) }; });
    }
    if (name === "verify") {
      return client().from("verification_submissions").select("id, status, file_name, submitted_at, reviewer_note, document_deleted_at, storage_path").eq("user_id", me).order("submitted_at", { ascending: false }).then(function (res) {
        if (res.error) throw res.error;
        cache.submissions = res.data || [];
        if (cache.submissions[0] && cache.user) {
          cache.user.verification.fileName = cache.submissions[0].file_name || "";
          cache.user.verification.submittedAt = stamp(cache.submissions[0].submitted_at);
        }
        return {};
      }).catch(function (error) { return { error: friendly(error) }; });
    }
    if (name === "help") {
      return client().from("reports").select("id, reason, target_label, created_at, status").eq("reporter_id", me).order("created_at", { ascending: false }).then(function (res) {
        if (res.error) throw res.error;
        cache.reports = (res.data || []).map(function (row) {
          return { id: row.id, reason: row.reason, targetLabel: row.target_label, createdAt: stamp(row.created_at), status: row.status };
        });
        return {};
      }).catch(function (error) { return { error: friendly(error) }; });
    }
    if (name === "admin") {
      if (!cache.user.isAdmin) return Promise.resolve();
      var status = (route.params.get("status") || "submitted");
      var wanted = route.params.get("community") || "";
      return loadCommunities().then(function (rows) {
        var match = null;
        (rows || []).forEach(function (row) {
          if (row.slug === wanted) match = row;
        });
        var submissions = client().from("verification_submissions").select("id, user_id, community_id, status, file_name, submitted_at, reviewer_note, document_deleted_at, storage_path, member:profiles!verification_submissions_user_id_fkey(display_name)").eq("status", status).order("submitted_at", { ascending: true });
        var reports = client().from("reports").select("id, reporter_id, community_id, target_type, target_id, target_label, reason, details, status, created_at, reporter:profiles!reports_reporter_id_fkey(display_name)").eq("status", "open").order("created_at", { ascending: true });
        if (match && match.id) {
          submissions = submissions.eq("community_id", match.id);
          reports = reports.eq("community_id", match.id);
        }
        return Promise.all([
          submissions,
          reports,
          client().from("audit_log").select("id, action, target_type, target_id, created_at, admin:profiles!audit_log_admin_id_fkey(display_name)").order("created_at", { ascending: false }).limit(40)
        ]);
      }).then(function (parts) {
        parts.forEach(function (part) { if (part.error) throw part.error; });
        cache.adminSubmissions = parts[0].data || [];
        cache.adminReports = parts[1].data || [];
        cache.audit = parts[2].data || [];
        return {};
      }).catch(function (error) { return { error: friendly(error) }; });
    }
    return Promise.resolve();
  }

  function signIn(email, password) {
    if (!client()) return Promise.resolve({ ok: false, error: "Sign-in is not available." });
    return client().auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      return loadProfile(res.data.session).then(function () {
        return cache.user ? { ok: true, user: cache.user } : { ok: false, error: cache.error || "Profile missing." };
      });
    });
  }

  function register(input) {
    if (!client()) return Promise.resolve({ ok: false, error: "Registration is not available." });
    var slug = String(input.communitySlug || "").trim();
    if (!slug) return Promise.resolve({ ok: false, error: "Choose the community you live in." });
    return client().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.preferredName,
          community_slug: slug
        },
        emailRedirectTo: root.BBConfig.siteUrl()
      }
    }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      if (!res.data.session) return { ok: true, pending: true };
      return loadProfile(res.data.session).then(function () {
        return { ok: true, user: cache.user };
      });
    });
  }

  function signOut() {
    clearChannel();
    if (!client()) {
      clearUser();
      return Promise.resolve();
    }
    return client().auth.signOut().then(function () { clearUser(); });
  }

  function requestReset(email) {
    if (!client()) return Promise.resolve({ ok: false, error: "Password reset is not available." });
    return client().auth.resetPasswordForEmail(email, { redirectTo: root.BBConfig.siteUrl() }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      return { ok: true };
    });
  }

  function updatePassword(password) {
    if (!client()) return Promise.resolve({ ok: false, error: "Sign in from the reset email first." });
    return client().auth.updateUser({ password: password }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      cache.recovery = false;
      return { ok: true };
    });
  }

  function updateProfile(input) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    return client().from("profiles").update({
      display_name: input.preferredName,
      bio: input.bio
    }).eq("id", cache.user.id).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      return client().auth.getSession().then(function (sessionRes) {
        return loadProfile(sessionRes.data.session).then(function () {
          return { ok: true, user: cache.user };
        });
      });
    });
  }

  function saveListing(input) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    var row = {
      type: input.type,
      title: input.title,
      description: input.description,
      category: input.category,
      condition: input.condition || "Good",
      price: input.price
    };
    var write = input.id
      ? client().from("listings").update(row).eq("id", input.id).select("*").single()
      : client().from("listings").insert(Object.assign({
          owner_id: cache.user.id,
          community_id: cache.user.communityId,
          status: "active"
        }, row)).select("*").single();
    return write.then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      var listing = res.data;
      if (!input.photo) {
        if (input.id && listing.photo_path && input.clearPhoto) {
          return client().from("listings").update({ photo_path: null }).eq("id", listing.id).then(function () {
            return client().storage.from("listing-photos").remove([listing.photo_path]).then(function () {
              listing.photo_path = null;
              return { ok: true, listing: mapListing(listing) };
            });
          });
        }
        return { ok: true, listing: mapListing(listing) };
      }
      var path = listing.community_id + "/" + listing.owner_id + "/" + listing.id + ".jpg";
      return client().storage.from("listing-photos").upload(path, dataUrlToBlob(input.photo), {
        contentType: "image/jpeg",
        upsert: true
      }).then(function (up) {
        if (up.error) return { ok: true, listing: mapListing(listing), warning: "The listing was saved without the photo." };
        return client().from("listings").update({ photo_path: path }).eq("id", listing.id).then(function (updated) {
          if (updated.error) return { ok: true, listing: mapListing(listing), warning: "The listing was saved without the photo." };
          listing.photo_path = path;
          return signPhotos([listing]).then(function () {
            return { ok: true, listing: mapListing(listing) };
          });
        });
      });
    });
  }

  function setListingStatus(id, status) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    return client().from("listings").update({ status: status }).eq("id", id).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      if (cache.listing && cache.listing.id === id) cache.listing.status = status;
      cache.ownListings.forEach(function (listing) {
        if (listing.id === id) listing.status = status;
      });
      return { ok: true };
    });
  }

  function deleteListing(id) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    var listing = listingById(id);
    var path = listing && listing.photoPath;
    return client().from("listings").delete().eq("id", id).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      if (!path) return { ok: true };
      return client().storage.from("listing-photos").remove([path]).then(function () { return { ok: true }; });
    });
  }

  function submitDocument(file) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    var id = uuid();
    var path = cache.user.id + "/" + id + ".jpg";
    var name = String(file.name || "document.jpg").replace(/[\\/]/g, " ").slice(0, 180);
    return client().storage.from("verification-docs").upload(path, dataUrlToBlob(file.dataUrl), {
      contentType: "image/jpeg",
      upsert: false
    }).then(function (up) {
      if (up.error) return { ok: false, error: friendly(up.error) };
      return client().from("verification_submissions").insert({
        user_id: cache.user.id,
        community_id: cache.user.communityId,
        storage_path: path,
        file_name: name,
        mime_type: "image/jpeg"
      }).then(function (ins) {
        if (ins.error) {
          return client().storage.from("verification-docs").remove([path]).then(function () {
            return { ok: false, error: friendly(ins.error) };
          });
        }
        return client().auth.getSession().then(function (sessionRes) {
          return loadProfile(sessionRes.data.session).then(function () {
            return { ok: true, user: cache.user };
          });
        });
      });
    });
  }

  function ownDocumentUrl(path) {
    if (!client() || !path) return Promise.resolve("");
    return client().storage.from("verification-docs").createSignedUrl(path, 60).then(function (res) {
      if (res.error) return "";
      return res.data.signedUrl || "";
    });
  }

  function ensureThread(otherId, listingId) {
    var blocked = requireClient();
    if (blocked || !otherId || otherId === cache.user.id) return Promise.resolve(null);
    var low = cache.user.id < otherId ? cache.user.id : otherId;
    var high = cache.user.id < otherId ? otherId : cache.user.id;
    return client().from("conversations").select("id").eq("user_low", low).eq("user_high", high).maybeSingle().then(function (res) {
      if (res.error) return null;
      if (res.data) {
        if (!listingId) return { id: res.data.id };
        return client().from("conversations").update({ listing_id: listingId }).eq("id", res.data.id).then(function () {
          return { id: res.data.id };
        });
      }
      return client().from("conversations").insert({
        community_id: cache.user.communityId,
        user_low: low,
        user_high: high,
        listing_id: listingId || null
      }).select("id").single().then(function (created) {
        if (created.error) return null;
        return { id: created.data.id };
      });
    });
  }

  function sendMessage(threadId, body) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    return client().from("messages").insert({
      conversation_id: threadId,
      sender_id: cache.user.id,
      body: body
    }).select("id, sender_id, body, created_at").single().then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      if (cache.thread && cache.thread.id === threadId) {
        if (!cache.thread.messages.some(function (message) { return message.id === res.data.id; })) {
          cache.thread.messages.push({
            id: res.data.id,
            senderId: res.data.sender_id,
            body: res.data.body,
            createdAt: stamp(res.data.created_at)
          });
        }
      }
      return { ok: true, message: res.data };
    });
  }

  function blockUser(otherId) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    return client().from("blocks").insert({ blocker_id: cache.user.id, blocked_id: otherId }).then(function (res) {
      if (res.error && String(res.error.message || "").toLowerCase().indexOf("duplicate") === -1 && String(res.error.code || "") !== "23505") {
        return { ok: false, error: friendly(res.error) };
      }
      cache.blocks.push({ id: uuid(), blockerId: cache.user.id, blockedId: otherId, createdAt: Date.now() });
      return { ok: true };
    });
  }

  function unblockUser(otherId) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    return client().from("blocks").delete().eq("blocker_id", cache.user.id).eq("blocked_id", otherId).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      cache.blocks = cache.blocks.filter(function (row) { return row.blockedId !== otherId; });
      return { ok: true };
    });
  }

  function addReport(input) {
    var blocked = requireClient();
    if (blocked) return Promise.resolve(blocked);
    var general = input.targetType === "general";
    return client().from("reports").insert({
      reporter_id: cache.user.id,
      community_id: cache.user.communityId,
      target_type: general ? "general" : input.targetType,
      target_id: general ? null : input.targetId,
      target_label: input.targetLabel || "",
      reason: input.reason,
      details: input.details || ""
    }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      return { ok: true };
    });
  }

  function adminReview(id, status, note) {
    return client().rpc("admin_review_submission", { p_id: id, p_status: status, p_note: note || null }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      return { ok: true };
    });
  }

  function adminOpen(id) {
    return client().rpc("admin_open_submission", { p_id: id }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      if (!res.data) return { ok: false, error: "That document has already been deleted." };
      return client().storage.from("verification-docs").createSignedUrl(res.data, 60).then(function (signed) {
        if (signed.error) return { ok: false, error: friendly(signed.error) };
        return { ok: true, url: signed.data.signedUrl };
      });
    });
  }

  function adminResolve(id, note) {
    return client().rpc("admin_resolve_report", { p_id: id, p_note: note || null }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      return { ok: true };
    });
  }

  function adminHide(id) {
    return client().rpc("admin_hide_listing", { p_id: id }).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error) };
      return { ok: true };
    });
  }

  function listingById(id) {
    if (cache.listing && cache.listing.id === id) return cache.listing;
    return cache.listings.filter(function (listing) { return listing.id === id; })[0]
      || cache.ownListings.filter(function (listing) { return listing.id === id; })[0]
      || null;
  }

  function listingPrice(listing) {
    if (!listing) return null;
    if (listing.type === "giveaway") return 0;
    if (listing.price === null || listing.price === "" || typeof listing.price === "undefined") return null;
    var num = Number(listing.price);
    return Number.isFinite(num) ? num : null;
  }

  root.BBLive = {
    init: init,
    booting: function () { return cache.booting; },
    prepare: prepare,
    error: function () { return cache.error; },
    communities: function () { return cache.communities || []; },
    sessionUser: function () { return cache.user; },
    userById: function (id) { return cache.users[id] || null; },
    listingPrice: listingPrice,
    visibleListings: function () { return cache.listings; },
    ownListings: function () { return cache.ownListings; },
    listingById: listingById,
    threadsFor: function () { return cache.threads; },
    threadById: function (id) {
      if (cache.thread && cache.thread.id === id) return cache.thread;
      return cache.threads.filter(function (thread) { return thread.id === id; })[0] || null;
    },
    threadUnread: function (thread) { return !!(thread && thread.unread); },
    unreadCount: function () {
      return cache.threads.filter(function (thread) { return thread.unread; }).length;
    },
    isBlocked: function (a, b) {
      return cache.blocks.some(function (row) {
        return (row.blockerId === a && row.blockedId === b) || (row.blockerId === b && row.blockedId === a);
      });
    },
    blockedByMe: function (otherId) {
      return cache.blocks.some(function (row) { return row.blockedId === otherId; });
    },
    myBlocks: function () { return cache.blocks; },
    myReports: function () { return cache.reports; },
    mySubmissions: function () { return cache.submissions; },
    adminSubmissions: function () { return cache.adminSubmissions; },
    adminReports: function () { return cache.adminReports; },
    auditLog: function () { return cache.audit; },
    signIn: signIn,
    register: register,
    signOut: signOut,
    requestReset: requestReset,
    updatePassword: updatePassword,
    updateProfile: updateProfile,
    saveListing: saveListing,
    setListingStatus: setListingStatus,
    deleteListing: deleteListing,
    submitDocument: submitDocument,
    ownDocumentUrl: ownDocumentUrl,
    saveDraft: function () { return { ok: true }; },
    ensureThread: ensureThread,
    sendMessage: sendMessage,
    markRead: function () { return Promise.resolve(); },
    blockUser: blockUser,
    unblockUser: unblockUser,
    addReport: addReport,
    adminReview: adminReview,
    adminOpen: adminOpen,
    adminResolve: adminResolve,
    adminHide: adminHide,
    signInDemo: function () { return { ok: false, error: "Demo mode is off." }; },
    reset: function () { return { ok: false }; },
    setVerificationStatus: function () { return { ok: false, error: "A reviewer sets this status." }; },
    state: function () { return { listings: cache.ownListings.concat(cache.listings) }; }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
