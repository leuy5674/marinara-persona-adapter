export function createApi(marinara) {
  async function request(path, body, signal) {
    const headers = body === undefined ? {} : { 'Content-Type': 'application/json', 'x-marinara-csrf': '1' };
    let response;
    try {
      response = await marinara.fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST',
        headers, credentials: 'same-origin', cache: 'no-store', signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Marinara에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도해주세요.');
    }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new Error('Marinara 세션 또는 확장 권한이 부족합니다. 로그인과 확장 승인을 확인해주세요.');
      if (response.status === 429) throw new Error('요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.');
      throw new Error(`요청에 실패했습니다 (${response.status}). 연결·모델 설정을 확인하고 다시 시도해주세요.`);
    }
    try { return await response.json(); } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Marinara 응답 형식을 읽을 수 없습니다. 다시 시도해주세요.');
    }
  }
  return {
    get: (path, signal) => request(path, undefined, signal),
    async generate(connectionId, messages, signal) {
      if (messages.some(m => m.content.length > 500000)) throw new Error('입력 내용이 Marinara의 요청 길이 제한을 초과합니다. 원본 내용을 줄여주세요.');
      const result = await request('/generate/raw', { connectionId, messages, streaming: false, parameters: { maxTokens: 8192 } }, signal);
      if (typeof result?.content !== 'string') throw new Error('생성 응답이 비어 있거나 취소되었습니다. 다시 시도해주세요.');
      return result.content;
    }
  };
}
