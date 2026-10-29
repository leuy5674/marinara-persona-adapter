import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, characterFields, characterGreetings, selectedGreeting, personaFields, parseResult, schemaFor, TRAIT_SCHEMA, assertPlaceholders, copyAll, exportName } from '../src/model.js';
import { prompt, MODES, LENGTHS } from '../src/prompts.js';
import { createGeneration } from '../src/generation.js';
import { createApi } from '../src/api.js';
const persona = { name: '샘플 페르소나', description: '줄1\n"줄2" {{user}}', personality: '신중함', backstory: '과거', appearance: '외모', scenario: '{{char}} 곁' };
test('exact Character field projection uses current nested format and excludes Lorebook', () => {
  const data = { name: '별', description: '설명', personality: '성격', extensions: { backstory: '과거', appearance: '외모' }, scenario: '상황', first_mes: '{{user}} 첫말' };
  Object.defineProperty(data, 'character_book', { get() { throw Error('must not read lorebook'); } });
  const c = characterFields({ data }); assert.equal(c.backstory, '과거'); assert.equal(c.appearance, '외모'); assert.equal(c.firstMes, '{{user}} 첫말'); assert.equal(Object.keys(c).length, 7);
  assert.equal(characterFields({ data: {} }).backstory, '');
});
test('all Persona fields, empty values, long backstory and special JSON round trip', () => {
  const p = personaFields({ ...persona, backstory: '가'.repeat(100000), unrelated: 'no' });
  assert.deepEqual(Object.keys(p), FIELDS); assert.equal(p.backstory.length, 100000);
  assert.deepEqual(parseResult(JSON.stringify(p), schemaFor()), p); assert.equal(personaFields().name, '');
  assert.match(copyAll(persona), /Description:\n줄1/); assert.equal(exportName(persona), 'persona-adapted-샘플 페르소나.json');
});
test('strict structured JSON rejects fences, missing fields, wrong types, arrays and added keys', () => {
  for (const s of ['```json\n{}\n```', '{}', '[]', JSON.stringify({ ...persona, name: '' }), JSON.stringify({ ...persona, extra: true }), JSON.stringify({ ...persona, scenario: 42 })])
    assert.throws(() => parseResult(s, schemaFor()));
  assert.deepEqual(parseResult('{"traits":[]}', TRAIT_SCHEMA), { traits: [] });
  assert.throws(() => parseResult('{"traits":[1]}', TRAIT_SCHEMA));
});
test('all three mode prompts remain distinct; Character rules and placeholders included', () => {
  assert.equal(Object.keys(MODES).length, 3);
  for (const mode of Object.keys(MODES)) {
    const messages = prompt('adapt', { mode, character: { firstMes: '{{user}}' }, traits: ['reserved'] }, schemaFor());
    assert.ok(messages[0].content.includes(MODES[mode])); assert.match(messages[0].content, /HARD CONSTRAINT/); assert.match(messages[0].content, /First Message/);
  }
});
test('translation placeholder loss rejected', () => {
  assertPlaceholders(persona, persona, FIELDS);
  assert.throws(() => assertPlaceholders(persona, { ...persona, scenario: 'character 곁' }, FIELDS));
});
test('Core extraction avoids network for empty Personality', async () => {
  const service = createGeneration({ generate() { throw Error('unexpected'); } });
  assert.deepEqual(await service.analyze({ personality: '' }), []);
});
test('semantic Core check rejects contradictory candidate, field request contains all current fields', async () => {
  const calls = [];
  const service = createGeneration({ async generate(id, messages) { calls.push(messages); return calls.length === 1 ? '{"backstory":"new"}' : '{"valid":false}'; } });
  await assert.rejects(service.adapt({ mode: 'Creative', traits: ['cautious'], current: persona, targetField: 'backstory' }, 'c', undefined, 'backstory'), /Core Personality/);
  assert.deepEqual(JSON.parse(calls[0][1].content).current, persona);
});
test('English translation preserves name and source object', async () => {
  const response = { ...persona }; delete response.name;
  const service = createGeneration({ async generate() { return JSON.stringify(response); } });
  const before = JSON.stringify(persona);
  assert.deepEqual(await service.translate(persona, {}, 'c'), persona); assert.equal(JSON.stringify(persona), before);
});
test('API uses current non-streaming raw contract, same-origin session and CSRF', async () => {
  let request;
  const api = createApi({ async fetch(url, options) { request = { url, options }; return new Response('{"content":"{}"}'); } });
  assert.equal(await api.generate('conn', [{ role: 'user', content: 'text' }]), '{}');
  assert.equal(request.url, '/api/generate/raw'); assert.equal(request.options.headers['x-marinara-csrf'], '1');
  assert.equal(request.options.credentials, 'same-origin'); assert.equal(JSON.parse(request.options.body).streaming, false);
});
test('permission, malformed LLM and provider failures have understandable errors', async () => {
  const api = createApi({ async fetch() { return new Response('', { status: 403 }); } });
  await assert.rejects(api.get('/chats'), /권한/);
  const malformedApi = createApi({ async fetch() { return new Response('<html>error</html>'); } });
  await assert.rejects(malformedApi.get('/chats'), /응답 형식/);
  const service = createGeneration({ async generate() { return 'not JSON'; } });
  await assert.rejects(service.analyze(persona, 'c'), /형식/);
});

