---
"@agul/react": minor
---

Add `proxyUrl` to `AGULRenderer` (and `withProxy`, `createAgulHttp(getAuth, getProxyUrl)`) to route API and spec requests through a same-origin CORS proxy. AGUL navigation now keeps the host page's query string (e.g. `?spec=`), so deep links and reloads stay on the same spec.
