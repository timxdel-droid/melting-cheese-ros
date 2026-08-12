# Melting Cheese ROS

Restaurant operations system for **Melting Cheese Street Lab** — the back-of-house
counterpart to the customer iOS app ([melting-cheese-ios](https://github.com/timxdel-droid/melting-cheese-ios)).

## Stack

- **React + Vite** single-page app (PWA planned per the build handover)
- Design source: Figma — *Melting Cheese — App & Web v2 (Timmy Edition)*, ROS screens
- Data: WooCommerce on dev2.meltingcheese.food (same catalogue the customer app reads)
- Spec: *ROS Build Handover* — three layers (Training Academy, SOP Library, evidence-based ROS),
  multi-tenant white-label from day one (Melting Cheese UAE + Harvest UK)

## Roadmap

| Phase | Scope |
|-------|-------|
| 1     | Admin shell + core screens (login, dashboard, users, banners) — in progress |
| 2–9   | Remaining screens, menu manager, kitchen display, eMenu/wallboard, checklists & evidence engine, backend |
| 10+   | Kitchen operations mobile app |

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (static, deployable to any host)
```

## Conventions

- This repository is **private**. Even so, no secrets are committed — keys and credentials
  live in the deploy environment.
- Colours are CSS variables only (see `src/index.css`) so tenant theming can re-skin the
  app from config, per the white-label requirement.
- Screens are implemented from Figma; assets are exported, not redrawn.
