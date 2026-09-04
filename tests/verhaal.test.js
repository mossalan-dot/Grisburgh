const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http'); const os = require('os'); const path = require('path'); const fs = require('fs');
const DATA_DIR = path.join(os.tmpdir(), `grisburgh-test-verhaal-${Date.now()}`);
const REPO = require('path').join(__dirname, '..');
function req(server, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(p, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: {} };
    if (body) { const j = JSON.stringify(body); opts.headers['Content-Type']='application/json'; opts.headers['Content-Length']=Buffer.byteLength(j); }
    if (cookie) opts.headers['Cookie'] = cookie;
    const r = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ const sc=res.headers['set-cookie']; let p2; try{p2=JSON.parse(d)}catch{p2=d} resolve({status:res.statusCode, body:p2, cookie: sc?sc[0].split(';')[0]:cookie}); }); });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}
describe('Verhaaltekst per akte', () => {
  let server, io, dm;
  before(async () => {
    process.env.GRISBURGH_DATA_DIR = DATA_DIR;
    if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR,{recursive:true,force:true});
    for (const m of ['/server','/lib/storage','/routes/api','/routes/auth']) delete require.cache[require.resolve(REPO+m)];
    const mod = require(REPO + '/server'); server = mod.server; io = mod.io;
    await new Promise(r => server.listen(0, r));
    dm = (await req(server,'POST','/api/auth/login', { campagne: 'grisburgh', password:'grisburgh-dm'})).cookie;
    await req(server,'PUT','/api/meta/hoofdstuk/h1',{num:1,title:'Eerste'},dm);
    await req(server,'PUT','/api/meta/hoofdstuk/h2',{num:2,title:'Tweede'},dm);
    await req(server,'POST','/api/entities/personages',{name:'Brÿlwaen'},dm);
  });
  after(async () => { await io.close(); await new Promise(r=>server.close(r)); fs.rmSync(DATA_DIR,{recursive:true,force:true}); });

  it('bewaart de tekst en haalt de namen eruit', async () => {
    await req(server,'PUT','/api/meta/akte/h1/tekst',{tekst:'De party ontmoet [[Brÿlwaen]] in [[De Swarte Cat]].'},dm);
    const r = await req(server,'GET','/api/meta/akte/h1/namen',null,dm);
    const namen = r.body.namen.map(n => `${n.naam}:${n.kaartje?'kaartje':'geen'}:${n.nieuw?'nieuw':'terug'}`);
    assert.deepEqual(namen, ['Brÿlwaen:kaartje:nieuw', 'De Swarte Cat:geen:nieuw']);
  });

  it('herkent terugkerende namen uit een eerdere akte', async () => {
    await req(server,'PUT','/api/meta/akte/h2/tekst',{tekst:'Weer [[Brÿlwaen]], en nu ook [[Harmen Jonker]].'},dm);
    const r = await req(server,'GET','/api/meta/akte/h2/namen',null,dm);
    const map = Object.fromEntries(r.body.namen.map(n => [n.naam, n.nieuw]));
    assert.equal(map['Brÿlwaen'], false, 'kwam al voor in akte 1');
    assert.equal(map['Harmen Jonker'], true, 'die is nieuw');
  });

  it('vult verbindingen aan met [[namen]] uit de eigen tekst', async () => {
    const waard = (await req(server,'POST','/api/entities/personages',{name:'Waard'},dm)).body;
    const herberg = (await req(server,'POST','/api/entities/locaties',
      { name: 'De Herberg', data: { desc: 'Hier schenkt [[Waard]] in. Ook [[Iemand Anders]] komt hier.' } }, dm)).body;
    const opgehaald = (await req(server,'GET',`/api/entities/locaties/${herberg.id}`,null,dm)).body;
    assert.deepEqual(opgehaald.links.personages, ['Waard'], 'de genoemde naam met kaartje wordt een verbinding');
    assert.ok(!JSON.stringify(opgehaald.links).includes('Iemand Anders'), 'een naam zonder kaartje niet');
  });

  it('laat handmatig gelegde verbindingen staan', async () => {
    // Zes van de tien verbindingen in de echte campagne staan niet in de tekst;
    // afleiden mag ze dus niet vervangen maar alleen aanvullen.
    const e = (await req(server,'POST','/api/entities/organisaties',
      { name: 'Het Gilde', links: { personages: ['Handmatig Gelegd'], locaties: [], organisaties: [], voorwerpen: [], archief: [] },
        data: { desc: 'Het gilde vergadert met [[Waard]].' } }, dm)).body;
    const opgehaald = (await req(server,'GET',`/api/entities/organisaties/${e.id}`,null,dm)).body;
    assert.deepEqual(opgehaald.links.personages.sort(), ['Handmatig Gelegd', 'Waard'],
      'de bestaande verbinding blijft, de afgeleide komt erbij');
  });

  it('telt een alias en een dubbele vermelding als één naam', async () => {
    await req(server,'PUT','/api/meta/akte/h1/tekst',{tekst:'[[Brÿlwaen|de waard]] schenkt in. Later zegt [[Brÿlwaen]] iets.'},dm);
    const r = await req(server,'GET','/api/meta/akte/h1/namen',null,dm);
    assert.equal(r.body.namen.length, 1);
    assert.equal(r.body.namen[0].naam, 'Brÿlwaen');
  });
});
