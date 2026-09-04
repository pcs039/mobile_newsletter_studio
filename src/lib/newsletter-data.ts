import type {
  AudioTrack,
  DashboardProject,
  ImageAsset,
  LabelStatus,
  LabelStatusDetail,
  LabelValue,
  NewsletterArticle,
  NewsletterContentBlock,
  NewsletterImageOverlay,
  NewsletterLinkAction,
  NewsletterPage,
  NewsletterProject,
  NewsletterTocItem,
} from "@/types/newsletter";

export const sampleLinkActions: NewsletterLinkAction[] = [
  {
    id: "link-apply",
    label: "신청 안내",
    type: "url",
    target: "https://www.muan.go.kr",
    displayStyle: "button",
  },
  {
    id: "link-map",
    label: "지도 보기",
    type: "map",
    target: "https://map.kakao.com",
    displayStyle: "map_card",
  },
  {
    id: "link-video",
    label: "홍보 영상 보기",
    type: "video",
    target: "https://www.youtube.com",
    displayStyle: "thumbnail_card",
  },
  {
    id: "link-phone",
    label: "전화 연결",
    type: "phone",
    target: "061-000-0000",
    displayStyle: "button",
  },
];

export const sampleContentBlocks: NewsletterContentBlock[] = [
  {
    id: "block-text",
    type: "paragraph",
    title: "본문 문단",
    status: "1차 포함",
    description: "제공 원고를 모바일 문단으로 정리",
  },
  {
    id: "block-video",
    type: "video_link",
    title: "동영상 링크 카드",
    status: "1차 포함",
    description: "YouTube 등 외부 영상은 썸네일 카드로 연결",
  },
  {
    id: "block-map",
    type: "map_link",
    title: "지도 링크 카드",
    status: "1차 포함",
    description: "지도 이미지는 카드로 보여주고 외부 지도 URL로 이동",
  },
  {
    id: "block-overlay",
    type: "overlay_notice",
    title: "이미지 위 오버레이",
    status: "2차 예정",
    description: "이미지 클립과 클릭 좌표를 % 기준으로 저장",
  },
];

export const sampleImageOverlays: NewsletterImageOverlay[] = [
  {
    id: "overlay-map-pin",
    label: "지도 핀 오버레이",
    imageAssetId: "asset-life-support-bg",
    linkActionId: "link-map",
    xPercent: 66,
    yPercent: 20,
    widthPercent: 18,
    heightPercent: 18,
  },
  {
    id: "overlay-apply",
    label: "신청 버튼 오버레이",
    imageAssetId: "asset-main-news-banner",
    linkActionId: "link-apply",
    xPercent: 12,
    yPercent: 72,
    widthPercent: 38,
    heightPercent: 14,
  },
];

export const sampleNewsletterPages: NewsletterPage[] = Array.from({ length: 16 }, (_, index) => ({
  number: index + 1,
  title:
    index === 0
      ? "표지"
      : index === 1
        ? "군정 주요 소식"
        : index === 3
          ? "생활 지원 안내"
          : index === 6
            ? "문화 행사 일정"
            : index === 10
              ? "보건·복지 소식"
              : index === 15
                ? "뒷표지"
                : `기사 페이지 ${index + 1}`,
  status: index < 4 ? "이미지 등록 완료" : index < 12 ? "검수 대기" : "제목 입력 필요",
}));

