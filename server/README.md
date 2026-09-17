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
| `mc-orders.php` | `mc/v1/orders` — the apps place orders, the console reads and updates them. Owns add-on prices server-side so a tampered client cannot change what anything costs. |

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
