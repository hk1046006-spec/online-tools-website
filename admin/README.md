# admin/

The admin panel has **no static HTML files on purpose**.

Every admin page is rendered on the server by Express (`lib/pages/admin.js`) and is only produced
after the session has been verified, so there is nothing here for a visitor to download, guess or
open directly — a static `dashboard.html` would be fetchable by anyone even without logging in.

The URLs behave exactly as the static-file layout would:

| URL                | Rendered by                          |
| ------------------ | ------------------------------------ |
| `/admin`           | `adminDashboard()` — overview        |
| `/admin/login`     | `adminLogin()` — sign-in form        |
| `/admin/settings`  | `adminSettings()` — site settings    |
| `/admin/content`   | `adminContent()` — page content      |
| `/admin/images`    | `adminImages()` — image manager      |
| `/admin/messages`  | `adminMessages()` — contact inbox    |
| `/admin/logout`    | POST only, destroys the session      |

Authentication, CSRF protection and all write operations are handled in `server.js`.
