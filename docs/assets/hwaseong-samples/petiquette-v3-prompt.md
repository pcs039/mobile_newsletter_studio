# 펫티켓 3차 이미지 제작 기록

- 도구: OpenAI 내장 `image_gen` (실제 생성 1회, Canva 미사용)
- 날짜: 2026-10-25
- 결과: `petiquette-v3.png` — 가상의 보호자와 코기, 가을 놀이터의 세 장면
- 사람·장소의 실사 기록이나 공식 화성시 사진으로 사용하지 않는다.
- PNG 생성 원본은 그대로 보존한다. 화면은 별도 WebP 파생 파일을 CSS로 동일 높이 세 컷으로 나누고 HTML 대사를 붙인다. 대사는 이미지에 합성하지 않는다.

## 사용 프롬프트

Use case: illustration-story. Asset: polished editorial 3-panel Korean municipal mobile newsletter comic about pet etiquette, intended for adult residents, warm witty sophisticated hand-drawn art, NOT flat vector clipart. Create ONE portrait image, exactly 3 equal-height landscape panels stacked vertically, edge-to-edge separated by thin warm-white gutters. Consistent characters: young adult Korean woman with short dark bob, teal casual jacket, cream trousers and orange crossbody bag; small charismatic golden tan corgi with cream muzzle, expressive eyebrows, red harness. Park setting: autumn Korean neighborhood dog park with subtle wood fence, grasses, distant trees, sunny gold light, tactile gouache and colored-pencil ink, cream/teal/rust palette. All characters clearly fully composed inside their own panel, useful readable at mobile 390px. Panel 1: dynamic wide scene, corgi enthusiastically sprinting towards right with comically proud grin, owner jogging after it smiling, movement leaves, energetic inviting composition. Panel 2: closer scene, owner suddenly stops, pats her empty trouser pocket, eyebrows raised and worried surprised face; corgi looks back knowingly, front paw raised in a 'wait' gesture; a small discreet waste bag icon/roll near ground as contextual hint, absolutely no visible feces. Panel 3: humorous payoff medium shot, corgi proudly presents a roll of green waste bags in mouth and gives the owner an amused side-eye; owner sheepish smile and hand at back of head, other hand reaching to take bags, warm affection, dog looks better prepared than human. Narrative must visibly differ per panel: joyful motion, surprised pause, humorous resolution. No words, lettering, numerals, signage, logos, watermarks, speech bubbles or captions anywhere. Leave a little calm sky above heads, but prioritize strong visual storytelling and finished art. Clean anatomy, expressive eyes, consistent wardrobe, no photorealism, no generic geometric figures. Target portrait aspect 2:3.


## 최종 모바일 파생 파일

새 이미지 생성 없이 공식 Sharp 0.35.4의 WebP 인코더로 `petiquette-v3-mobile.webp`를 생성했다. 크기·비율·구도는 1024×1536 그대로이며 원본 PNG는 삭제·덮어쓰기하지 않는다.

| 파일/품질 | 바이트 | 원본 대비 감소 | 390px PSNR | 520px PSNR |
|---|---:|---:|---:|---:|
| 원본 PNG | 3,238,286 | — | — | — |
| WebP 80 (비교용) | 328,024 | 89.87% | 34.34dB | 33.88dB |
| **WebP 88 (채택)** | **476,376** | **85.29%** | **35.44dB** | **35.20dB** |
| WebP 92 (비교용) | 575,576 | 82.23% | 35.85dB | 35.72dB |

PSNR은 동일한 폭으로 디코딩·축소한 RGB 픽셀 비교이며 주관적 화질 점수를 대신하지 않는다. 390/520px 육안 비교에서 보호자 표정·강아지 행동·가을 색채를 확인해 품질 88을 선택했다. 손실 압축으로 미세 질감 차이는 남는다. 신규 생성·Canva·외부 음성 API 호출은 없다.