test('Character detail API returns serialized data from the database row', () => {
  const data = { name: '수호자', description: '세계', personality: '차분함', scenario: '{{char}} 곁', first_mes: '{{user}} 안녕', extensions: { backstory: '긴 과거\n'.repeat(1000), appearance: '외투' }, character_book: { entries: ['excluded'] } };
  const result = characterFields({ id: 'character', data: JSON.stringify(data) });
  assert.deepEqual(result, { name: data.name, description: data.description, personality: data.personality, scenario: data.scenario, firstMes: data.first_mes, backstory: data.extensions.backstory, appearance: data.extensions.appearance });
  assert.equal(JSON.stringify(result).includes('excluded'), false);
});

test('invalid serialized Character data fails clearly without leaking parser details', () => {
  for (const data of ['{broken', 'null', '[]', '42', null, []]) {
    assert.throws(() => characterFields({ data }), /Character 카드/);
  }
  assert.equal(characterFields({ data: '{}' }).firstMes, '');
});


test('all nine mode/length combinations use independent generation and field strategies', () => {
  for (const mode of Object.keys(MODES)) for (const length of Object.keys(LENGTHS)) {
    for (const task of ['adapt', 'field']) {
      const system = prompt(task, { mode, length, targetField: 'personality' }, schemaFor())[0].content;
      assert.ok(system.includes(MODES[mode])); assert.ok(system.includes(LENGTHS[length]));
      assert.match(system, /not fixed token allocations/);
      if (length === 'Long') assert.match(system, /3–5 short utterances/);
      else assert.match(system, /Do not generate Example Lines or sample dialogue/);
    }
  }
});
test('default Normal; analysis, verification and translation do not get generation length rules', () => {
  assert.ok(prompt('adapt', { mode: 'Preserve' }, schemaFor())[0].content.includes(LENGTHS.Normal));
  for (const task of ['analyze', 'verify', 'translate']) {
    const system = prompt(task, { mode: 'Creative', length: 'Long' }, schemaFor())[0].content;
    assert.ok(!system.includes(LENGTHS.Long)); assert.ok(!system.includes(MODES.Creative));
  }
  assert.match(MODES.Creative, /Prioritize an actively redesigned Appearance/);
  assert.ok(!MODES.Expand.includes('actively redesigned Appearance'));
  assert.match(MODES.Preserve, /not the original Personality wording/);
});

test('prose formatting applies to generation, field reroll and translation with a separate examples exception', () => {
  for (const task of ['adapt', 'field', 'translate']) {
    const system = prompt(task, { mode: 'Creative', length: 'Long' }, schemaFor())[0].content;
    assert.match(system, /natural, connected prose/);
    assert.match(system, /ONLY exception/);
    assert.match(system, /Keep the required JSON envelope intact/);
  }
  assert.match(LENGTHS.Long, /blank line/);
  assert.match(LENGTHS.Long, /bulleted list/);
  assert.match(prompt('translate', {}, schemaFor())[0].content, /preserve an existing Example Lines section and its list without adding one/);
});


test('participant references use placeholders with an actual-name field exception', () => {
  for (const task of ['adapt', 'field', 'translate']) {
    const system = prompt(task, { mode: 'Creative', length: 'Long' }, schemaFor())[0].content;
    assert.match(system, /refer to the selected Character as \{\{char\}\}/);
    assert.match(system, /name field is the sole exception/);
    assert.match(system, /Do not substitute unrelated people/);
  }
});
test('translation may add normalized name placeholders but cannot remove existing ones', () => {
  assertPlaceholders({ description: '{{user}} met Hana' }, { description: '{{user}} met {{char}}' }, ['description']);
  assert.throws(() => assertPlaceholders({ description: '{{user}} met {{char}}' }, { description: '{{user}} met Hana' }, ['description']));
});


test('lorebook projection excludes disabled entries and nested disabled folders', async () => {
  const { lorebookContext } = await import('../src/model.js');
  const folders = [{ id: 'off', enabled: false }, { id: 'child', enabled: true, parentFolderId: 'off' }];
  const entries = [{ name: 'World', content: 'kept', enabled: true, secret: 'private' },
    { content: 'disabled', enabled: false }, { content: 'nested', enabled: true, folderId: 'child' }];
  assert.deepEqual(lorebookContext({ name: 'Book' }, entries, folders), { name: 'Book', entries: [{ name: 'World', content: 'kept' }] });
  assert.throws(() => lorebookContext({}, {}, []));
});


test('optional instructions are scoped to adaptation and field rerolls', () => {
  const data = { mode: 'Preserve', additionalInstructions: 'Be a librarian.' };
  for (const task of ['adapt', 'field']) {
    assert.match(prompt(task, data, schemaFor())[0].content, /Apply additionalInstructions/);
    assert.doesNotMatch(prompt(task, { ...data, additionalInstructions: '  ' }, schemaFor())[0].content, /Apply additionalInstructions/);
  }
  for (const task of ['translate', 'analyze', 'verify']) assert.doesNotMatch(prompt(task, data, schemaFor())[0].content, /Apply additionalInstructions/);
});

test('greetings preserve original indices and empty defaults without sending alternatives in fields', () => {
  const record = { data: JSON.stringify({ first_mes: '', alternate_greetings: ['Forest', null, 'Library', ''] }) };
  const list = characterGreetings(record);
  assert.deepEqual(list.map(e => e.id), ['default', 'alt:0', 'alt:2', 'alt:3']);
  assert.equal(selectedGreeting(list, 'default'), '');
  assert.equal(selectedGreeting(list, 'alt:2'), 'Library');
  assert.throws(() => selectedGreeting(list, 'alt:1'), /찾을 수 없습니다/);
  assert.equal(characterFields(record).firstMes, '');
  assert.ok(!JSON.stringify(characterFields(record)).includes('Library'));
  assert.equal(characterGreetings({ data: {} }).length, 1);
});
