# OPC UA Dependency Review

Change: `add-opcua-production-hardening`

## Decision

Use `node-opcua` for this learning/simulator phase.

## Rationale

- Provides both OPC UA client and server APIs, so the project can implement `OpcUaAdapter` and an independent OPC UA Simulator with one dependency family.
- TypeScript definitions are included.
- Runs in Electron Main Process / Node.js, which matches the project boundary that industrial communication must not run in Renderer.
- License is MIT.
- Supports local anonymous / no-security endpoints required by this simulator phase.

## Electron And Packaging Notes

- The dependency is production runtime code and is kept out of Renderer imports by architecture boundary tests.
- `node-opcua` may create local client certificate material on first use. This is acceptable for local simulator work but must be reviewed before production packaging.
- Current implementation only enables `MessageSecurityMode.None` / `SecurityPolicy.None` for the local simulator.
- `node-opcua-debug` requests `hexy@0.4.0`, which is ESM-only and fails under Electron 33 / Node 20 CommonJS loading. The project pins `hexy` to `0.3.5` through Yarn `resolutions` and verifies the Electron runtime with `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e "require('node-opcua')"`.

## Risks

- The package is broad and adds dependency weight.
- Production OPC UA security policy, certificate trust store, user identity, namespace discovery, vendor profiles, and method calls are out of scope.
- Long-running reconnect/subscription cleanup must be covered by smoke and manual extended profiles.

## Rejected Alternatives

- Hand-rolling OPC UA: rejected because it would be high risk and outside project scope.
- Using only a mock OPC UA layer: rejected because the change requires a real simulator + adapter integration path.
