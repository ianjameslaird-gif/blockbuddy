(function (root) {
  "use strict";

  root.BBData = {
    community: {
      id: "skypeak",
      name: "SkyPeak @ Bukit Batok",
      residentLabel: "SkyPeak @ Bukit Batok resident",
      pilot: "HDB pilot"
    },
    retentionDays: 90,
    demo: {
      email: "demo@skypeak.example",
      password: "neighbour",
      userId: "u_alex"
    },
    users: [
      {
        id: "u_alex",
        preferredName: "Alex Tan",
        email: "demo@skypeak.example",
        password: "neighbour",
        bio: "I pass things on when a neighbour can use them. Evenings are easiest.",
        memberDaysAgo: 420,
        verification: "verified"
      },
      {
        id: "u_mei",
        preferredName: "Mei Lin Tan",
        email: "mei.lin@skypeak.example",
        password: null,
        bio: "Home baker. Jars, tins and the odd board game leave my kitchen regularly.",
        memberDaysAgo: 860,
        verification: "verified"
      },
      {
        id: "u_arjun",
        preferredName: "Arjun Pillai",
        email: "arjun@skypeak.example",
        password: null,
        bio: "Weekend badminton nearby. Happy to sell or swap sports gear.",
        memberDaysAgo: 310,
        verification: "verified"
      },
      {
        id: "u_siti",
        preferredName: "Siti Rahman",
        email: "siti@skypeak.example",
        password: null,
        bio: "Two kids, a lot of outgrown things, and a preference for giving them a second home.",
        memberDaysAgo: 640,
        verification: "verified"
      },
      {
        id: "u_weijie",
        preferredName: "Wei Jie Koh",
        email: "weijie@skypeak.example",
        password: null,
        bio: "Working from a bedroom desk. Looking for small furniture that actually fits.",
        memberDaysAgo: 210,
        verification: "verified"
      },
      {
        id: "u_priya",
        preferredName: "Priya Nair",
        email: "priya@skypeak.example",
        password: null,
        bio: "Corridor plants and weeknight air-fryer experiments.",
        memberDaysAgo: 540,
        verification: "verified"
      },
      {
        id: "u_daniel",
        preferredName: "Daniel Ong",
        email: "daniel@skypeak.example",
        password: null,
        bio: "Spring cleaning, one storeroom shelf at a time.",
        memberDaysAgo: 980,
        verification: "verified"
      },
      {
        id: "u_lim",
        preferredName: "Lim Boon Huat",
        email: "lim@skypeak.example",
        password: null,
        bio: "If it still works, someone on this block can use it.",
        memberDaysAgo: 1400,
        verification: "verified"
      },
      {
        id: "u_hannah",
        preferredName: "Hannah Teo",
        email: "hannah@skypeak.example",
        password: null,
        bio: "Clearing last year's school books and a few bits from the bedroom.",
        memberDaysAgo: 120,
        verification: "verified"
      }
    ],
    listings: [
      {
        id: "l_shelf",
        ownerId: "u_daniel",
        type: "giveaway",
        title: "White cube shelf, 2 by 4",
        description: "White cube shelf, two columns by four rows. One peg is slightly loose but it stands steady against a wall. We are clearing the spare room. Collect from the ground-floor lobby on Saturday morning.",
        category: "furniture",
        condition: "Good",
        price: 0,
        art: "shelf",
        hoursAgo: 6
      },
      {
        id: "l_vacuum",
        ownerId: "u_mei",
        type: "sell",
        title: "Cordless stick vacuum",
        description: "Cordless stick vacuum, about 18 months old. Suction is still strong after a normal flat clean. Wall mount and the main brush are included. The battery holds a full living-room session.",
        category: "electronics",
        condition: "Good",
        price: 85,
        art: "vacuum",
        hoursAgo: 10
      },
      {
        id: "l_books",
        ownerId: "u_hannah",
        type: "sell",
        title: "Primary 3 assessment books",
        description: "Primary 3 assessment books for English, Maths and Chinese. Light pencil marks, no torn pages. Useful if you have a child moving up next year.",
        category: "books",
        condition: "Good",
        price: 12,
        art: "books",
        hoursAgo: 18
      },
      {
        id: "l_highchair",
        ownerId: "u_siti",
        type: "giveaway",
        title: "Baby high chair with tray",
        description: "Sturdy high chair with a wipe-clean tray and working straps. Our little one has outgrown it. Free to a neighbour who can collect it from the lobby.",
        category: "kids",
        condition: "Good",
        price: 0,
        art: "highchair",
        hoursAgo: 22
      },
      {
        id: "l_plants",
        ownerId: "u_priya",
        type: "trade",
        title: "Snake plant and money plant",
        description: "One snake plant and one money plant, both happy beside a corridor window. I would love to trade for a baking tray or a pair of mixing bowls.",
        category: "plants",
        condition: "Like new",
        price: null,
        art: "plants",
        hoursAgo: 26
      },
      {
        id: "l_rackets",
        ownerId: "u_arjun",
        type: "sell",
        title: "Badminton rackets, pair",
        description: "Two aluminium rackets from our weekend games, plus a half-used tube of shuttlecocks. Grips are still decent.",
        category: "sports",
        condition: "Good",
        price: 28,
        art: "rackets",
        hoursAgo: 30
      },
      {
        id: "l_desk",
        ownerId: "u_weijie",
        type: "wanted",
        title: "Compact study desk wanted",
        description: "Looking for a compact study desk that fits a common bedroom. Light scratches are fine. I can collect from the lobby.",
        category: "furniture",
        condition: "Any",
        price: 40,
        art: "desk",
        hoursAgo: 36
      },
      {
        id: "l_rice",
        ownerId: "u_lim",
        type: "sell",
        title: "1.8L rice cooker",
        description: "1.8 litre rice cooker. It still cooks a family pot evenly. The pot has everyday marks and the cord is fine.",
        category: "kitchen",
        condition: "Good",
        price: 22,
        art: "rice",
        hoursAgo: 40
      },
      {
        id: "l_curtains",
        ownerId: "u_hannah",
        type: "giveaway",
        title: "Grey blackout curtains, two panels",
        description: "Two grey blackout panels from a common bedroom width. Hooks are in a bag. Freshly washed and ready to collect.",
        category: "home",
        condition: "Good",
        price: 0,
        art: "curtains",
        hoursAgo: 48
      },
      {
        id: "l_games",
        ownerId: "u_mei",
        type: "sell",
        title: "Family board games bundle",
        description: "Catan, Uno and a Singapore edition party game. We counted the pieces. Lovely for a family weekend at home.",
        category: "games",
        condition: "Good",
        price: 18,
        art: "games",
        hoursAgo: 54
      },
      {
        id: "l_bike",
        ownerId: "u_siti",
        type: "trade",
        title: "16-inch children's bicycle",
        description: "16-inch children's bicycle. Stabilisers are in the storeroom. Looking to trade for a kick scooter in similar shape.",
        category: "kids",
        condition: "Fair",
        price: null,
        art: "bicycle",
        hoursAgo: 60
      },
      {
        id: "l_fryer",
        ownerId: "u_priya",
        type: "sell",
        title: "Compact 3.5L air fryer",
        description: "3.5 litre air fryer, lightly used for sweet potato wedges and reheating leftovers. Basket is clean. Manual included.",
        category: "kitchen",
        condition: "Like new",
        price: 48,
        art: "airfryer",
        hoursAgo: 72
      },
      {
        id: "l_boxes",
        ownerId: "u_daniel",
        type: "giveaway",
        title: "Six storage boxes with lids",
        description: "Six clear storage boxes with lids, a mix of sizes. Perfect for a storeroom tidy. Please take all six if you can.",
        category: "home",
        condition: "Good",
        price: 0,
        art: "boxes",
        hoursAgo: 80
      },
      {
        id: "l_rack",
        ownerId: "u_lim",
        type: "sell",
        title: "Foldable laundry drying rack",
        description: "Winged laundry rack, no rust, folds flat beside the service yard. One clip is a different colour.",
        category: "home",
        condition: "Good",
        price: 16,
        art: "rack",
        hoursAgo: 96
      },
      {
        id: "l_fan",
        ownerId: "u_arjun",
        type: "wanted",
        title: "Quiet standing fan wanted",
        description: "Hoping for a quiet standing fan that will not disturb a sleeping baby. Oscillation preferred.",
        category: "electronics",
        condition: "Any",
        price: 30,
        art: "fan",
        hoursAgo: 110
      },
      {
        id: "l_mugs",
        ownerId: "u_mei",
        type: "sell",
        title: "Enamel mugs, set of four",
        description: "Four enamel mugs in kopitiam colours. No chips. Nice for supper at home.",
        category: "kitchen",
        condition: "Like new",
        price: 12,
        art: "mugs",
        hoursAgo: 130
      },
      {
        id: "l_office",
        ownerId: "u_weijie",
        type: "sell",
        title: "Mesh work chair",
        description: "Mesh work chair with adjustable height. Fine for a full day at a laptop. One caster sticks a little on tile.",
        category: "furniture",
        condition: "Fair",
        price: 40,
        art: "chair",
        hoursAgo: 150
      },
      {
        id: "l_cards",
        ownerId: "u_hannah",
        type: "giveaway",
        title: "PSLE Chinese flash cards",
        description: "PSLE Chinese flash cards, full set, no handwriting. Passing them on now that exams are over.",
        category: "books",
        condition: "Good",
        price: 0,
        art: "cards",
        hoursAgo: 170
      }
    ],
    threads: [
      {
        id: "t_plants",
        participantIds: ["u_alex", "u_priya"],
        listingId: "l_plants",
        messages: [
          {
            senderId: "u_priya",
            body: "Hi Alex — the snake plant and money plant are still looking for a home. I can meet at the void deck after 7 if you want them.",
            hoursAgo: 30
          },
          {
            senderId: "u_alex",
            body: "That would be lovely. Would tomorrow evening work?",
            hoursAgo: 28
          },
          {
            senderId: "u_priya",
            body: "Yes. Let's say 7.30 near the letterboxes. I will bring both pots.",
            hoursAgo: 5
          }
        ],
        readHoursAgo: { u_alex: 20, u_priya: 5 }
      },
      {
        id: "t_chair",
        participantIds: ["u_alex", "u_siti"],
        listingId: "l_highchair",
        messages: [
          {
            senderId: "u_siti",
            body: "Hello! The high chair is free, and the tray and straps are included. It just needs a wipe.",
            hoursAgo: 50
          },
          {
            senderId: "u_alex",
            body: "Thank you, Siti. I am collecting it for my niece. Is the ground-floor lobby all right?",
            hoursAgo: 48
          },
          {
            senderId: "u_siti",
            body: "Lobby works. I will message you before I head down.",
            hoursAgo: 47
          }
        ],
        readHoursAgo: { u_alex: 1, u_siti: 47 }
      }
    ],
    actionReason: "We could not confirm the address for your community. Please upload a clearer photo of a recent bill or letter. Cover account numbers and other financial details, and leave your name and address visible."
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
