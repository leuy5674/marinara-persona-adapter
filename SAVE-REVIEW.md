# Persona 바로 저장 검토

2026-09-08 · 설치된 Marinara 2.4.4 및 공식 HEAD `1a299369ac7025028c3ce1b80cc59f47b7b0691b` 기준.

**현재 구조에서는 구현 가능합니다.** 다만 이번 요청은 적용 가능성 검토이므로 v1.1.0에는 저장 버튼을 추가하지 않았습니다. 실제 사용자 데이터에 저장 요청도 보내지 않았습니다.

## 확인한 경로

- `packages/client/src/hooks/use-characters.ts`의 `useCreatePersona`는 `POST /api/characters/personas`를 사용합니다.
- `packages/server/src/routes/characters.routes.ts`는 입력을 `personaCreateInputSchema`로 검증하고 `storage.createPersona`를 호출합니다. 내부 전용 `/internal/...` endpoint가 아닌 본체 Persona 생성과 JSON import에서 공통 사용하는 경로입니다.
- `packages/shared/src/schemas/persona.schema.ts`는 확장의 여섯 문자열 필드를 수용하며 Name은 공백이 아닌 필수값입니다.
- `packages/server/src/services/storage/characters.storage.ts#createPersona`는 새 ID를 생성하고 `isActive: "false"`로 insert합니다. 기존 Persona 갱신이나 자동 활성화는 하지 않습니다.
- Full Page 확장의 `marinara.fetch`로 same-origin 요청을 보낼 수 있습니다. 기존 세션, JSON content-type, POST의 `x-marinara-csrf: 1`을 사용합니다. create route 자체에는 privileged 관리자 gate가 없습니다. 전체 서버의 인증·Origin/CSRF 정책은 계속 적용됩니다.

## 추가한다면 적용할 방식

1. 현재 Original 또는 English 탭의 편집 결과를 `Save as New Persona` 버튼으로 저장합니다.
2. `name, description, personality, backstory, appearance, scenario`만 전달합니다. 원본 ID, 활성 설정, lorebook 등은 전달하지 않습니다.
3. 저장 클릭 시점의 값을 고정하고 저장 중 중복 클릭을 막습니다. 생성용 비동기 응답 폐기 로직과 분리해 실제 저장 성공을 잘못 숨기지 않도록 합니다.
4. 응답을 확인한 뒤 저장된 이름을 표시하고 확장 내 Persona 목록을 갱신합니다. 본체 React state/query cache를 private 방식으로 조작하지 않습니다. 본체 목록에 바로 보이지 않으면 다시 열거나 새로고침하도록 안내합니다.
5. 네트워크 오류 때 POST를 자동 재시도하지 않습니다. 서버에서는 저장됐지만 응답이 유실됐을 수 있으므로 목록에서 확인하도록 안내해야 중복 저장을 피할 수 있습니다.

## 첨부 확장의 코드를 그대로 복사하지 않는 이유

첨부 확장도 동일한 create route를 사용하므로 현재 적용 가능성을 뒷받침합니다. 하지만 `tags`를 JSON 문자열로 보내거나 더 많은 부가 필드를 포함하는 방식은 우리 여섯 필드 저장에 필요하지 않습니다. raw fetch나 관리자 secret 읽기도 그대로 가져올 필요가 없습니다.

## 명세 조건과 한계

명세는 안정적이고 명확한 경로가 확인될 때만 저장을 허용합니다. 현재 본체의 표준 생성 경로와 입력 검증은 확인했지만, 외부 확장에 대한 API 버전 고정이나 장기 호환성 약속은 확인하지 못했습니다. 이는 현재 버전에서 기술적으로 구현 가능하다는 판단과 구분합니다. 추가 구현 시 이 경로를 서비스 함수 하나로 격리하고, 대상 Marinara 업데이트 때 스키마와 권한을 다시 검증해야 합니다. 실제 설치에서의 저장 성공·오류·중복 클릭·Original/English 선택 검증은 아직 수행하지 않았습니다.
