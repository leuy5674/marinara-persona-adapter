import { FIELDS, schemaFor, TRAIT_SCHEMA, CHECK_SCHEMA, parseResult, assertPlaceholders } from './model.js';
import { prompt } from './prompts.js';
export function createGeneration(api) {
  async function run(task, data, schema, connectionId, signal) {
    return parseResult(await api.generate(connectionId, prompt(task, data, schema), signal), schema);
  }
  return {
    async analyze(persona, connectionId, signal) {
      if (!persona.personality.trim()) return [];
      const result = await run('analyze', { personality: persona.personality }, TRAIT_SCHEMA, connectionId, signal);
      return [...new Set(result.traits.map(t => t.trim()))];
    },
    async adapt(data, connectionId, signal, field) {
      const schema = schemaFor(field ? [field] : FIELDS);
      const result = await run(field ? 'field' : 'adapt', data, schema, connectionId, signal);
      const candidate = field ? { ...data.current, ...result } : result;
      if (data.traits.length) {
        const check = await run('verify', { traits: data.traits, candidate }, CHECK_SCHEMA, connectionId, signal);
        if (!check.valid) throw new Error('Core Personality와 일치하지 않는 결과가 감지되었습니다. 기존 결과를 유지합니다. 다시 시도해주세요.');
      }
      return result;
    },
    async translate(original, character, connectionId, signal) {
      const fields = FIELDS.filter(f => f !== 'name');
      const result = await run('translate', { original, character }, schemaFor(fields), connectionId, signal);
      assertPlaceholders(original, result, fields);
      return { name: original.name, ...result };
    }
  };
}
