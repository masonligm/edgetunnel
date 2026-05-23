# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**edgetunnel** (v2.1) is a Cloudflare Workers/Pages based proxy tunnel solution. It functions as a VLESS/Trojan/Shadowsocks proxy server deployed on Cloudflare's edge infrastructure, with comprehensive management capabilities and flexible proxy chain configuration.

### Key Features
- Multi-protocol support: VLESS, Trojan, Shadowsocks (AEAD encryption)
- Multiple transport layers: WebSocket, XHTTP (HTTP-over-WS), gRPC
- Web-based admin panel with real-time configuration and logging
- Multi-hop proxy chains (direct/PROXYIP first hop + optional landing proxy)
- Subscription generation for Clash, Sing-box, Surge clients
- Performance optimizations: early data, upload queue, TCP concurrent dialing
- Cross-platform client support: Windows, Android, iOS, macOS, routers

## Architecture

### Entry Point
- **`_worker.js`** (~580KB, ~10,243 lines): Single-file Cloudflare Worker containing all logic
- **`wrangler.toml`**: Wrangler CLI config (name = "v20251104", compatibility_date = "2025-11-04")
- **Version string**: Line 1 shows last build timestamp
- **Main export**: `export default { async fetch(request, env, ctx) }` at line 109

### Request Routing Logic
The `fetch()` function routes requests based on these patterns (in order):

1. **Version Check** (`/version?uuid=USERID`): Returns version number JSON
2. **WebSocket Upgrade** (`Upgrade: websocket`): Handles VLESS/SS/Trojan over WebSocket via `处理WS请求()`
3. **gRPC Proxy** (POST with `content-type: application/grpc`): gRPC-based proxy via `处理gRPC请求()`
4. **XHTTP Proxy** (POST with `x_padding` in referer): HTTP-over-WebSocket proxy via `处理XHTTP请求()`
5. **Admin Panel** (`/admin/*`): Web UI for configuration management (cookie auth required)
6. **Subscription** (`/sub`, `/KEY`): Generates client subscription configurations
7. **Login** (`/login`): Admin authentication page
8. **Static/Dynamic Pages**: Default landing page or custom URL

### Protocol Support

| Protocol | Transport | Key Functions | Status |
|----------|-----------|---------------|--------|
| VLESS | WebSocket/XHTTP/gRPC | `解析魏烈思请求()` | ✅ Full support |
| Trojan | WebSocket/XHTTP/gRPC | `解析木马请求()` | ✅ Full support |
| Shadowsocks | WebSocket/XHTTP/gRPC | `解析SS请求()` (AEAD) | ✅ Full support |
| VMess | WebSocket/XHTTP/gRPC | Legacy support | ⚠️ Basic |

### Proxy Chain Architecture

The project implements multi-hop proxy routing:

```
Client → [CF Worker] → First Hop → Landing Proxy (optional) → Target
                ↓
         (Direct or PROXYIP)  (SOCKS5/HTTP/HTTPS/TURN/SSTP)
```

**First Hop Options:**
- Direct connection (`connectDirect()`)
- PROXYIP reverse proxy (configurable via `PROXYIP` env var)
- Custom proxy via URL parameter: `/?proxyip=proxyip.cmliussss.net`

**Second Hop (Landing Proxy):**
- Configurable via admin panel
- Supports: SOCKS5 (`socks5Connect()`), HTTP (`httpConnect()`), HTTPS (`httpsConnect()`), TURN (`turnConnect()`), SSTP (`sstpConnect()`)
- Path-based override: `/?socks5=user:pass@host:port`
- Global SOCKS5 force: `GO2SOCKS5` env var for domain whitelist

### Key Components

| Component | Description | Key Functions/Classes |
|-----------|-------------|-----------------------|
| Protocol Parsers | Parse incoming VLESS, Trojan, SS requests | `解析魏烈思请求()`, `解析木马请求()`, `解析SS请求()` |
| WebSocket Handler | Core WS tunneling with early data | `处理WS请求()`, `处理上游响应()` |
| gRPC Handler | gRPC-stream based tunneling | `处理gRPC请求()` |
| XHTTP Handler | HTTP-over-WebSocket tunneling | `处理XHTTP请求()` |
| TLS Client | Custom upstream TLS connection | `TlsClient` class |
| Admin Panel | Web UI for config management | `/admin/*` routes |
| Subscription | Generate client configs | `Clash订阅()`, `SingBox订阅()`, `Surge订阅()` |
| Logger | Request/response logging | `log()` function, KV storage |

### Performance Optimizations

| Feature | Value | Implementation |
|---------|-------|----------------|
| WS Early Data | 8KB max | `WS早期数据最大字节` constant |
| Upload Queue | 16MB limit, 4096 entries | GrainTCP-style batching |
| Downstream Chunk | 32KB | `下行Grain包字节` constant |
| TCP Concurrent Dialing | 4 parallel | `TCP并发拨号数` constant |

### Configuration System

**Environment Variables:**
- Static configuration via Cloudflare Worker/Pages environment variables
- Dynamic configuration stored in KV namespace (`读取config_JSON()`)

