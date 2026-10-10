# MongoDB read/cache application release — 2026-10-10

The source patch replaces enumerated Redis deletion with committed MongoDB scope generations, reuses bounded TLS Redis connections, coalesces in-flight loads, fixes MCP summary collection access, reduces date scans with distinct, and bounds previous overseas snapshot reads. The existing three nonunique read indexes are included in idempotent index setup.

This release is based on latest remote main f3ae028 and preserves its overseas MCP support, authorization and tracking behavior. Public MCP research tracks both Taiwan/global generations. The independent Function package includes @redis/client. No schema/data deletion, infrastructure, scheduling or tracking changes.

Validation: 365 tests passed, four existing opt-in Mongo integration tests skipped; Functions, MCP and frontend builds, prerender verification, standalone packaged entry import, and diff check passed. Production acceptance remains separate until both exact release versions and live cache/fallback behavior are verified. The historical overseas report sort bottleneck remains a subsequent investigation.
