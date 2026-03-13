const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TEST_DATA = path.join(__dirname, '..', 'data');

describe('Storage', () => {
  let storage;

  before(() => {
    if (fs.existsSync(TEST_DATA)) fs.rmSync(TEST_DATA, { recursive: true });
    delete require.cache[require.resolve('../lib/storage')];
    storage = require('../lib/storage');
  });

  after(() => {
    if (fs.existsSync(TEST_DATA)) fs.rmSync(TEST_DATA, { recursive: true });
  });

  it('should auto-create data files on init', () => {
    storage.init();
    assert.ok(fs.existsSync(path.join(TEST_DATA, 'entities.json')));
    assert.ok(fs.existsSync(path.join(TEST_DATA, 'archief.json')));
    assert.ok(fs.existsSync(path.join(TEST_DATA, 'dm-state.json')));
    assert.ok(fs.existsSync(path.join(TEST_DATA, 'meta.json')));
    assert.ok(fs.existsSync(path.join(TEST_DATA, 'files')));
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
    assert.ok(!fs.existsSync(path.join(TEST_DATA, 'entities.json.tmp')));
    assert.strictEqual(storage.readJSON('entities.json').atomic, true);
  });
});