**KV Storage:**
- Variable name must be `KV` (required binding)
- Stores: `config_JSON` (configuration), `log.json` (request logs), `landing.json` (landing proxy config)

**Subscription Formats:**
- Clash (Meta/Mihomo compatible)
- Sing-box
- Surge

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN` | ✅ | - | Admin panel password |
| `KEY` | ❌ | `勿动此默认密钥...` | Quick subscription path (`/KEY` redirects to `/sub`) |
| `UUID` | ❌ | MD5-based | Fixed UUID v4 for node validation |
| `PROXYIP` | ❌ | Auto-generated | Global reverse proxy IP (CF PoP-based) |
| `HOST` | ❌ | Current hostname | Multi-host support (comma-separated) |
| `URL` | ❌ | EDT pages | Landing page or `1101` for error page |
| `GO2SOCKS5` | ❌ | Pre-set list | SOCKS5 force routes (comma-separated domains) |
| `DEBUG` | ❌ | `false` | Enable `console.log` debugging (`1` or `true`) |
| `OFF_LOG` | ❌ | `false` | Disable logging (`1` or `true`) |
| `BEST_SUB` | ❌ | `false` | Enable subscription generator mode |

### KV Storage Keys
| Key | Purpose | Format |
|-----|---------|--------|
| `config.json` | Main configuration (protocol, transport, etc.) | JSON |
| `landing.json` | Landing proxy URL configuration | JSON |
| `cf.json` | Cloudflare API credentials | JSON |
| `tg.json` | Telegram bot configuration | JSON |
| `ADD.txt` | Custom preferred IPs | Plain text (one per line) |
| `log.json` | Request/response logs | JSON array |

### Landing Proxy Node Data Structure
Each node in `配置列表` has the following structure:
```json
{
  "名称": "Proxy1",
  "URL": "socks5://user:pass@host:port",
  "Selected": false
}
```
- **`Selected`**: Boolean flag synchronized with `当前选中`. When a node is selected, its `Selected` is `true` and all others are `false`. The `当前选中` field stores the selected node's `URL` string.
- **Backward compatibility**: Old data without `Selected` field is handled by `renderNodes()` which recalculates it from `当前选中`.

### Landing Proxy URL Configuration
The landing proxy (second hop) can be configured via:
1. **URL Parameter**: `/?landing=socks5://user:pass@host:port`
2. **KV Configuration**: Stored in `landing.json` with structure:
   ```json
   {
     "启用": false,
     "配置列表": [
       {
         "名称": "Proxy1",
         "URL": "socks5://user:pass@host:port",
         "Selected": false
       }
     ],
     "当前选中": "",
     "黑名单": ""
   }
   ```
   - **`启用`**: Boolean, defaults to `false`. Cannot be set to `true` if `配置列表` is empty (toggle is disabled + toast prompt).
   - **`当前选中`**: String, stores the URL of the currently selected node. Defaults to `""` (empty string, not `null`).
   - **`黑名单`**: String, comma-separated wildcard patterns for domains to bypass landing proxy (e.g., `*example.com,*.test.org`). Supports `*` wildcard matching.
3. **Admin API**: `GET/POST /admin/landing.json`

**Supported Protocols**: SOCKS5, HTTP, HTTPS, TURN, SSTP

**Priority Order**: URL parameter > KV configuration > None

### Landing Proxy Node CRUD Operations
- **Add Node**: Frontend form fills protocol + address + name → `addNode()` → pushes to `配置列表` → auto-selects first node → `saveConfig()` writes to KV.
- **Edit Node**: `editNode(idx)` loads node data into form → form switches to "保存修改" mode → `saveNodeEdit(idx)` updates node in place → `saveConfig()` writes to KV.
- **Delete Node**: `deleteNode(idx)` removes node → if deleted node was selected, auto-selects first remaining node → `saveConfig()` writes to KV.
- **Select Node**: `selectNode(idx)` updates `当前选中` and syncs `Selected` flags → `saveConfig()` writes to KV.
- **Toggle Enable/Disable**: Enable switch is disabled when `配置列表` is empty. Attempting to enable without nodes shows a toast prompt.

### SOCKS5 Whitelist (Default)
The following domains are pre-configured for SOCKS5 routing:
- `*tapecontent.net`, `*cloudatacdn.com`, `*loadshare.org`, `*cdn-centaurus.com`
- `scholar.google.com`

## Deployment

### Workers Deployment
1. Create CF Worker → paste `_worker.js` content
2. Add `ADMIN` environment variable (password)
3. Bind KV namespace (variable name: `KV`)
4. Add custom domain in Triggers tab
5. Access admin at `https://your-domain.com/admin`

### Pages Deployment (Recommended)
1. Upload `main.zip` or connect GitHub repo
2. Set `ADMIN` environment variable in Settings > Environment variables
3. Create deployment after adding env vars
4. Bind KV namespace (Settings > Bindings > Add > KV namespace, name: `KV`)
5. Add CNAME custom domain (not root domain)
6. Access admin at `https://sub-domain.com/admin`

