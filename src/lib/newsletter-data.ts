export const sampleNewsletter = {
  slug: "muan-2025-94",
  title: "황토골 무안소식지",
  issue: "2025년 제94호",
  organization: "무안군",
  publishDate: "2026.09.02",
  description: "군정 주요 소식, 생활 지원 안내, 문화 행사 일정을 모바일 읽기 보기와 PC e-book으로 제공합니다.",
  publicUrl: "/newsletters/muan-2025-94",
  ebookUrl: "/newsletters/muan-2025-94/ebook",
  pages: Array.from({ length: 16 }, (_, index) => ({
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
  })),
  articles: [
    {
      id: "main-news",
      page: "2쪽",
      title: "군정 주요 소식",
      summary: "무안군의 주요 정책과 생활 정보를 한눈에 확인할 수 있는 소식입니다.",
      body:
        "무안군은 군민 생활과 밀접한 주요 정책을 안내하고, 각 부서별 신청 정보와 행사 일정을 모바일에서 쉽게 확인할 수 있도록 정리합니다. PDF 원본에 흩어져 있는 문장을 읽기 쉬운 문단으로 나누고, 필요한 경우 신청 버튼과 전화 연결 버튼을 함께 제공합니다.",
      imageTone: "from-sky-100 to-blue-50",
      audioStatus: "음성 제공",
      audioDuration: "02:14",
      buttons: ["자세히 보기", "전화 연결"],
    },
    {
      id: "life-support",
      page: "4쪽",
      title: "생활 지원 안내",
      summary: "신청 기간, 문의처, 대상자 정보를 모바일에서 바로 확인합니다.",
      body:
        "생활 지원 안내는 대상, 신청 기간, 접수 방법, 문의처를 중심으로 재정리합니다. 시민이 필요한 정보를 바로 찾을 수 있도록 긴 표와 작은 글씨는 카드형 문단으로 나눕니다.",
      imageTone: "from-cyan-100 to-slate-50",
      audioStatus: "음성 준비 중",
      audioDuration: "-",
      buttons: ["신청 안내", "문의 전화"],
    },
    {
      id: "culture-events",
      page: "7쪽",
      title: "문화 행사 일정",
      summary: "행사 일정과 장소, 지도 링크를 함께 제공합니다.",
      body:
        "문화 행사 일정은 일시, 장소, 참여 방법을 중심으로 정리합니다. 추후 지도 보기와 행사 홈페이지 링크를 연결해 모바일에서 바로 이동할 수 있도록 설계합니다.",
      imageTone: "from-blue-100 to-indigo-50",
      audioStatus: "교체 필요",
      audioDuration: "01:48",
      buttons: ["지도 보기", "행사 정보"],
    },
  ],
};
