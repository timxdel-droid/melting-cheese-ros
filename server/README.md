# Server side

`mu-plugins/` is the WordPress must-use plugin directory on
**dev2.meltingcheese.food**. Everything the console and both apps talk to lives
here — there is no other copy.

| File | What it owns |
| --- | --- |
| `mc-auth.php` | API tokens: issue, verify, revoke. Every other route below is gated by it. |
| `mc-store.php` | `mc/v1/products`, `mc/v1/media` — the menu both apps read. |
| `mc-ingredients.php` | Ingredient lists attached to products. |
| `mc-app-config.php` | `mc/v1/app-config` (home layout, banners, events, release gates) and `mc/v1/releases/report`, which Codemagic posts to after a TestFlight upload. |
| `mc-orders.php` | `mc/v1/orders` — the apps place orders, the console reads and updates them. Owns add-on prices server-side so a tampered client cannot change what anything costs. **28 Sep:** kitchen lifecycle — derived `kitchen_status`, per-order `revision` (409 on stale), `action_id`/`edit_id` dedupe, cancel reason codes, `POST /orders/{id}/items` declarative edits, ETag/304 on the list. |
| `mc-console.php` | `mc/v1/console-state` — the ROS console's working state (events, trucks, layouts, banner packs…) stored on the server so every device sees the same setup. Per-section revisions; secrets stripped. |
| `mc-login.php` | `mc/v1/login`, `logout`, `me` — username + password for people; mints a 12 h / 30 d session token through mc-auth so every existing gate accepts it. |
| `mc-privacy.php` | Closes user enumeration: `wp/v2/users` 401 for anyone without `list_users`, author archives 404 for visitors, oEmbed author stripped, generic login / lost-password messages. |

## These files are deployed automatically

Pushing to `main` uploads this directory over FTP (see
`.github/workflows/deploy.yml`). **Editing a file through cPanel will be
overwritten by the next push.** Change it here instead.

Before uploading, the workflow runs `php -l` on every file. A parse error in an
mu-plugin takes the entire site down — including the endpoints the apps need to
function — so that check is not optional.

## If you do have to hand-edit on the server

Back the file up first (`cp mc-orders.php mc-orders.php.bak`), then copy your
change back into this repository the same day. A server that has drifted from
`main` is a trap for whoever deploys next.
