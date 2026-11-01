import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { StudioStore } from '../src/index.ts';

const hash = 'a'.repeat(64);
const file = async () => path.join(await mkdtemp(path.join(tmpdir(), 'studio-db-')), 'studio.db');

describe('StudioStore', () => {
  it('migrates a fresh database and refuses databases from newer apps', async () => {
    const f = await file();
    const store = StudioStore.open(f);
    expect(store.schemaVersion).toBe(1);
    store.close();
    const raw = new DatabaseSync(f);
    raw.exec('PRAGMA user_version = 99');
    raw.close();
    expect(() => StudioStore.open(f)).toThrow(/newer than this app/);
  });

  it('orders projects by most recently opened', async () => {
    const store = StudioStore.open(await file());
    store.upsertProject({ id: 'alpha', name: 'Alpha', goal: 'a' });
    store.upsertProject({ id: 'beta', name: 'Beta', goal: 'b' });
    await new Promise((r) => setTimeout(r, 5));
    store.touchProject('alpha');
    expect(store.listProjects().map((p) => p.id)).toEqual(['alpha', 'beta']);
    expect(store.hasProject('alpha')).toBe(true);
    expect(store.hasProject('nope')).toBe(false);
  });

  it('records versions with parents, newest first, and enforces project FK', async () => {
    const store = StudioStore.open(await file());
    store.upsertProject({ id: 'p', name: 'P', goal: 'g' });
    const v1 = store.addVersion({ id: randomUUID(), projectId: 'p', parentId: null, label: 'Created', hash, snapshotPath: 'snapshots/1.json' });
    const v2 = store.addVersion({ id: randomUUID(), projectId: 'p', parentId: v1.id, label: 'Edit', hash, snapshotPath: 'snapshots/2.json', approved: true });
    expect(store.listVersions('p').map((v) => v.id)).toEqual([v2.id, v1.id]);
    expect(store.latestVersion('p')).toMatchObject({ id: v2.id, parentId: v1.id, approved: true });
    expect(store.getVersion('p', v1.id)?.snapshotPath).toBe('snapshots/1.json');
    expect(() => store.addVersion({ id: randomUUID(), projectId: 'ghost', parentId: null, label: 'x', hash, snapshotPath: 'x' })).toThrow();
  });

  it('persists job logs across reopen and marks interrupted jobs', async () => {
    const f = await file();
    let store = StudioStore.open(f);
    store.upsertProject({ id: 'p', name: 'P', goal: 'g' });
    const base = { kind: 'generate' as const, projectId: 'p', targets: ['html' as const], log: [], error: null };
    store.recordJobStart({ ...base, id: randomUUID(), status: 'running' });
    const done = randomUUID();
    store.recordJobStart({ ...base, id: done, status: 'running' });
    store.appendJobLog(done, 'step 1');
    store.appendJobLog(done, 'step 2');
    store.recordJobEnd(done, 'succeeded', null);
    store.close();

    store = StudioStore.open(f);
    expect(store.markInterruptedJobs()).toBe(1);
    const jobs = store.listJobs('p');
    expect(jobs.find((j) => j.id === done)).toMatchObject({ status: 'succeeded', log: ['step 1', 'step 2'] });
    expect(jobs.find((j) => j.id !== done)).toMatchObject({ status: 'failed', error: expect.stringContaining('Interrupted') });
  });

  it('stores provider probe results without secrets', async () => {
    const store = StudioStore.open(await file());
    expect(store.lastProbeAt()).toBeNull();
    store.saveProviderStatuses([{ id: 'codex', displayName: 'Codex CLI', state: 'not-found', version: null, authentication: 'managed-by-provider-cli', detail: null }]);
    expect(store.lastProbeAt()).not.toBeNull();
  });
});
