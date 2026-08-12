# Melting Cheese ROS

Restaurant operations system for **Melting Cheese Street Lab** — the back-of-house
counterpart to the customer iOS app ([melting-cheese-ios](https://github.com/timxdel-droid/melting-cheese-ios)).

## Stack

- **React + Vite** single-page app
- Design source: Figma — *Melting Cheese — App & Web v2 (Timmy Edition)*, ROS screens (11 frames)
- Data: WooCommerce on dev2.meltingcheese.food (same catalogue the customer app reads)

## Roadmap

| Phase | Scope |
|-------|-------|
| 1–10  | This web dashboard: implement the 11 ROS screens from Figma |
| 10+   | Kitchen operations mobile app |

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (static, deployable to any host)
```

## Conventions

- No secrets in this repo — it is public. Keys and credentials live in the deploy environment.
- Screens are implemented from Figma via the design-to-code pipeline; assets are exported, not redrawn.
