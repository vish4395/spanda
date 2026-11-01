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
export/
  html/                 # self-contained static site source
  react/                # Vite/TS React project source
  metadata/
    story-spec.json
    licenses.json
    asset-provenance.json
  THIRD_PARTY_NOTICES.md
  ASSET_CREDITS.md
  README.md
```
Only selected target directories included; exported site does not depend on studio APIs.