export const sampleNewsletterArticles: NewsletterArticle[] = [
  {
    id: "main-news",
    page: "2쪽",
    title: "군정 주요 소식",
    status: "편집 중",
    summary: "무안군의 주요 정책과 생활 정보를 한눈에 확인할 수 있는 소식입니다.",
    body:
      "무안군은 군민 생활과 밀접한 주요 정책을 안내하고, 각 부서별 신청 정보와 행사 일정을 모바일에서 쉽게 확인할 수 있도록 정리합니다. PDF 원본에 흩어져 있는 문장을 읽기 쉬운 문단으로 나누고, 필요한 경우 신청 버튼과 전화 연결 버튼을 함께 제공합니다.",
    imageTone: "from-sky-100 to-blue-50",
    audioStatus: "음성 제공",
    audioDuration: "02:14",
    buttons: ["자세히 보기", "전화 연결"],
    linkActions: [sampleLinkActions[0], sampleLinkActions[2], sampleLinkActions[3]],
    contentBlocks: sampleContentBlocks,
    overlays: [sampleImageOverlays[1]],
  },
  {
    id: "life-support",
    page: "4쪽",
    title: "생활 지원 안내",
    status: "검수 필요",
    summary: "신청 기간, 문의처, 대상자 정보를 모바일에서 바로 확인합니다.",
    body:
      "생활 지원 안내는 대상, 신청 기간, 접수 방법, 문의처를 중심으로 재정리합니다. 시민이 필요한 정보를 바로 찾을 수 있도록 긴 표와 작은 글씨는 카드형 문단으로 나눕니다.",
    imageTone: "from-cyan-100 to-slate-50",
    audioStatus: "음성 준비 중",
    audioDuration: "-",
    buttons: ["신청 안내", "문의 전화"],
    linkActions: [sampleLinkActions[0], sampleLinkActions[1], sampleLinkActions[3]],
    contentBlocks: sampleContentBlocks.slice(0, 3),
  },
  {
    id: "culture-events",
    page: "7쪽",
    title: "문화 행사 일정",
    status: "초안",
    summary: "행사 일정과 장소, 지도 링크를 함께 제공합니다.",
    body:
      "문화 행사 일정은 일시, 장소, 참여 방법을 중심으로 정리합니다. 추후 지도 보기와 행사 홈페이지 링크를 연결해 모바일에서 바로 이동할 수 있도록 설계합니다.",
    imageTone: "from-blue-100 to-indigo-50",
    audioStatus: "교체 필요",
    audioDuration: "01:48",
    buttons: ["지도 보기", "행사 정보"],
    linkActions: [sampleLinkActions[1], sampleLinkActions[2]],
    contentBlocks: sampleContentBlocks,
    overlays: [sampleImageOverlays[0]],
  },
  {
    id: "health-welfare",
    page: "11쪽",
    title: "보건·복지 소식",
    status: "대기",
    summary: "전화 연결과 음성 대본 정리가 필요한 보건·복지 안내입니다.",
    body:
      "보건·복지 소식은 전화 문의와 상담 안내가 중요한 영역입니다. 실제 제작 단계에서는 담당 부서, 전화번호, 운영 시간을 별도 버튼과 카드로 정리합니다.",
    imageTone: "from-slate-100 to-blue-50",
    audioStatus: "음성 준비 전",
    audioDuration: "-",
    buttons: ["문의 전화", "상담 안내"],
  },
];

export const sampleNewsletterTocItems: NewsletterTocItem[] = [
  {
    id: "toc-cover",
    order: 1,
    title: "표지",
    targetType: "page",
    targetId: "1",
    isVisible: true,
  },
  {
    id: "toc-main-news",
    order: 2,
    title: "군정 주요 소식",
    targetType: "article",
    targetId: "main-news",
    isVisible: true,
  },
  {
    id: "toc-life-support",
    order: 3,
    title: "생활 지원 안내",
    targetType: "article",
    targetId: "life-support",
    isVisible: true,
  },
  {
    id: "toc-culture-events",
    order: 4,
    title: "문화 행사 일정",
    targetType: "article",
    targetId: "culture-events",
    isVisible: true,
  },
];

export const sampleNewsletter: NewsletterProject = {
  slug: "muan-2025-94",
  title: "황토골 무안소식지",
  issue: "2025년 제94호",
  organization: "무안군",
  publishDate: "2026.09.02",
  description: "군정 주요 소식, 생활 지원 안내, 문화 행사 일정을 모바일 읽기 보기와 PC e-book으로 제공합니다.",
  packageTier: "standard",
  productionMode: "hybrid",
  estimatedHours: "18~24시간",
  designerHoursCap: "6시간",
  previewTitle: "황토골 무안소식지 2025년 제94호",
  previewDescription: "무안군 주요 정책과 생활 정보를 모바일 읽기 보기와 PC e-book으로 확인합니다.",
  popupNotice: "본 화면은 발행 전 관리자 검수용 미리보기입니다.",
  pcEbookPageCount: 2,
  publicUrl: "/newsletters/muan-2025-94",
  ebookUrl: "/newsletters/muan-2025-94/ebook",
  pages: sampleNewsletterPages,
  tocItems: sampleNewsletterTocItems,
  articles: sampleNewsletterArticles.slice(0, 3),
};

