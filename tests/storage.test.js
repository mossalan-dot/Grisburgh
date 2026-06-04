const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// #47: isoleer in een tmpdir. #44: storage schrijft per-campagne onder
// campaigns/<id> (default 'grisburgh'), niet meer plat in data/.
const TEST_BASE = path.join(os.tmpdir(), `grisburgh-test-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const CAMP_DIR = path.join(TEST_BASE, 'campaigns', 'grisburgh');

describe('Storage', () => {
  let storage;

  before(() => {
    // Env vlak vóór de require zetten — proces is gedeeld met andere testbestanden,
    // dus een module-top-assignment zou door een ander bestand overschreven kunnen zijn.
    process.env.GRISBURGH_DATA_DIR = TEST_BASE;
    delete require.cache[require.resolve('../lib/storage')];
    storage = require('../lib/storage');
  });

  after(() => {
    if (fs.existsSync(TEST_BASE)) fs.rmSync(TEST_BASE, { recursive: true, force: true });
  });

  it('should auto-create data files on init', () => {
    storage.init();
    assert.ok(fs.existsSync(path.join(CAMP_DIR, 'entities.json')));
    assert.ok(fs.existsSync(path.join(CAMP_DIR, 'archief.json')));
    assert.ok(fs.existsSync(path.join(CAMP_DIR, 'dm-state.json')));
    assert.ok(fs.existsSync(path.join(CAMP_DIR, 'meta.json')));
    assert.ok(fs.existsSync(path.join(CAMP_DIR, 'files')));
  });

  it('should read/write JSON roundtrip', () => {
    const data = { test: 'value', nested: { a: 1 } };
    storage.writeJSON('entities.json', data);
    const result = storage.readJSON('entities.json');
    assert.deepStrictEqual(result, data);
  });

  it('should not overwrite existing files on re-init', () => {
    storage.writeJSON('entities.json', { custom: true });
    storage.init();
    const result = storage.readJSON('entities.json');
    assert.strictEqual(result.custom, true);
  });

  it('should save and retrieve files', () => {
    const buffer = Buffer.from('fake image data');
    const filename = storage.saveFile('test-img', buffer, 'image/png');
    assert.ok(filename.startsWith('test-img'));
    const file = storage.getFile('test-img');
    assert.ok(file);
    assert.strictEqual(file.mimetype, 'image/png');
  });

  it('should delete files', () => {
    storage.deleteFile('test-img');
    const file = storage.getFile('test-img');
    assert.strictEqual(file, null);
  });

  it('should use atomic writes (temp file rename)', () => {
    storage.writeJSON('entities.json', { atomic: true });
    // The .tmp file should not exist after write
    assert.ok(!fs.existsSync(path.join(CAMP_DIR, 'entities.json.tmp')));
    assert.strictEqual(storage.readJSON('entities.json').atomic, true);
  });
});
