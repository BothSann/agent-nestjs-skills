# Practice selection

Hints are text-search results. Read their file:line evidence; for "missing", search alternative setup names/locations. Discard disproven hints. Read the hint's named best-practice rule, applying project rules first. One practice per lesson unless the owner asks to combine small changes.

| Hint | Focus / learning goal |
|---|---|
| validation-pipe | Global validation, whitelist/unknown-field policy, nested DTOs; prove unexpected protected fields are refused |
| config-validation | ConfigModule with typed startup validation; reject missing/invalid required project settings |
| raw-process-env | Centralize environment access in config; inject consumers |
| shutdown-hooks | Shutdown lifecycle, readiness, closing pools/jobs |
| health-checks | Project liveness/readiness contract; dependency checks only for dependencies actually used |
| security-headers | Installed-version security headers or project Helmet setup |
| cors | Correct an unsafe enabled policy; preserve disabled CORS when browser access is unnecessary |
| rate-limiting | Global/per-route limits on existing endpoints, correct identities/proxy handling |
| exception-filter | One project error shape; expected domain/database failures mapped correctly |
| migrations | Replace unsafe synchronize or create missing migrations with the existing ORM/tool |
| logger | Replace console usage; configured structured logging with safe context |
| unit-tests | First behavior test, appropriate Nest fakes or plain domain tests |
| e2e-tests | Real bootstrap/request behavior; isolated persistence only when needed |

## Empty-repo scaffold
Only for no_nest_app: project-native Nest generator, strict TypeScript, first boot/route, validated config, validation pipe, shutdown hooks, and health endpoint. Add a database connection only if the agreed task needs one; no synchronize. Auth/features/Docker are later work.
Keep the scope learnable; owner may defer health/shutdown/persistence. Criteria: boot, chosen route's actual status/body, invalid required config rejected, configured build/lint gates pass. Use actual project commands and prove them in the worktree, not assumed npm script names.