export const dashboardSummaryCards: LabelValue[] = [
  { label: "전체 프로젝트", value: "8" },
  { label: "제작 중", value: "3" },
  { label: "오늘 접속", value: "428" },
  { label: "발행 완료", value: "3" },
];

export const dashboardSummaryDetails: Record<string, string> = {
  "전체 프로젝트": "실데이터 기준",
  "제작 중": "편집 필요",
  "오늘 접속": "집계 예정",
  "발행 완료": "URL·QR 생성",
};

export const dashboardProjects: DashboardProject[] = [
  {
    id: "muan-2025-94",
    slug: "muan-2025-94",
    title: "황토골 무안소식지 2025년 제94호",
    organization: "무안군",
    assigneeName: "담당자 미지정",
    issue: "2025년",
    status: "제작 중",
    pages: "16쪽",
    reading: "편집 중",
    audio: "미등록",
    packageTier: "표준형",
    productionMode: "혼합형",
    workload: "예상 18~24h · 디자인 6h 상한",
    updated: "2026.09.02",
    views: {
      today: "184",
      yesterday: "96",
      total: "1,284",
    },
    actions: {
      editHref: "/projects/muan-2025-94/pages",
      previewHref: "/newsletters/muan-2025-94?preview=admin",
      analyticsHref: "#analytics-preview",
      duplicateHref: "/projects/new?copyFrom=muan-2025-94",
      archiveHref: "#archive-policy",
    },
  },
  {
    id: "seungdal-2026-05",
    slug: "seungdal-2026-05",
    title: "승달소식지 2026년 5월호",
    organization: "무안군",
    assigneeName: "담당자 미지정",
    issue: "2026년 5월",
    status: "샘플 검토",
    pages: "8쪽",
    reading: "구조 확인",
    audio: "보류",
    packageTier: "기본형",
    productionMode: "템플릿 블록형",
    workload: "예상 8~12h · 디자인 최소",
    updated: "2026.09.01",
    views: {
      today: "62",
      yesterday: "41",
      total: "516",
    },
    actions: {
      editHref: "/projects/muan-2025-94/pages",
      previewHref: "/newsletters/muan-2025-94/ebook?preview=admin",
      analyticsHref: "#analytics-preview",
      duplicateHref: "/projects/new?copyFrom=seungdal-2026-05",
      archiveHref: "#archive-policy",
    },
  },
  {
    id: "incheon-mind-link",
    slug: "incheon-mind-link",
    title: "인천 마음건강 이음서비스 안내지",
    organization: "인천광역시",
    assigneeName: "담당자 미지정",
    issue: "실증 샘플",
    status: "기획안",
    pages: "12쪽",
    reading: "대기",
    audio: "대기",
    packageTier: "고급형",
    productionMode: "혼합형",
    workload: "예상 30~40h · 별도 검수",
    updated: "2026.08.31",
    views: {
      today: "0",
      yesterday: "0",
      total: "0",
    },
    actions: {
      editHref: "/projects/muan-2025-94/reading",
      previewHref: "/newsletters/muan-2025-94?preview=admin",
      analyticsHref: "#analytics-preview",
      duplicateHref: "/projects/new?copyFrom=incheon-mind-link",
      archiveHref: "#archive-policy",
    },
  },
];

export const dashboardAnalyticsNotes: LabelStatusDetail[] = [
  { label: "오늘 접속", status: "428", detail: "발행된 공개 URL 기준 집계 예정" },
  { label: "전체 접속", status: "1,800", detail: "Supabase 연동 후 실제 통계로 전환" },
  { label: "상세 로그", status: "제한", detail: "IP는 해시 또는 마스킹 저장 권장" },
];

export const projectOperationActions: LabelStatusDetail[] = [
  { label: "복사", status: "1.5차 핵심", detail: "월간 소식지는 전월 구성을 복제해 제작" },
  { label: "통계", status: "MVP 보강", detail: "목록과 발행 화면에서 접속 현황 확인" },
  { label: "삭제", status: "목록 제외", detail: "실제 데이터는 복구 가능한 상태로 숨김 처리" },
];

