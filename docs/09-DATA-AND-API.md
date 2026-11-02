# Data Model and Internal Contracts

## Local SQLite entities
- `projects`: id, name, description, outputTargets JSON, status, createdAt, updatedAt, workspacePath.
- `project_versions`: id, projectId, parentId, storySpecHash, snapshotPath, createdAt, approved.
- `references`: id, projectId, url, fetchedAt, screenshotPath, observations JSON, status, sourceEvidence JSON.
- `discovery_answers`: id, projectId, questionId, answer JSON, createdAt.
- `assets`: id, projectId, kind, localPath, hash, provenance JSON, rightsStatus.
- `skills`: id, version, source, commitHash, license, manifest JSON, enabled, approved.
- `providers`: id, kind, displayName, capability JSON, authMode, lastProbeAt; no raw secrets.
- `jobs`: id, projectId, kind, status, providerId, startedAt, endedAt, progress JSON, error JSON.
- `job_events`: id, jobId, sequence, eventType, payload JSON, createdAt.
- `qa_runs`: id, projectVersionId, target, browser, viewport, status, reportPath.
- `license_findings`: id, projectVersionId, item, license, evidence, status, remediation.

## Typed IPC examples
- `projects.create({name, description, targets}) -> Project`
- `projects.list() -> Project[]`
- `projects.open({projectId}) -> ProjectDetail`
- `references.analyze({projectId, url}) -> JobId`
- `discovery.answer({projectId, questionId, answer}) -> DiscoveryState`
- `story.validate({projectId, spec}) -> ValidationResult`
- `generation.start({projectId, versionId, targets}) -> JobId`
- `generation.cancel({jobId}) -> void`
- `preview.start({projectId, target}) -> PreviewSession`
- `qa.run({projectId, targets}) -> JobId`
- `export.create({projectId, targets}) -> ExportResult`
- `providers.probe({providerId}) -> ProviderStatus`
- `skills.list() -> SkillManifest[]`
- `jobs.subscribe({jobId}) -> typed event stream`

## Contracts
All IPC payloads runtime-validated with Zod. IDs opaque UUIDs. File paths never accepted directly from renderer except through explicit file-picker grants. State transitions checked in core service. Event streams support replay after app restart.

## Export shape
```
<project>-export.zip
  html/                 # self-contained static site (no build step)
  react/                # Vite/TS React project source + package-lock.json (no node_modules, no dist)
  metadata/
    story-spec.json
    licenses.json
    asset-provenance.json
  README.md             # run, build and host instructions; license and rights status
  LICENSES.md           # generated code under MIT-0; third-party code keeps its own licenses
  THIRD_PARTY_NOTICES.md
  ASSET_CREDITS.md
  sbom.cdx.json         # CycloneDX 1.5
```
The archive is deterministic (sorted entries, fixed timestamps): the same outputs export to the same bytes. Export is refused when a selected output is missing or out of date with the StorySpec, when the React build has not succeeded, when any dependency license is blocked, or when an asset's rights are blocked; unknown asset rights are reported as needing review.
Only selected target directories included; exported site does not depend on studio APIs.
