# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**edgetunnel** is a Cloudflare Workers/Pages based proxy tunnel solution that supports multiple protocols (VLESS, Trojan, Shadowsocks) with various transport methods (WebSocket, XHTTP, gRPC). It includes a management admin panel and flexible proxy chain configuration.

## Architecture

### Entry Point
- **`_worker.js`** (~10,000 lines): Single-file Cloudflare Worker that handles all proxy operations, admin panel, subscription generation, and proxy chain routing.

### Main Request Flow
The `export default { async fetch(request, env, ctx) }` entry point routes requests based on:
1. **WebSocket Upgrade** (`处理WS请求`): VLESS/SS/Trojan proxy over WebSocket
2. **POST with gRPC content-type** (`处理gRPC请求`): gRPC-based proxy
3. **POST with XHTTP features** (`处理XHTTP请求`): HTTP-over-WebSocket proxy
4. **Admin Panel** (`/admin/*`): Configuration management interface (requires ADMIN env var + cookie auth)
5. **Subscription** (`/sub`, `/KEY`): Generates client subscription URLs

### Proxy Chain Architecture
The proxy supports multi-hop proxy chains:
- **First Hop**: Direct connection or PROXYIP reverse proxy
- **Second Hop (Landing Proxy)**: Optional SOCKS5/HTTP/HTTPS/TURN/SSTP upstream proxy
- Connection functions: `connectDirect`, `socks5Connect`, `httpConnect`, `httpsConnect`, `turnConnect`, `sstpConnect`

### Key Components
- **Protocol Parsers**: VLESS (`解析魏烈思请求`), Trojan (`解析木马请求`), Shadowsocks (AEAD encryption/decryption)
- **WebSocket Handler**: `处理WS请求` with early data support and explicit upload queue
- **TLS Client**: Custom `TlsClient` class for upstream TLS connections
- **Admin Panel**: Config stored in KV namespace, accessible via `/admin` routes

### Configuration System
- Environment variables control behavior (see README.md for full list)
- KV namespace binding (`KV`) stores dynamic configuration and logs
- Config structure in `读取config_JSON()` function
- Subscription configs support Clash, Sing-box, Surge formats

## Environment Variables (Key Ones)
- **`ADMIN`**: Admin panel password (required)
- **`KEY`**: Quick subscription path secret
- **`UUID`**: Fixed UUID for node validation
- **`PROXYIP`**: Global reverse proxy IP
- **`GO2SOCKS5`**: SOCKS5 proxy whitelist/force routes
- **`DEBUG`**: Enable debug logging (`"1"` or `"true"`)
- **`OFF_LOG`**: Disable logging
- **`BEST_SUB`**: Enable subscription generator mode

## Deployment
- **Workers**: Paste `_worker.js` content directly in CF Worker editor
- **Pages**: Upload `main.zip` or connect GitHub repo
- **Required bindings**: KV namespace (variable name: `KV`)

## Code Notes
- Uses Chinese variable names mixed with English (intentional obfuscation strategy)
- Large single-file architecture with ~100 functions
- WebSocket early data optimization (8KB limit)
- GrainTCP-style upload queue with 16MB limit and 4096 entry cap
- TCP concurrent dialing (4 parallel connections)