export const packageOptions: LabelStatusDetail[] = [
  { label: "기본형", status: "빠른 제작", detail: "견적·범위 관리용 등급입니다. 실제 제작 방식은 별도로 선택합니다." },
  { label: "표준형", status: "권장", detail: "기본 권장 상품입니다. 템플릿 블록형, 혼합형, 이미지 페이지형 모두 선택할 수 있습니다." },
  { label: "고급형", status: "검수 확대", detail: "맞춤 구성과 검수 범위가 넓은 상품 등급입니다." },
  { label: "프리미엄", status: "별도 협의", detail: "디자인 대행, 이미지 페이지 제작, URL 태깅 규모가 큰 경우의 견적 등급입니다." },
];

export const productionModeOptions: LabelStatusDetail[] = [
  { label: "템플릿 블록형", status: "기본", detail: "제목, 문단, 이미지, 버튼, 유튜브를 모바일 블록으로 작성합니다." },
  { label: "혼합형", status: "권장", detail: "기사 블록과 제작 이미지를 함께 쓰고 필요한 위치에 링크를 연결합니다." },
  { label: "이미지 페이지형", status: "이미지", detail: "완성된 모바일 페이지 이미지를 본문으로 쓰고 투명 클릭 영역을 지정합니다." },
  { label: "원본 연동형", status: "연동", detail: "PDF 원본 또는 외부 e-book을 중심으로 연결하고 필요한 보조 콘텐츠만 구성합니다." },
  { label: "OCR 보조형", status: "보조", detail: "원본 이미지나 PDF에서 텍스트를 추출해 기사 블록 작성의 초안으로 활용합니다." },
];

export const workflowSteps = [
  "프로젝트 생성",
  "PDF 원본 보관",
  "페이지 이미지 등록",
  "읽기 보기 편집",
  "이미지·링크·음성 연결",
  "발행",
];

export const assetChecks: LabelValue[] = [
  { label: "기관 제공 원본 이미지", value: "최우선" },
  { label: "디자이너 제작 배너", value: "권장" },
  { label: "AI 생성 이미지", value: "조건부" },
  { label: "PDF 발췌 이미지", value: "보조" },
];

export const pageConversionSteps: LabelStatus[] = [
  { label: "PDF 원본 업로드", status: "보관용" },
  { label: "페이지 이미지 등록", status: "수동 업로드" },
  { label: "PC e-book 구성", status: "등록 이미지 또는 외부 링크" },
  { label: "모바일 읽기 보기", status: "다음 단계" },
];

export const pageQualityChecks = [
  "등록 이미지 순서가 원본 PDF와 같은지 확인",
  "표지와 뒷표지가 잘리지 않았는지 확인",
  "PC e-book에서 확대했을 때 글자와 이미지가 흐리지 않은지 확인",
  "1차 MVP에서는 PDF 자동 변환보다 수동 등록 품질을 우선 확인",
];

export const readingEditSections = ["제목·요약", "본문 문단", "이미지·영상", "지도·링크", "음성 대본"];

export const linkBlockGuidelines: LabelStatusDetail[] = [
  { label: "동영상", status: "썸네일 카드", detail: "YouTube 등 외부 영상 URL을 연결하고 새 창 또는 현재 창으로 이동" },
  { label: "지도", status: "지도 카드", detail: "지도 이미지를 보여주고 카카오·네이버·구글 지도 URL로 이동" },
  { label: "텍스트 링크", status: "버튼 우선", detail: "1차 MVP에서는 본문 중간 직접 링크보다 명확한 버튼 블록으로 처리" },
  { label: "이미지 오버레이", status: "2차 예정", detail: "이미지 위 클립과 클릭 영역은 좌표 기반 편집기로 확장" },
];