### Authentication
- Cookie-based auth using MD5 hash of `UA + KEY + ADMIN`
- Max cookie age: 86400 seconds (24 hours)
- Secure, HttpOnly, SameSite=Strict cookies

## Code Notes

### Naming Conventions
- **Chinese variable names**: Intentional obfuscation strategy mixed with English
  - Examples: `处理WS请求` (Handle WS request), `解析魏烈思请求` (Parse VLESS request)
  - Why: Adds layer of complexity for automated code analysis

### Code Organization
- Single-file architecture with ~100 functions
- Global state variables: lines 2-20 (e.g., `反代IP`, `启用SOCKS5反代`, `落地代理`, `CF环境`)
- Constants: lines 21-107 (e.g., `SOCKS5白名单`, `WS早期数据最大字节`, `TCP并发拨号数`)
- Embedded HTML pages: lines 50-54 (gzip+base64 B64 constants)
- Main `fetch()` entry point: line 109
- Protocol parsers: `解析魏烈思请求()` (~line 2958), `解析木马请求()` (~line 2835), `解析SS请求()` (inline)
- Transport handlers: `处理WS请求()` (~line 2202), `处理gRPC请求()` (~line 1823), `处理XHTTP请求()` (~line 1443)
- Proxy connectors: `socks5Connect()` (~line 4152), `httpConnect()` (~line 4228), `httpsConnect()` (~line 4328), `turnConnect()` (~line 6301), `sstpConnect()` (~line 6647)
- `TlsClient` class: line 5296
- Subscription generators: `Clash订阅配置文件热补丁()` (~line 7333), `Singbox订阅配置文件热补丁()` (~line 7602), `Surge订阅配置文件热补丁()` (~line 8060)
- Configuration: `读取config_JSON()` (~line 8698)

### Security Considerations
- No API key storage in code (uses environment variables)
- Cookie-based admin authentication
- UUID validation for protocol clients
- TLS support for upstream connections
- CORS handling for admin panel

### Debugging
- Enable `DEBUG=1` or `DEBUG=true` for `console.log` output
- Use `OFF_LOG=1` to disable logging entirely
- Check KV `log.json` for request history (via admin panel)
- Version check endpoint: `GET /version?uuid=USERID`

## Common Operations

### Modifying Proxy Chain
1. Access admin panel at `/admin`
2. Navigate to proxy configuration section
3. Add landing proxy (SOCKS5/HTTP/HTTPS/TURN/SSTP)
4. Save to KV

### Generating Subscription
- Quick path: `https://domain.com/KEY` (redirects to `/sub`)
- Standard path: `https://domain.com/sub?token=TOKEN`
- Formats: add `?format=clash/singbox/surge` to URL

### Dynamic Proxy Override
Via URL parameters:
- `/?proxyip=proxyip.cmliussss.net`
- `/?socks5=user:password@127.0.0.1:1080`
- `/?http=user:password@127.0.0.1:1080`

### Error Handling
- Missing `ADMIN`: Returns 404 with `noADMIN` page
- HTTP requests: Redirect to HTTPS (301)
- Invalid auth: Redirect to `/login`
- KV missing: Falls back to in-memory defaults

## File Structure

```
edgetunnel/
├── _worker.js          # Main Worker script (all logic)
├── CLAUDE.md           # This file
├── README.md           # User documentation
├── LICENSE             # MIT License
├── CHANGELOG           # Version history
├── wrangler.toml       # Wrangler CLI config (name = "v20251104", compatibility_date = "2025-11-04")
├── img.png             # Admin panel screenshot
├── .gitignore          # Git ignore rules
├── .github/            # GitHub workflows (Auto-close-empty-PRs.yml, sync.yml)
└── .vscode/            # VS Code settings
```

## Development

### Local Development
```bash
# Start local dev server (requires wrangler CLI)
npx wrangler dev

# Deploy to Cloudflare Workers
npx wrangler deploy
```
- Set `ADMIN` environment variable locally via `wrangler.toml` or `.dev.vars`
- KV namespace binding requires uncommenting `[[kv_namespaces]]` in `wrangler.toml` and providing a KV ID

### Embedded HTML Page Workflow
The admin panel, login, landing, and error pages are embedded as gzip-compressed base64 strings in `_worker.js` (lines 50-54). To modify:
```js
// Decode
const html = new TextDecoder().decode(pako.ungzip(atob(B64_STRING)));
// Edit html, then re-encode:
const b64 = btoa(String.fromCharCode(...pako.gzip(new TextEncoder().encode(html))));
```
Constants: `HTML_LOGIN_B64`, `HTML_NOADMIN_B64`, `HTML_NOKV_B64`, `HTML_ADMIN_B64`, `HTML_LANDING_B64`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Error 1101 | Check custom domain configuration, ensure DNS CNAME is correct |
| Admin panel 404 | Verify `ADMIN` env var is set |
| KV binding errors | Ensure KV namespace is created and bound as `KV` |
| Proxy not working | Check UUID validation, verify protocol support in client |
| Subscription empty | Check `KEY` or `ADMIN` env vars, verify token format |