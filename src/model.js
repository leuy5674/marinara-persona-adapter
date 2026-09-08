export const FIELDS = ['name', 'description', 'personality', 'backstory', 'appearance', 'scenario'];
export const LABELS = Object.fromEntries(FIELDS.map(f => [f, f[0].toUpperCase() + f.slice(1)]));
export const textValue = value => typeof value === 'string' ? value : '';
export function personaFields(value = {}) {
  return Object.fromEntries(FIELDS.map(f => [f, textValue(value[f])]));
}
export function characterFields(record) {
  // GET /characters/:id returns the database row with serialized JSON data.
  let d = record?.data;
  try { if (typeof d === 'string') d = JSON.parse(d); }
  catch { throw new Error('Character 카드의 JSON 데이터를 읽을 수 없습니다. 카드 데이터를 확인해주세요.'); }
  if (!d || typeof d !== 'object' || Array.isArray(d))
    throw new Error('Character 카드 데이터가 비어 있거나 지원하지 않는 형식입니다.');
  return { name: textValue(d.name), description: textValue(d.description), personality: textValue(d.personality),
    backstory: textValue(d.extensions?.backstory), appearance: textValue(d.extensions?.appearance),
    scenario: textValue(d.scenario), firstMes: textValue(d.first_mes) };
}
export function schemaFor(fields = FIELDS) {
  return { type: 'object', additionalProperties: false, required: fields,
    properties: Object.fromEntries(fields.map(f => [f, { type: 'string' }])) };
}
export const TRAIT_SCHEMA = { type: 'object', additionalProperties: false, required: ['traits'], properties: { traits: { type: 'array', items: { type: 'string' } } } };
export const CHECK_SCHEMA = { type: 'object', additionalProperties: false, required: ['valid'], properties: { valid: { type: 'boolean' } } };
export function parseResult(raw, schema) {
  const error = () => new Error('생성 결과 형식을 읽을 수 없습니다. 다시 시도해주세요.');
  let value;
  try { value = JSON.parse(raw); } catch { throw error(); }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw error();
  if (Object.keys(value).some(k => !schema.required.includes(k))) throw error();
  for (const key of schema.required) {
    const type = schema.properties[key].type;
    if (type === 'array') {
      if (!Array.isArray(value[key]) || value[key].some(v => typeof v !== 'string' || !v.trim())) throw error();
    } else if (typeof value[key] !== type) throw error();
  }
  if ('name' in value && !value.name.trim()) throw new Error('생성된 Name이 비어 있습니다. 다시 시도해주세요.');
  return value;
}
export function assertPlaceholders(before, after, fields) {
  for (const f of fields) for (const p of ['{{user}}', '{{char}}']) {
    if (before[f].split(p).length > after[f].split(p).length)
      throw new Error('번역 중 placeholder가 변경되어 결과를 적용하지 않았습니다. 다시 시도해주세요.');
  }
}
export function copyAll(value) { return FIELDS.map(f => `${LABELS[f]}:\n${value[f]}`).join('\n\n'); }
export function exportName(value) { return `persona-adapted-${(value.name || 'persona').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80)}.json`; }