export const imageAssets: ImageAsset[] = [
  {
    id: "asset-muan-office",
    name: "무안군청 전경 대표 이미지",
    source: "기관 제공",
    rights: "사용 가능",
    quality: "원본 고화질",
    usage: "표지·대표 이미지",
    review: "검수 완료",
    tone: "from-sky-100 to-blue-50",
    altText: "무안군청 전경을 보여주는 대표 이미지",
    publicGalleryEnabled: false,
  },
  {
    id: "asset-main-news-banner",
    name: "군정 주요 소식 카드 배너",
    source: "디자이너 제작",
    rights: "사용 가능",
    quality: "웹용 적합",
    usage: "기사 카드",
    review: "검수 완료",
    tone: "from-blue-100 to-indigo-50",
    altText: "군정 주요 소식을 소개하는 카드형 배너",
    publicGalleryEnabled: true,
  },
  {
    id: "asset-life-support-bg",
    name: "생활 지원 안내 배경",
    source: "AI 생성",
    rights: "확인 필요",
    quality: "웹용 적합",
    usage: "섹션 배경",
    review: "검수 필요",
    tone: "from-cyan-100 to-slate-50",
    altText: "생활 지원 안내 섹션의 배경 이미지",
    publicGalleryEnabled: false,
  },
  {
    id: "asset-pdf-event-crop",
    name: "PDF 4쪽 행사 이미지 발췌",
    source: "PDF 발췌",
    rights: "확인 필요",
    quality: "저화질 주의",
    usage: "보조 이미지",
    review: "교체 권장",
    tone: "from-slate-100 to-amber-50",
    altText: "PDF 지면에서 발췌한 행사 관련 보조 이미지",
    publicGalleryEnabled: false,
  },
];

export const imageSourceTypes: LabelValue[] = [
  { label: "기관 제공 원본", value: "최우선" },
  { label: "디자이너 제작", value: "권장" },
  { label: "AI 생성", value: "조건부" },
  { label: "PDF 발췌", value: "보조" },
];

export const imageReviewItems = [
  "출처와 권리 확인 상태 입력",
  "모바일 화면에서 흐림·잘림 여부 확인",
  "실제 행사·인물처럼 보이는 AI 이미지는 사용 금지",
  "모든 대표 이미지에 대체텍스트 작성",
];

export const audioTracks: AudioTrack[] = [
  {
    page: "2쪽",
    title: "군정 주요 소식",
    status: "업로드 완료",
    file: "muan-main-news.mp3",
    duration: "02:14",
    script: "대본 확인 완료",
  },
  {
    page: "4쪽",
    title: "생활 지원 안내",
    status: "미등록",
    file: "파일 없음",
    duration: "-",
    script: "대본 수정 필요",
  },
  {
    page: "7쪽",
    title: "문화 행사 일정",
    status: "교체 필요",
    file: "culture-event-draft.mp3",
    duration: "01:48",
    script: "행사명 발음 확인",
  },
  {
    page: "11쪽",
    title: "보건·복지 소식",
    status: "대기",
    file: "파일 없음",
    duration: "-",
    script: "대본 작성 전",
  },
];

export const audioWorkflow: LabelStatus[] = [
  { label: "대본 정리", status: "읽기 보기 기준" },
  { label: "외부 TTS 생성", status: "관리자 수동 작업" },
  { label: "MP3 업로드", status: "기사별 연결" },
  { label: "재생 검수", status: "브라우저 플레이어 확인" },
];

export const audioReviewChecks = [
  "본문 내용과 음성 대본이 일치하는지 확인",
  "기관명, 지명, 행사명 발음이 어색하지 않은지 확인",
  "관리자 화면의 브라우저 플레이어에서 재생되는지 확인",
  "모바일에서 재생 버튼이 충분히 잘 보이는지 확인",
  "파일 교체 후 이전 음성이 남아 있지 않은지 확인",
];

export const publishReadinessItems: LabelStatusDetail[] = [
  { label: "기본 정보", status: "완료", detail: "소식지명·기관명·발행월 입력" },
  { label: "PDF·이미지", status: "완료", detail: "등록 페이지 확인" },
  { label: "읽기 보기", status: "검수 중", detail: "4개 기사 편집 진행" },
  { label: "이미지 자산", status: "검수 중", detail: "권리·화질 확인 필요" },
  { label: "음성 MP3", status: "보완 필요", detail: "2개 기사 미등록" },
];

export const publishChecks = [
  "모바일 읽기 보기에서 제목, 본문, 버튼이 잘리지 않는지 확인",
  "PC e-book에서 원본 지면 확대 보기 품질 확인",
  "전화, URL, 지도, 내부 페이지 이동 링크 확인",
  "YouTube 등 외부 동영상 링크가 정상 이동하는지 확인",
  "이미지 출처, 권리, 대체텍스트 입력 상태 확인",
  "음성 파일 재생과 대본 일치 여부 확인",
];
